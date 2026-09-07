import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type Accessor,
  type JSX,
} from 'solid-js'
import {
  advanceColumnFade,
  commitColumnFade,
  expandColumnFadeToLeaves,
  isColumnFadeCollapsed,
  mergeColumnFadeVisibility,
  startColumnFade,
  type ColumnFadeEntry,
  type ColumnFadeOverlay,
} from '@iris-ui-kit/core'
import { usePrefersReducedMotion } from '../../motion'
import type { IrisTableColumn } from './types'

type ColumnVisibility = Record<string, boolean> | undefined

type ColumnFadeAttrs = {
  'data-iris-column-fade': 'in' | 'out' | undefined
  'aria-hidden': 'true' | undefined
  inert: boolean | undefined
}

export interface TableColumnFadeController<Row extends Record<string, unknown>> {
  effectiveVisibility: Accessor<ColumnVisibility>
  fadeByLeaf: Accessor<ColumnFadeOverlay>
  columnFadeAttr: (column: IrisTableColumn<Row>) => 'in' | 'out' | undefined
  columnFadeStyle: (column: IrisTableColumn<Row>) => JSX.CSSProperties | null
  columnFadeAttrs: (column: IrisTableColumn<Row>) => ColumnFadeAttrs
  columnFadeActive: Accessor<boolean>
  isCollapsed: (key: string) => boolean
  rememberFocus: (row: number, column: number) => void
}

const FADE_DURATION_MS = 200

