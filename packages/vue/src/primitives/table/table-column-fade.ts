import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
  type ComputedRef,
  type Ref,
} from 'vue'
import { flattenLeafColumns } from '@iris-ui-kit/core'
import type { IrisTableColumn, IrisTableColumnVisibility } from './types'

type TableRow = Record<string, unknown>
type TableColumn = IrisTableColumn<TableRow>
type ColumnFadeEntry = { dir: 'in' | 'out'; phase: 'pending' | 'run' }
type ColumnFadeOverlay = Record<string, ColumnFadeEntry>

export interface TableColumnFadeOptions {
  /** The already bridged Grid Core visibility snapshot. */
  visibility: () => IrisTableColumnVisibility
  enabled: () => boolean
  reducedMotion: Readonly<Ref<boolean>>
  columns: ComputedRef<TableColumn[]>
}

export interface TableColumnFadeController {
  displayColumns: ComputedRef<TableColumn[]>
  fadeByLeaf: ComputedRef<ColumnFadeOverlay>
  columnFadeAttr: (column: TableColumn) => 'in' | 'out' | undefined
  columnFadeStyle: (column: TableColumn) => Record<string, string> | null
  columnFadeAttrs: (column: TableColumn) => {
    'data-iris-column-fade': 'in' | 'out' | undefined
    'aria-hidden': 'true' | undefined
    inert: '' | undefined
  }
  columnFadeActive: ComputedRef<boolean>
  isCollapsed: (key: string) => boolean
}

const FADE_DURATION_MS = 200

/**
 * Vue-only visibility presentation state. Grid Core remains the single
 * visibility authority; this overlay only keeps changed columns mounted while
 * their DOM tracks and opacity move between the two settled states.
 */
