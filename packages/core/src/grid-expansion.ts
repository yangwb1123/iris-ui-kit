import {
  createExpansion,
  type ExpansionConfig,
  type ExpansionMode,
  type ExpansionModel,
} from './expansion'
import type { GridFeature, GridMethod } from './grid'

export type GridExpansionKey = string | number

export const GRID_EXPANSION_CHANGE_EVENT = 'expansion:change'

export interface GridExpansionChange<K extends GridExpansionKey = GridExpansionKey> {
  readonly expandedKeys: readonly K[]
}

export interface GridExpansionFeatureOptions<
  K extends GridExpansionKey = string,
> extends ExpansionConfig<K> {
  /** Keys expanded by the no-argument expand-all method. */
  readonly getKeys?: () => readonly K[]
}

export interface GridExpansionMethods<K extends GridExpansionKey = string> {
  /** Adapter bridge: the feature-owned framework-agnostic controller. */
  getExpansionModel(): ExpansionModel<K>
  getExpandedKeys(): K[]
  setExpandedKeys(keys: K[]): void
  mergeExpandedKeys(keys: K[]): void
  isRowExpanded(key: K): boolean
  toggleRowExpansion(key: K): void
  expandRow(key: K): void
  collapseRow(key: K): void
  expandAllRows(): void
  collapseAllRows(): void
}

/** Built-in expansion capability: controller, methods, and change event. */
export function createGridExpansionFeature<
  Row extends Record<string, unknown> = Record<string, unknown>,
  K extends GridExpansionKey = string,
>(options: GridExpansionFeatureOptions<K> = {}): GridFeature<Row> {
  return {
    name: 'expansion',
    setup(context) {
      const model = createExpansion<K>({
        mode: options.mode,
        defaultExpanded: options.defaultExpanded,
        onChange(keys) {
          options.onChange?.([...keys])
          context.emit<GridExpansionChange<K>>(GRID_EXPANSION_CHANGE_EVENT, {
            expandedKeys: [...keys],
          })
        },
      })
      const featureMethods: GridExpansionMethods<K> = {
        getExpansionModel: () => model,
        getExpandedKeys: () => [...model.get()],
        setExpandedKeys: (keys) => model.set(keys),
        mergeExpandedKeys: (keys) => model.merge(keys),
        isRowExpanded: (key) => model.isExpanded(key),
        toggleRowExpansion: (key) => model.toggle(key),
        expandRow: (key) => model.expand(key),
        collapseRow: (key) => model.collapse(key),
        expandAllRows: () => model.expandAll([...(options.getKeys?.() ?? [])]),
        collapseAllRows: () => model.collapseAll(),
      }
      return {
        methods: featureMethods as unknown as Readonly<Record<string, GridMethod>>,
      }
    },
  }
}

export type { ExpansionMode, ExpansionModel }
