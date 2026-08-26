import {
  createSelectionModel,
  type SelectionConfig,
  type SelectionKey,
  type SelectionModel,
  type SelectionMode,
} from './selection'
import type { GridFeature, GridMethod } from './grid'

export const GRID_SELECTION_CHANGE_EVENT = 'selection:change'

export interface GridSelectionChange<K extends SelectionKey = SelectionKey> {
  readonly selectedKeys: readonly K[]
}

export interface GridSelectionFeatureOptions<
  K extends SelectionKey = string,
> extends SelectionConfig<K> {
  /** Keys selectable by the no-argument select-all methods. */
  readonly getKeys?: () => readonly K[]
}

export interface GridSelectionMethods<K extends SelectionKey = string> {
  /** Adapter bridge: the feature-owned framework-agnostic controller. */
  getSelectionModel(): SelectionModel<K>
  getSelection(): K[]
  setSelection(keys: K[]): void
  syncSelection(keys: K[]): void
  isRowSelected(key: K): boolean
  toggleRowSelection(key: K): void
  clearSelection(): void
  selectAll(): void
  toggleAllSelection(): void
}

/** First built-in feature: selection controller + methods + one change event. */
export function createGridSelectionFeature<
  Row extends Record<string, unknown> = Record<string, unknown>,
  K extends SelectionKey = string,
>(options: GridSelectionFeatureOptions<K> = {}): GridFeature<Row> {
  return {
    name: 'selection',
    setup(context) {
      const model = createSelectionModel<K>({
        mode: options.mode,
        defaultSelected: options.defaultSelected,
        onChange(keys) {
          options.onChange?.([...keys])
          context.emit<GridSelectionChange<K>>(GRID_SELECTION_CHANGE_EVENT, {
            selectedKeys: [...keys],
          })
        },
      })
      const featureMethods: GridSelectionMethods<K> = {
        getSelectionModel: () => model,
        getSelection: () => [...model.get()],
        setSelection: (keys) => model.set(keys),
        syncSelection: (keys) => {
          const next = normalizedKeys(keys, options.mode ?? 'multiple')
          if (!sameKeys(model.get(), next)) model.sync(next)
        },
        isRowSelected: (key) => model.isSelected(key),
        toggleRowSelection: (key) => model.toggle(key),
        clearSelection: () => model.clear(),
        selectAll() {
          const keys = [...(options.getKeys?.() ?? [])]
          if (keys.length === 0 || keys.every((key) => model.isSelected(key))) return
          model.set([...model.get(), ...keys])
        },
        toggleAllSelection() {
          model.toggleAll(options.getKeys?.() ?? [])
        },
      }
      return {
        methods: featureMethods as unknown as Readonly<Record<string, GridMethod>>,
      }
    },
  }
}

function normalizedKeys<K extends SelectionKey>(keys: readonly K[], mode: SelectionMode): K[] {
  const unique = [...new Set(keys)]
  return mode === 'single' && unique.length > 1 ? [unique[unique.length - 1]!] : unique
}

function sameKeys<K extends SelectionKey>(left: readonly K[], right: readonly K[]): boolean {
  return left.length === right.length && left.every((key, index) => Object.is(key, right[index]))
}

export type { SelectionKey, SelectionModel, SelectionMode }
