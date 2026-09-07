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
import {
  advanceColumnFade,
  applyColumnVisibility,
  commitColumnFade,
  expandColumnFadeToLeaves,
  isColumnFadeCollapsed,
  mergeColumnFadeVisibility,
  startColumnFade,
  type ColumnFadeOverlay,
} from '@iris-ui-kit/core'
import type { IrisTableColumn, IrisTableColumnVisibility } from './types'

type TableRow = Record<string, unknown>
type TableColumn = IrisTableColumn<TableRow>

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

      const activeElement = typeof document !== 'undefined' ? document.activeElement : null
      const overlay = startColumnFade(
        previous,
        next,
        fadeOverlay.value,
        (key) => topLevelColumn(key) !== undefined,
      )
      if (!overlay) return

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
            fadeOverlay.value = advanceColumnFade(fadeOverlay.value) ?? fadeOverlay.value
            void nextTick(() => recoverFocus(candidate))
          })
        })
      }
      if (fadeCommitTimer !== null) clearTimeout(fadeCommitTimer)
      fadeCommitTimer = setTimeout(() => {
        if (disposed) return
        fadeCommitTimer = null
        fadeOverlay.value =
          commitColumnFade(fadeOverlay.value, options.visibility()) ?? fadeOverlay.value
      }, FADE_DURATION_MS)
    },
  )

  onBeforeUnmount(() => {
    disposed = true
    cancelFadeSchedule()
  })

  const effectiveVisibility = computed<IrisTableColumnVisibility>(
    () => mergeColumnFadeVisibility(options.visibility(), fadeOverlay.value) ?? {},
  )

  const displayColumns = computed<TableColumn[]>(() => {
    const visibility = effectiveVisibility.value
    return applyColumnVisibility(options.columns.value, visibility)
  })

  const fadeByLeaf = computed<ColumnFadeOverlay>(() =>
    expandColumnFadeToLeaves(fadeOverlay.value, options.columns.value),
  )

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
    return entry !== undefined && isColumnFadeCollapsed(entry)
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