export function createTableColumnFade(options: TableColumnFadeOptions): TableColumnFadeController {
  const fadeOverlay = shallowRef<ColumnFadeOverlay>({})
  // A sparse controlled map still has a visible baseline: absence means
  // visible. In particular, undefined -> { key: false } is a real first diff.
  const previousVisibility = ref<IrisTableColumnVisibility>({ ...options.visibility() })
  let fadeFlipRaf: number | null = null
  let fadeCommitTimer: ReturnType<typeof setTimeout> | null = null
  let fadeFocusCandidate: Element | null = null
  let disposed = false

  const topLevelColumn = (key: string): TableColumn | undefined =>
    options.columns.value.find((column) => column.key === key)

  const fadeFlip = (current: ColumnFadeOverlay): ColumnFadeOverlay | undefined => {
    let changed = false
    const next: ColumnFadeOverlay = {}
    for (const [key, entry] of Object.entries(current)) {
      if (entry.phase === 'pending') {
        next[key] = { dir: entry.dir, phase: 'run' }
        changed = true
      } else {
        next[key] = entry
      }
    }
    return changed ? next : undefined
  }

  const fadeCommit = (current: ColumnFadeOverlay): ColumnFadeOverlay | undefined => {
    let changed = false
    const next: ColumnFadeOverlay = {}
    const visibility = options.visibility()
    for (const [key, entry] of Object.entries(current)) {
      const visible = visibility[key] !== false
      const done = entry.dir === 'out' ? !visible : visible
      if (done) changed = true
      else next[key] = entry
    }
    return changed ? next : undefined
  }

  const cancelFadeSchedule = (): void => {
    fadeFocusCandidate = null
    if (fadeFlipRaf !== null) {
      if (typeof globalThis.cancelAnimationFrame === 'function') {
        globalThis.cancelAnimationFrame(fadeFlipRaf)
      }
      fadeFlipRaf = null
    }
    if (fadeCommitTimer !== null) {
      clearTimeout(fadeCommitTimer)
      fadeCommitTimer = null
    }
  }

  const recoverFocus = (candidate: Element | null): void => {
    if (
      disposed ||
      typeof document === 'undefined' ||
      typeof HTMLElement === 'undefined' ||
      !(candidate instanceof HTMLElement)
    )
      return
    const hidden = candidate.closest<HTMLElement>('[data-iris-column-fade][inert]')
    if (!hidden) return
    const root = hidden.closest<HTMLElement>('[data-iris-table]')
    const rowIndex = hidden.dataset.gridRow
    if (root && rowIndex !== undefined) {
      const currentColumn = Number(hidden.dataset.gridCol)
      const alternatives = Array.from(
        root.querySelectorAll<HTMLElement>('[data-grid-row][data-grid-col]'),
      )
        .filter((cell) => cell.dataset.gridRow === rowIndex && !cell.hasAttribute('inert'))
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
      candidate.blur()
    }
  }

  watch(
    [options.visibility, options.enabled, options.reducedMotion],
    ([visibility, fadeEnabled, motion]) => {
      const next = visibility
      const previous = previousVisibility.value
      previousVisibility.value = { ...next }
      if (!fadeEnabled || motion) {
        cancelFadeSchedule()
        fadeOverlay.value = {}
        return
      }

      const overlay = { ...fadeOverlay.value }
      const activeElement = typeof document !== 'undefined' ? document.activeElement : null
      const changedKeys = new Set<string>()
      for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
        // Visibility is intentionally evaluated at the same top-level boundary
        // as the existing table renderer. A leaf key cannot animate a group
        // that the current columnVisibility semantics leave mounted.
        if (!topLevelColumn(key)) continue
        const wasVisible = previous[key] !== false
        const isVisible = next[key] !== false
        if (wasVisible === isVisible) continue
        overlay[key] = { dir: isVisible ? 'in' : 'out', phase: 'pending' }
        changedKeys.add(key)
      }
      if (changedKeys.size === 0) return

      fadeOverlay.value = overlay
      fadeFocusCandidate = activeElement
      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
        // Fail closed when the browser scheduling primitive is unavailable.
        cancelFadeSchedule()
        fadeOverlay.value = {}
        return
      }

      if (fadeFlipRaf === null) {
        fadeFlipRaf = window.requestAnimationFrame(() => {
          if (disposed) return
          fadeFlipRaf = null
          fadeFlipRaf = window.requestAnimationFrame(() => {
            if (disposed) return
            fadeFlipRaf = null
            const candidate = fadeFocusCandidate
            fadeOverlay.value = fadeFlip(fadeOverlay.value) ?? fadeOverlay.value
            void nextTick(() => recoverFocus(candidate))
          })
        })
      }
      if (fadeCommitTimer !== null) clearTimeout(fadeCommitTimer)
      fadeCommitTimer = setTimeout(() => {
        if (disposed) return
        fadeCommitTimer = null
        fadeOverlay.value = fadeCommit(fadeOverlay.value) ?? fadeOverlay.value
      }, FADE_DURATION_MS)
    },
  )

  onBeforeUnmount(() => {
    disposed = true
    cancelFadeSchedule()
  })

  const effectiveVisibility = computed<IrisTableColumnVisibility>(() => {
    if (Object.keys(fadeOverlay.value).length === 0) return options.visibility()
    const merged = { ...options.visibility() }
    for (const key of Object.keys(fadeOverlay.value)) merged[key] = true
    return merged
  })

  const displayColumns = computed<TableColumn[]>(() => {
    const visibility = effectiveVisibility.value
    if (Object.keys(visibility).length === 0) return options.columns.value
    return options.columns.value.filter((column) => visibility[column.key] !== false)
  })

  const fadeByLeaf = computed<ColumnFadeOverlay>(() => {
    if (Object.keys(fadeOverlay.value).length === 0) return {}
    const out: ColumnFadeOverlay = {}
    for (const [key, entry] of Object.entries(fadeOverlay.value)) {
      const top = topLevelColumn(key)
      if (!top) continue
      const leaves = top.children && top.children.length > 0 ? flattenLeafColumns([top]) : [top]
      for (const leaf of leaves) out[leaf.key] = entry
    }
    return out
  })

  const columnFadeAttr = (column: TableColumn): 'in' | 'out' | undefined =>
    (fadeOverlay.value[column.key] ?? fadeByLeaf.value[column.key])?.dir

  const columnFadeStyle = (column: TableColumn): Record<string, string> | null => {
    const entry = fadeOverlay.value[column.key] ?? fadeByLeaf.value[column.key]
    if (!entry) return null
    const hidden = entry.dir === 'out' ? entry.phase === 'run' : entry.phase === 'pending'
    return hidden ? { opacity: '0' } : null
  }

  const columnFadeAttrs = (column: TableColumn) => {
    const hidden = columnFadeStyle(column) !== null
    return {
      'data-iris-column-fade': columnFadeAttr(column),
      'aria-hidden': hidden ? ('true' as const) : undefined,
      inert: hidden ? ('' as const) : undefined,
    }
  }

  const columnFadeActive = computed(
    () => options.enabled() === true && Object.keys(fadeByLeaf.value).length > 0,
  )

  const isCollapsed = (key: string): boolean => {
    const entry = fadeByLeaf.value[key]
    return Boolean(
      entry &&
      ((entry.dir === 'out' && entry.phase === 'run') ||
        (entry.dir === 'in' && entry.phase === 'pending')),
    )
  }

  return {
    displayColumns,
    fadeByLeaf,
    columnFadeAttr,
    columnFadeStyle,
    columnFadeAttrs,
    columnFadeActive,
    isCollapsed,
  }
}
