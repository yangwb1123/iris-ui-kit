import { flattenLeafColumns } from '@iris-ui-kit/core'
import { onDestroy, tick } from 'svelte'
import type { IrisTableColumn } from './types'

export type ColumnVisibility = Record<string, boolean> | undefined
type ColumnFadeEntry = { dir: 'in' | 'out'; phase: 'pending' | 'run' }
type ColumnFadeOverlay = Record<string, ColumnFadeEntry>
type TableRow = Record<string, unknown>
type FadeColumn = { key: string; children?: FadeColumn[] }
type FocusCell = { row: string; column: string }

type ColumnFadeAttrs = {
  'data-iris-column-fade': 'in' | 'out' | undefined
  'aria-hidden': 'true' | undefined
  inert: boolean | undefined
}

export interface TableColumnFadeController {
  readonly displayColumns: IrisTableColumn[]
  readonly effectiveVisibility: ColumnVisibility
  readonly fadeByLeaf: ColumnFadeOverlay
  readonly columnFadeActive: boolean
  readonly columnFadeAttr: (column: FadeColumn) => 'in' | 'out' | undefined
  readonly columnFadeStyle: (column: FadeColumn) => Record<string, string> | null
  readonly columnFadeAttrs: (column: FadeColumn) => ColumnFadeAttrs
  readonly isCollapsed: (key: string) => boolean
}

const FADE_DURATION_MS = 200
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function isCollapsedEntry(entry: ColumnFadeEntry): boolean {
  return (
    (entry.dir === 'out' && entry.phase === 'run') ||
    (entry.dir === 'in' && entry.phase === 'pending')
  )
}

/**
 * Presentation-only column visibility state. The Grid Core columns model stays
 * the authority; this overlay only keeps a changed top-level column mounted
 * while its tracks and cells move between settled visibility states.
 */
