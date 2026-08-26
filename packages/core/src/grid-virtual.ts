import type { GridFeature, GridMethod } from './grid'
import {
  createVirtualizer,
  type Virtualizer,
  type VirtualizerConfig,
  type VirtualizerState,
} from './virtualizer'

export interface GridVirtualRangeChange {
  /** First rendered item index, inclusive. */
  readonly start: number
  /** Last rendered item index, exclusive. */
  readonly end: number
  readonly totalSize: number
}

export const GRID_VIRTUAL_RANGE_CHANGE_EVENT = 'virtual:range-change'

export interface GridVirtualFeatureOptions extends VirtualizerConfig {
  readonly onRangeChange?: (change: GridVirtualRangeChange) => void
}

/** Feature-owned virtualizer used by framework viewport bridges. */
export type GridVirtualModel = Virtualizer

export interface GridVirtualMethods {
  /** Adapter bridge: the feature-owned framework-agnostic controller. */
  getVirtualModel(): GridVirtualModel
  getVirtualState(): VirtualizerState
  setVirtualScroll(offset: number): void
  setVirtualViewportSize(size: number): void
  setVirtualBuffer(buffer: number): void
  setVirtualFixedSize(size: number | null): void
  setVirtualCount(count: number): void
  replaceVirtualData(count: number): void
  measureVirtualItem(index: number, size: number): void
  remeasureVirtual(): void
  scrollToIndex(index: number, align?: 'start' | 'center' | 'end'): number
  scrollToOffset(offset: number): number
}

function finiteNonNegative(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(0, value) : fallback
}

function finiteCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

function normalizeFixedSize(size: number | null | undefined): number | null {
  return size !== null && size !== undefined && Number.isFinite(size) && size > 0 ? size : null
}

function normalizeVirtualizerConfig(options: VirtualizerConfig): VirtualizerConfig {
  const estimate = options.estimateSize
  return {
    ...options,
    count: finiteCount(options.count),
    estimateSize:
      typeof estimate === 'function'
        ? (index: number) => finiteNonNegative(estimate(index), 0)
        : finiteNonNegative(estimate, 0),
    viewportSize: finiteNonNegative(options.viewportSize, 0),
    scrollOffset: finiteNonNegative(options.scrollOffset, 0),
    buffer: finiteNonNegative(options.buffer, 0),
    // A zero fixed size cannot describe a visible fixed-size row. Treat it as
    // variable mode instead of allowing the closed-form range to produce a
    // negative end index or NaN offsets.
    fixedSize: normalizeFixedSize(options.fixedSize),
  }
}

export function createGridVirtualModel(options: VirtualizerConfig): GridVirtualModel {
  return createVirtualizer(normalizeVirtualizerConfig(options))
}

function rangeOf(state: VirtualizerState): GridVirtualRangeChange {
  return {
    start: state.startIndex,
    end: state.endIndex < 0 ? 0 : state.endIndex + 1,
    totalSize: state.totalSize,
  }
}

function sameRange(a: GridVirtualRangeChange, b: GridVirtualRangeChange): boolean {
  return a.start === b.start && a.end === b.end && a.totalSize === b.totalSize
}

/** Built-in virtualization capability: window state, measurements and scrolling methods. */
export function createGridVirtualFeature<
  Row extends Record<string, unknown> = Record<string, unknown>,
>(options: GridVirtualFeatureOptions): GridFeature<Row> {
  return {
    name: 'virtual',
    setup(context) {
      const model = createGridVirtualModel(options)
      let lastRange = rangeOf(model.getState())
      const unsubscribe = model.subscribe((state) => {
        const next = rangeOf(state)
        if (sameRange(lastRange, next)) return
        lastRange = { ...next }
        options.onRangeChange?.({ ...next })
        context.emit(GRID_VIRTUAL_RANGE_CHANGE_EVENT, { ...next })
      })
      const methods: GridVirtualMethods = {
        getVirtualModel: () => model,
        getVirtualState: () => model.getState(),
        setVirtualScroll: (offset) => model.setScroll(finiteNonNegative(offset, 0)),
        setVirtualViewportSize: (size) => model.setViewportSize(finiteNonNegative(size, 0)),
        setVirtualBuffer: (buffer) => model.setBuffer(finiteNonNegative(buffer, 0)),
        setVirtualFixedSize: (size) => model.setFixedSize(normalizeFixedSize(size)),
        setVirtualCount: (count) => model.setCount(finiteCount(count)),
        replaceVirtualData: (count) => model.replaceData(finiteCount(count)),
        measureVirtualItem: (index, size) =>
          model.measure(
            Number.isFinite(index) ? Math.trunc(index) : -1,
            finiteNonNegative(size, 0),
          ),
        remeasureVirtual: () => model.remeasure(),
        scrollToIndex: (index, align) => model.scrollToIndex(finiteCount(index), align),
        scrollToOffset: (offset) => model.scrollToOffset(finiteNonNegative(offset, 0)),
      }
      return {
        methods: methods as unknown as Readonly<Record<string, GridMethod>>,
        dispose: unsubscribe,
      }
    },
  }
}