/** Solid-only presentation overlay for the Grid Core column visibility state. */
export function createTableColumnFade<Row extends Record<string, unknown>>(options: {
  visibility: Accessor<ColumnVisibility>
  enabled: Accessor<boolean>
  columns: Accessor<IrisTableColumn<Row>[]>
}): TableColumnFadeController<Row> {
  const reducedMotion = usePrefersReducedMotion(options.enabled)
  const [overlay, setOverlaySignal] = createSignal<ColumnFadeOverlay>({})
  let overlayValue: ColumnFadeOverlay = {}
  let previous = options.visibility() ?? {}
  let initialized = false
  let disposed = false
  let flipRaf: number | null = null
  let commitTimer: ReturnType<typeof setTimeout> | null = null
  let scheduleGeneration = 0
  let focusCandidate: HTMLElement | null = null
  let focusTable: HTMLElement | null = null
  let focusGridCell: { row: string; column: string } | null = null

  const setOverlay = (next: ColumnFadeOverlay): void => {
    overlayValue = next
    setOverlaySignal(next)
  }

  const topLevelColumn = (key: string): IrisTableColumn<Row> | undefined =>
    options.columns().find((column) => column.key === key)

  const cancelSchedule = (): void => {
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

  const clear = (): void => {
    cancelSchedule()
    if (Object.keys(overlayValue).length > 0) setOverlay({})
  }

  const captureFocus = (): void => {
    if (typeof document === 'undefined' || typeof HTMLElement === 'undefined') {
      focusCandidate = null
      focusTable = null
      focusGridCell = null
      return
    }
    const active = document.activeElement
    if (active instanceof HTMLElement) {
      const table = active.closest<HTMLElement>('[data-iris-table]')
      if (table) {
        focusCandidate = active
        focusTable = table
        focusGridCell =
          active.dataset.gridRow !== undefined && active.dataset.gridCol !== undefined
            ? { row: active.dataset.gridRow, column: active.dataset.gridCol }
            : null
        return
      }
    }
    // A core visibility update may remove the focused cell before this effect
    // runs, leaving body focus. Keep the remembered table coordinates for that
    // case; an actual external element always invalidates the recovery scope.
    if (active === document.body) return
    focusCandidate = null
    focusTable = null
    focusGridCell = null
  }

  const findHiddenFocusCell = (
    table: HTMLElement,
    candidate: HTMLElement | null,
    rememberedCell: { row: string; column: string } | null,
  ): HTMLElement | null => {
    const candidateHidden = candidate?.isConnected
      ? candidate.closest<HTMLElement>('[data-iris-column-fade][aria-hidden="true"]')
      : null
    if (candidateHidden && candidateHidden.closest('[data-iris-table]') === table) {
      return candidateHidden
    }
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

  const recoverFocus = (
    candidate: HTMLElement | null,
    rememberedTable: HTMLElement | null,
    rememberedCell: { row: string; column: string } | null,
  ): void => {
    if (
      disposed ||
      typeof document === 'undefined' ||
      typeof HTMLElement === 'undefined' ||
      (document.activeElement !== candidate && document.activeElement !== document.body)
    ) {
      return
    }
    const table = candidate?.closest<HTMLElement>('[data-iris-table]') ?? rememberedTable
    if (!table) return
    if (rememberedTable && table !== rememberedTable) return
    const hidden = findHiddenFocusCell(table, candidate, rememberedCell)
    if (!hidden) return
    const row = hidden.dataset.gridRow
    if (row !== undefined) {
      const currentColumn = Number(hidden.dataset.gridCol)
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
      if (alternatives[0]) {
        alternatives[0].focus()
        return
      }
    }
    if (document.activeElement === candidate || hidden.contains(document.activeElement)) {
      candidate?.blur()
    }
  }

  const scheduleFade = (): void => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      // The presentation enhancement fails closed to the core's instant update.
      clear()
      return
    }

    // A reversal restarts the two-frame FLIP from the latest overlay. Invalidate
    // the old callbacks so a stale frame cannot clear the new schedule.
    if (flipRaf !== null) {
      if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(flipRaf)
      flipRaf = null
    }
    const generation = ++scheduleGeneration
    flipRaf = window.requestAnimationFrame(() => {
      if (generation !== scheduleGeneration || disposed) return
      flipRaf = null
      flipRaf = window.requestAnimationFrame(() => {
        if (generation !== scheduleGeneration || disposed) return
        flipRaf = null
        const candidate = focusCandidate
        const rememberedTable = focusTable
        const rememberedCell = focusGridCell
        setOverlay(advanceColumnFade(overlayValue) ?? overlayValue)
        queueMicrotask(() => {
          if (generation !== scheduleGeneration || disposed) return
          recoverFocus(candidate, rememberedTable, rememberedCell)
          focusCandidate = null
          focusTable = null
          focusGridCell = null
        })
      })
    })

    if (commitTimer !== null) clearTimeout(commitTimer)
    commitTimer = setTimeout(() => {
      if (generation !== scheduleGeneration || disposed) return
      commitTimer = null
      setOverlay(commitColumnFade(overlayValue, options.visibility() ?? {}) ?? overlayValue)
    }, FADE_DURATION_MS)
  }

  createEffect(() => {
    const next = options.visibility() ?? {}
    const enabled = options.enabled() && !reducedMotion()
    if (!initialized) {
      previous = next
      initialized = true
      if (!enabled) clear()
      return
    }

    const before = previous
    previous = next
    if (!enabled) {
      clear()
      return
    }

    const nextOverlay = startColumnFade(
      before,
      next,
      overlayValue,
      (key) => topLevelColumn(key) !== undefined,
    )
    if (!nextOverlay) return

    captureFocus()
    setOverlay(nextOverlay)
    scheduleFade()
  })

  onCleanup(() => {
    disposed = true
    cancelSchedule()
  })

  const effectiveVisibility = createMemo<ColumnVisibility>(() =>
    mergeColumnFadeVisibility(options.visibility(), overlay()),
  )

  const fadeByLeaf = createMemo<ColumnFadeOverlay>(() =>
    expandColumnFadeToLeaves(overlay(), options.columns()),
  )

  const entryOf = (column: IrisTableColumn<Row>): ColumnFadeEntry | undefined =>
    overlay()[column.key] ?? fadeByLeaf()[column.key]
  const columnFadeStyle = (column: IrisTableColumn<Row>): JSX.CSSProperties | null => {
    const entry = entryOf(column)
    return entry && isColumnFadeCollapsed(entry) ? { opacity: 0 } : null
  }
  const columnFadeAttrs = (column: IrisTableColumn<Row>): ColumnFadeAttrs => {
    const hidden = columnFadeStyle(column) !== null
    return {
      'data-iris-column-fade': entryOf(column)?.dir,
      'aria-hidden': hidden ? 'true' : undefined,
      inert: hidden || undefined,
    }
  }
  const rememberFocus = (row: number, column: number): void => {
    if (typeof document === 'undefined' || typeof HTMLElement === 'undefined') return
    const active = document.activeElement
    if (!(active instanceof HTMLElement)) return
    const table = active.closest<HTMLElement>('[data-iris-table]')
    if (!table) return
    focusCandidate = active
    focusTable = table
    focusGridCell = { row: String(row), column: String(column) }
  }

  return {
    effectiveVisibility,
    fadeByLeaf,
    columnFadeAttr: (column) => entryOf(column)?.dir,
    columnFadeStyle,
    columnFadeAttrs,
    columnFadeActive: () => options.enabled() && Object.keys(overlay()).length > 0,
    isCollapsed: (key) => {
      const entry = fadeByLeaf()[key]
      return entry !== undefined && isColumnFadeCollapsed(entry)
    },
    rememberFocus,
  }
}
