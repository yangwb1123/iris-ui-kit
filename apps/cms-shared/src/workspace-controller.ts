import { createStore } from '@iris-ui-kit/core'
import { primaryActions, rowActions, visibleWorkspaceRecords } from './workspace-actions'
import { CMS_WORKSPACE_DEFINITIONS } from './workspace-definitions'
import {
  CMS_WORKSPACE_ROUTES,
  type CmsWorkspaceController,
  type CmsWorkspaceMetric,
  type CmsWorkspaceRecord,
  type CmsWorkspaceRoute,
  type CmsWorkspaceState,
} from './workspace-types'

const cloneRecord = (item: CmsWorkspaceRecord): CmsWorkspaceRecord => ({
  ...item,
  cells: [...item.cells],
})

const cloneMetric = (metric: CmsWorkspaceMetric): CmsWorkspaceMetric => ({ ...metric })

export function isCmsWorkspaceRoute(value: string): value is CmsWorkspaceRoute {
  return (CMS_WORKSPACE_ROUTES as readonly string[]).includes(value)
}

export function createCmsWorkspaceController(route: CmsWorkspaceRoute): CmsWorkspaceController {
  const definition = CMS_WORKSPACE_DEFINITIONS[route]
  const store = createStore<CmsWorkspaceState>({
    query: '',
    filter: 'all',
    records: definition.records.map(cloneRecord),
    metrics: (definition.metrics ?? []).map(cloneMetric),
    selectedId: null,
    notice: null,
    periodIndex: definition.periods ? Math.min(1, definition.periods.length - 1) : 0,
  })
  let sequence = definition.records.length

  return {
    definition,
    store,
    visibleRecords: () => visibleWorkspaceRecords(store.getState()),
    selectedRecord: () => {
      const state = store.getState()
      return state.records.find((item) => item.id === state.selectedId)
    },
    setQuery(query) {
      store.setState((state) => ({ ...state, query }))
    },
    setFilter(filter) {
      const valid = definition.filters.some((item) => item.value === filter)
      store.setState((state) => ({ ...state, filter: valid ? filter : 'all' }))
    },
    select(id) {
      store.setState((state) => ({
        ...state,
        selectedId: state.records.some((item) => item.id === id) ? id : null,
      }))
    },
    runPrimaryAction() {
      sequence += 1
      store.setState((state) => ({
        ...state,
        ...primaryActions[route](state, definition, sequence),
      }))
    },
    runRowAction(id) {
      store.setState((state) => {
        const item = state.records.find((candidate) => candidate.id === id)
        return item ? { ...state, ...rowActions[route](state, item) } : state
      })
    },
    shiftPeriod(offset) {
      const periods = definition.periods
      if (!periods || periods.length === 0) return
      store.setState((state) => ({
        ...state,
        periodIndex: (state.periodIndex + offset + periods.length) % periods.length,
        notice: null,
      }))
    },
  }
}
