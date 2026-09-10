import {
  createCellRange,
  type CellRange,
  type CellRangeController,
  type CellRangeState,
} from './cell-range'
import type { GridFeature, GridMethod } from './grid'

export interface GridRangeChange {
  readonly state: CellRangeState
  readonly range: CellRange | null
}

export const GRID_RANGE_CHANGE_EVENT = 'range:change'

export interface GridRangeFeatureOptions {
  readonly onChange?: (change: GridRangeChange) => void
}

/** Feature-owned range controller used by framework cell/drag bridges. */
export type GridRangeModel = CellRangeController

export interface GridRangeMethods {
  getRangeModel(): GridRangeModel
  getCellRangeState(): CellRangeState
  getCellRange(): CellRange | null
  startCellRange(row: number, column: number): void
  extendCellRange(row: number, column: number): void
  clearCellRange(): void
  isCellInRange(row: number, column: number): boolean
}

function cloneAddress(address: CellRangeState['anchor']): CellRangeState['anchor'] {
  return address ? { ...address } : null
}

function cloneState(state: CellRangeState): CellRangeState {
  return { anchor: cloneAddress(state.anchor), active: cloneAddress(state.active) }
}

function cloneRange(range: CellRange | null): CellRange | null {
  return range ? { start: { ...range.start }, end: { ...range.end } } : null
}

function normalizeCoordinate(value: number): number | null {
  return Number.isFinite(value) ? Math.trunc(value) : null
}

export function createGridRangeModel(): GridRangeModel {
  const model = createCellRange()
  const normalizeAddress = (row: number, column: number): CellRange['start'] | null => {
    const normalizedRow = normalizeCoordinate(row)
    const normalizedColumn = normalizeCoordinate(column)
    return normalizedRow === null || normalizedColumn === null
      ? null
      : { row: normalizedRow, col: normalizedColumn }
  }

  return {
    ...model,
    startRange(row, column) {
      const address = normalizeAddress(row, column)
      if (address) model.startRange(address.row, address.col)
    },
    extendRange(row, column) {
      const address = normalizeAddress(row, column)
      if (address) model.extendRange(address.row, address.col)
    },
    isInRange(row, column) {
      const address = normalizeAddress(row, column)
      return address ? model.isInRange(address.row, address.col) : false
    },
  }
}

/** Optional rectangular selection capability; rendering and pointer capture stay in adapters. */
export function createGridRangeFeature<
  Row extends Record<string, unknown> = Record<string, unknown>,
>(options: GridRangeFeatureOptions = {}): GridFeature<Row> {
  return {
    name: 'range',
    setup(context) {
      const model = createGridRangeModel()
      const unsubscribe = model.subscribe((state) => {
        const change: GridRangeChange = {
          state: cloneState(state),
          range: cloneRange(model.getRange()),
        }
        options.onChange?.({ state: cloneState(change.state), range: cloneRange(change.range) })
        context.emit(GRID_RANGE_CHANGE_EVENT, change)
      })
      const methods: GridRangeMethods = {
        getRangeModel: () => model,
        getCellRangeState: () => cloneState(model.getState()),
        getCellRange: () => cloneRange(model.getRange()),
        startCellRange: (row, column) => model.startRange(row, column),
        extendCellRange: (row, column) => model.extendRange(row, column),
        clearCellRange: () => model.clearRange(),
        isCellInRange: (row, column) => model.isInRange(row, column),
      }
      return {
        methods: methods as unknown as Readonly<Record<string, GridMethod>>,
        dispose: unsubscribe,
      }
    },
  }
}