export function createTableColumnFade<Row extends TableRow>(options: {
  visibility: () => ColumnVisibility
  enabled: () => boolean
  columns: () => IrisTableColumn<Row>[]
}): TableColumnFadeController {
  let overlay = $state<ColumnFadeOverlay>({})
  // Keep a plain snapshot for scheduling callbacks. Reading the rune from a
  // callback would otherwise make the callback itself the reactive boundary.
  let overlayValue: ColumnFadeOverlay = {}
  let previous = options.visibility() ?? {}
  let initialized = false
  let reducedMotion = $state(false)
  let mediaQuery: MediaQueryList | null = null
  let removeMotionListener: (() => void) | null = null
  let flipRaf: number | null = null
  let commitTimer: ReturnType<typeof setTimeout> | null = null
  let scheduleGeneration = 0
  let disposed = false
  let focusCandidate: HTMLElement | null = null
  let focusTable: HTMLElement | null = null
  let focusGridCell: FocusCell | null = null

  function setOverlay(next: ColumnFadeOverlay): void {
    overlayValue = next
    overlay = next
  }

  function installMotionListener(): void {
    if (mediaQuery || typeof window === 'undefined' || typeof window.matchMedia !== 'function')
      return
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    mediaQuery = query
    reducedMotion = query.matches
    const onChange = (): void => {
      reducedMotion = query.matches
    }
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange)
      removeMotionListener = () => query.removeEventListener?.('change', onChange)
    } else {
      query.addListener?.(onChange)
      removeMotionListener = () => query.removeListener?.(onChange)
    }
  }

  function removeMotionSubscription(): void {
    removeMotionListener?.()
    removeMotionListener = null
    mediaQuery = null
    reducedMotion = false
  }

  function flip(current: ColumnFadeOverlay): ColumnFadeOverlay {
    let changed = false
    const next: ColumnFadeOverlay = {}
    for (const [key, entry] of Object.entries(current)) {
      if (entry.phase === 'pending') {
        next[key] = { dir: entry.dir, phase: 'run' }
        changed = true
      } else next[key] = entry
    }
    return changed ? next : current
  }

  function commit(current: ColumnFadeOverlay): ColumnFadeOverlay {
    const visibility = options.visibility() ?? {}
    let changed = false
    const next: ColumnFadeOverlay = {}
    for (const [key, entry] of Object.entries(current)) {
      const visible = visibility[key] !== false
      const done = entry.dir === 'out' ? !visible : visible
      if (done) changed = true
      else next[key] = entry
    }
    return changed ? next : current
  }

  function cancelSchedule(): void {
    scheduleGeneration += 1
    focusCandidate = null
    focusTable = null
    focusGridCell = null
    if (flipRaf !== null) {
      if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(flipRaf)
      }
      flipRaf = null
    }
    if (commitTimer !== null) {
      clearTimeout(commitTimer)
      commitTimer = null
    }
  }

  function clear(): void {
    cancelSchedule()
    if (Object.keys(overlayValue).length > 0) setOverlay({})
  }

  function captureFocus(): void {
    if (typeof document === 'undefined') return
    const active = document.activeElement
    if (active instanceof HTMLElement && active.closest('[data-iris-table]')) {
      focusCandidate = active
      focusTable = active.closest<HTMLElement>('[data-iris-table]')
      focusGridCell =
        active.dataset.gridRow !== undefined && active.dataset.gridCol !== undefined
          ? { row: active.dataset.gridRow, column: active.dataset.gridCol }
          : null
      return
    }
    focusCandidate = null
    focusTable = null
    focusGridCell = null
  }

  function findHiddenFocusCell(
    table: HTMLElement,
    candidate: HTMLElement | null,
    rememberedCell: FocusCell | null,
  ): HTMLElement | null {
    const candidateHidden = candidate?.isConnected
      ? candidate.closest<HTMLElement>('[data-iris-column-fade][aria-hidden="true"]')
      : null
    if (candidateHidden && candidateHidden.closest('[data-iris-table]') === table)
      return candidateHidden
    if (!rememberedCell) return null
    return (
      Array.from(table.querySelectorAll<HTMLElement>('[data-grid-row][data-grid-col]')).find(
        (cell) =>
          cell.dataset.gridRow === rememberedCell.row &&
          cell.dataset.gridCol === rememberedCell.column &&
          cell.getAttribute('aria-hidden') === 'true',
      ) ?? null
    )
  }

  function focusNearestVisibleCell(
    table: HTMLElement,
    row: string,
    currentColumn: number,
  ): boolean {
    const alternatives = Array.from(
      table.querySelectorAll<HTMLElement>('[data-grid-row][data-grid-col]'),
    )
      .filter(
        (cell) =>
          cell.dataset.gridRow === row &&
          cell.getAttribute('aria-hidden') !== 'true' &&
          !cell.hasAttribute('inert'),
      )
      .sort(
        (a, b) =>
          Math.abs(Number(a.dataset.gridCol) - currentColumn) -
          Math.abs(Number(b.dataset.gridCol) - currentColumn),
      )
    if (!alternatives[0]) return false
    alternatives[0].focus()
    return true
  }

  function recoverHiddenFocus(
    table: HTMLElement,
    candidate: HTMLElement | null,
    rememberedCell: FocusCell | null,
  ): boolean {
    const hidden = findHiddenFocusCell(table, candidate, rememberedCell)
    if (!hidden || hidden.closest('[data-iris-table]') !== table) return false
    const row = hidden.dataset.gridRow
    if (row !== undefined && focusNearestVisibleCell(table, row, Number(hidden.dataset.gridCol)))
      return true
    if (document.activeElement === candidate || hidden.contains(document.activeElement)) {
      candidate?.blur()
    }
    return true
  }

  function recoverFocus(
    candidate: HTMLElement | null,
    rememberedTable: HTMLElement | null,
    rememberedCell: FocusCell | null,
    recoverMissing = false,
  ): void {
    if (disposed || typeof document === 'undefined') return
    const active = document.activeElement
    // Focus recovery must never pull focus back after the user chose another
    // target, including a target outside this table.
    if (active !== candidate && active !== document.body) return
    const table = candidate?.closest<HTMLElement>('[data-iris-table]') ?? rememberedTable
    if (!table || recoverHiddenFocus(table, candidate, rememberedCell)) return
    if (recoverMissing && rememberedCell)
      focusNearestVisibleCell(table, rememberedCell.row, Number(rememberedCell.column))
  }

  function scheduleFocusRecovery(
    candidate: HTMLElement | null,
    rememberedTable: HTMLElement | null,
    rememberedCell: FocusCell | null,
  ): void {
    if (!candidate || !rememberedTable || !rememberedCell) return
    const generation = scheduleGeneration
    void tick().then(() => {
      if (disposed || generation !== scheduleGeneration) return
      recoverFocus(candidate, rememberedTable, rememberedCell, true)
    })
  }

  function scheduleFade(): void {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      // Fail closed when the browser scheduling primitive is unavailable,
      // without dropping focus as the overlay is removed.
      captureFocus()
      const candidate = focusCandidate
      const rememberedTable = focusTable
      const rememberedCell = focusGridCell
      clear()
      scheduleFocusRecovery(candidate, rememberedTable, rememberedCell)
      return
    }
    if (flipRaf === null) {
      const generation = scheduleGeneration
      flipRaf = window.requestAnimationFrame(() => {
        if (disposed || generation !== scheduleGeneration) return
        flipRaf = window.requestAnimationFrame(() => {
          if (disposed || generation !== scheduleGeneration) return
          flipRaf = null
          const candidate = focusCandidate
          const rememberedTable = focusTable
          const rememberedCell = focusGridCell
          setOverlay(flip(overlayValue))
          queueMicrotask(() => {
            if (disposed || generation !== scheduleGeneration) return
            recoverFocus(candidate, rememberedTable, rememberedCell)
            focusCandidate = null
            focusTable = null
            focusGridCell = null
          })
        })
      })
    }
    if (commitTimer !== null) clearTimeout(commitTimer)
    const generation = scheduleGeneration
    commitTimer = setTimeout(() => {
      if (disposed || generation !== scheduleGeneration) return
      commitTimer = null
      setOverlay(commit(overlayValue))
    }, FADE_DURATION_MS)
  }

  function startFade(before: ColumnVisibility, next: ColumnVisibility): void {
    const nextOverlay = { ...overlayValue }
    let changed = false
    for (const key of new Set([...Object.keys(before ?? {}), ...Object.keys(next ?? {})])) {
      const wasVisible = before?.[key] !== false
      const isVisible = next?.[key] !== false
      if (wasVisible === isVisible) continue
      // Visibility semantics stop at top-level columns in IrisTable. A leaf
      // key inside a grouped column therefore cannot invent an animation.
      if (!options.columns().some((column) => column.key === key)) continue
      nextOverlay[key] = { dir: isVisible ? 'in' : 'out', phase: 'pending' }
      changed = true
    }
    if (!changed) return
    captureFocus()
    setOverlay(nextOverlay)
    scheduleFade()
  }

  $effect.pre(() => {
    const next = options.visibility() ?? {}
    const enabled = options.enabled()
    if (enabled) installMotionListener()
    else removeMotionSubscription()

    if (!initialized) {
      previous = { ...next }
      initialized = true
      if (!enabled || reducedMotion) clear()
      return
    }

    const before = previous
    previous = { ...next }
    if (!enabled || reducedMotion) {
      captureFocus()
      const candidate = focusCandidate
      const rememberedTable = focusTable
      const rememberedCell = focusGridCell
      clear()
      scheduleFocusRecovery(candidate, rememberedTable, rememberedCell)
      return
    }
    startFade(before, next)
  })

  onDestroy(() => {
    disposed = true
    cancelSchedule()
    removeMotionSubscription()
  })

  const effectiveVisibility = $derived.by<ColumnVisibility>(() => {
    if (Object.keys(overlay).length === 0) return options.visibility()
    const next = { ...(options.visibility() ?? {}) }
    for (const key of Object.keys(overlay)) next[key] = true
    return next
  })
  const displayColumns = $derived.by<IrisTableColumn[]>(() => {
    const visibility = effectiveVisibility
    if (visibility === undefined) return options.columns() as unknown as IrisTableColumn[]
    return options
      .columns()
      .filter((column) => visibility[column.key] !== false) as unknown as IrisTableColumn[]
  })
  const fadeByLeaf = $derived.by<ColumnFadeOverlay>(() => {
    if (Object.keys(overlay).length === 0) return {}
    const next: ColumnFadeOverlay = {}
    for (const [key, entry] of Object.entries(overlay)) {
      const top = options.columns().find((column) => column.key === key)
      if (!top) continue
      const leaves = top.children?.length ? flattenLeafColumns([top]) : [top]
      for (const leaf of leaves) next[leaf.key] = entry
    }
    return next
  })
  const entryOf = (column: FadeColumn): ColumnFadeEntry | undefined =>
    overlay[column.key] ?? fadeByLeaf[column.key]
  const columnFadeStyle = (column: FadeColumn): Record<string, string> | null => {
    const entry = entryOf(column)
    return entry && isCollapsedEntry(entry) ? { opacity: '0' } : null
  }
  const columnFadeAttrs = (column: FadeColumn): ColumnFadeAttrs => {
    const hidden = columnFadeStyle(column) !== null
    return {
      'data-iris-column-fade': entryOf(column)?.dir,
      'aria-hidden': hidden ? 'true' : undefined,
      inert: hidden ? true : undefined,
    }
  }
  const columnFadeActive = $derived(options.enabled() && Object.keys(overlay).length > 0)

  return {
    get displayColumns() {
      return displayColumns
    },
    get effectiveVisibility() {
      return effectiveVisibility
    },
    get fadeByLeaf() {
      return fadeByLeaf
    },
    get columnFadeActive() {
      return columnFadeActive
    },
    columnFadeAttr: (column) => entryOf(column)?.dir,
    columnFadeStyle,
    columnFadeAttrs,
    isCollapsed: (key) => {
      const entry = fadeByLeaf[key]
      return entry !== undefined && isCollapsedEntry(entry)
    },
  }
}
