import type {
  CmsWorkspaceDefinition,
  CmsWorkspaceRecord,
  CmsWorkspaceRoute,
  CmsWorkspaceState,
  CmsWorkspaceTone,
} from './workspace-types'

const record = (
  id: string,
  cells: string[],
  group: string,
  status: string,
  tone: CmsWorkspaceTone,
): CmsWorkspaceRecord => ({ id, cells, group, status, tone })

const cloneRecord = (item: CmsWorkspaceRecord): CmsWorkspaceRecord => ({
  ...item,
  cells: [...item.cells],
})

const updateRecord = (
  records: readonly CmsWorkspaceRecord[],
  id: string,
  update: (item: CmsWorkspaceRecord) => CmsWorkspaceRecord,
): CmsWorkspaceRecord[] =>
  records.map((item) => (item.id === id ? update(cloneRecord(item)) : item))

type WorkspaceAction = (
  state: CmsWorkspaceState,
  definition: CmsWorkspaceDefinition,
  sequence: number,
) => Partial<CmsWorkspaceState>

type WorkspaceRowAction = (
  state: CmsWorkspaceState,
  item: CmsWorkspaceRecord,
) => Partial<CmsWorkspaceState>

export const primaryActions: Record<CmsWorkspaceRoute, WorkspaceAction> = {
  articles: (state, _definition, sequence) => {
    const title = `Untitled draft ${sequence}`
    return {
      records: [
        record(`article-${sequence}`, [title, 'You', 'Just now'], 'Draft', 'Draft', 'warning'),
        ...state.records,
      ],
      selectedId: `article-${sequence}`,
      notice: `Created “${title}”.`,
    }
  },
  categories: (state, _definition, sequence) => {
    const title = `New category ${sequence}`
    return {
      records: [
        record(
          `category-${sequence}`,
          [title, `new-category-${sequence}`, '0'],
          'Empty',
          'Empty',
          'neutral',
        ),
        ...state.records,
      ],
      selectedId: `category-${sequence}`,
      notice: `Added “${title}” to the taxonomy.`,
    }
  },
  media: (state, _definition, sequence) => {
    const title = `campaign-${sequence}.png`
    return {
      records: [
        record(`media-${sequence}`, [title, 'Image', '1.2 MB'], 'Image', 'Processing', 'warning'),
        ...state.records,
      ],
      selectedId: `media-${sequence}`,
      notice: `Queued “${title}” for processing.`,
    }
  },
  roles: (state, _definition, sequence) => {
    const title = `Custom role ${sequence}`
    return {
      records: [
        record(`role-${sequence}`, [title, '0', 'Limited'], 'Custom', 'Limited', 'warning'),
        ...state.records,
      ],
      selectedId: `role-${sequence}`,
      notice: `Created “${title}” with limited access.`,
    }
  },
  overview: (state, _definition, sequence) => ({
    metrics: state.metrics.map((metric, index) => ({
      ...metric,
      value:
        index === 0
          ? `${(24.8 + sequence / 10).toFixed(1)}k`
          : index === 1
            ? `${68 + sequence}%`
            : `${(4.7 + sequence / 10).toFixed(1)}%`,
    })),
    notice: 'Analytics metrics refreshed from the demo data source.',
  }),
  reports: (state, _definition, sequence) => {
    const title = `Ad-hoc report ${sequence}`
    return {
      records: [
        record(`report-${sequence}`, [title, 'You', 'On demand'], 'Manual', 'Ready', 'success'),
        ...state.records,
      ],
      selectedId: `report-${sequence}`,
      notice: `Generated “${title}”.`,
    }
  },
  calendar: (state, definition, sequence) => {
    const period = definition.periods?.[state.periodIndex] ?? 'July 2026'
    const title = `Editorial event ${sequence}`
    return {
      records: [
        record(
          `event-${sequence}`,
          [title, `${period.slice(0, 3)} 18`, 'Content'],
          'Content',
          'Planned',
          'primary',
        ),
        ...state.records,
      ],
      selectedId: `event-${sequence}`,
      notice: `Added “${title}” to ${period}.`,
    }
  },
  'audit-log': (state) => ({
    notice: `Exported ${visibleWorkspaceRecords(state).length} visible audit events.`,
  }),
}

export const rowActions: Record<CmsWorkspaceRoute, WorkspaceRowAction> = {
  articles: (state, item) => {
    const published = item.status !== 'Published'
    return {
      records: updateRecord(state.records, item.id, (current) => ({
        ...current,
        group: published ? 'Published' : 'Draft',
        status: published ? 'Published' : 'Draft',
        tone: published ? 'success' : 'warning',
        cells: [current.cells[0]!, current.cells[1]!, 'Just now'],
      })),
      selectedId: item.id,
      notice: `${item.cells[0]} is now ${published ? 'published' : 'a draft'}.`,
    }
  },
  categories: (state, item) => {
    const count = Number.parseInt(item.cells[2] ?? '0', 10) + 1
    return {
      records: updateRecord(state.records, item.id, (current) => ({
        ...current,
        cells: [current.cells[0]!, current.cells[1]!, String(count)],
        group: 'Active',
        status: 'Active',
        tone: 'success',
      })),
      selectedId: item.id,
      notice: `Attached an article to ${item.cells[0]}.`,
    }
  },
  media: (state, item) => {
    const archived = item.status !== 'Archived'
    return {
      records: updateRecord(state.records, item.id, (current) => ({
        ...current,
        status: archived ? 'Archived' : 'Ready',
        tone: archived ? 'neutral' : 'success',
      })),
      selectedId: item.id,
      notice: `${archived ? 'Archived' : 'Restored'} ${item.cells[0]}.`,
    }
  },
  roles: (state, item) => {
    const full = item.cells[2] !== 'Full'
    return {
      records: updateRecord(state.records, item.id, (current) => ({
        ...current,
        cells: [current.cells[0]!, current.cells[1]!, full ? 'Full' : 'Limited'],
        status: full ? 'Full access' : 'Limited',
        tone: full ? 'success' : 'warning',
      })),
      selectedId: item.id,
      notice: `${item.cells[0]} now has ${full ? 'full' : 'limited'} access.`,
    }
  },
  overview: (state, item) => ({
    records: updateRecord(state.records, item.id, (current) => ({
      ...current,
      status: 'Inspecting',
      tone: 'primary',
    })),
    selectedId: item.id,
    notice: `Opened the ${item.cells[0]} channel breakdown.`,
  }),
  reports: (state, item) => ({
    records: updateRecord(state.records, item.id, (current) => ({
      ...current,
      cells: [current.cells[0]!, current.cells[1]!, 'Queued now'],
      status: 'Running',
      tone: 'primary',
    })),
    selectedId: item.id,
    notice: `Queued “${item.cells[0]}” to run now.`,
  }),
  calendar: (state, item) => {
    const currentDay = Number.parseInt(item.cells[1]?.slice(-2) ?? '1', 10)
    const nextDay = String(Math.min(currentDay + 1, 28)).padStart(2, '0')
    return {
      records: updateRecord(state.records, item.id, (current) => ({
        ...current,
        cells: [
          current.cells[0]!,
          `${current.cells[1]?.slice(0, -2)}${nextDay}`,
          current.cells[2]!,
        ],
        status: 'Rescheduled',
        tone: 'warning',
      })),
      selectedId: item.id,
      notice: `Moved “${item.cells[0]}” forward one day.`,
    }
  },
  'audit-log': (state, item) => ({
    records: updateRecord(state.records, item.id, (current) => ({
      ...current,
      status: 'Reviewed',
      tone: 'neutral',
    })),
    selectedId: item.id,
    notice: `Marked the ${item.cells[1]} event as reviewed.`,
  }),
}

export function visibleWorkspaceRecords(state: CmsWorkspaceState): CmsWorkspaceRecord[] {
  const query = state.query.trim().toLocaleLowerCase()
  return state.records.filter((item) => {
    if (state.filter !== 'all' && item.group !== state.filter) return false
    if (!query) return true
    return [...item.cells, item.status].some((value) => value.toLocaleLowerCase().includes(query))
  })
}
