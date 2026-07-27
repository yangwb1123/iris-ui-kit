import { describe, expect, it } from 'vitest'
import {
  CMS_WORKSPACE_DEFINITIONS,
  CMS_WORKSPACE_ROUTES,
  collectCmsLeafKeys,
  createCmsNavigation,
  createCmsWorkspaceController,
  isCmsPageRoute,
  isCmsWorkspaceRoute,
} from './workspaces'

describe('CMS workspace contracts', () => {
  it('defines every real workspace route with filterable, actionable records', () => {
    expect(Object.keys(CMS_WORKSPACE_DEFINITIONS)).toEqual([...CMS_WORKSPACE_ROUTES])

    for (const route of CMS_WORKSPACE_ROUTES) {
      const definition = CMS_WORKSPACE_DEFINITIONS[route]
      expect(definition.key).toBe(route)
      expect(definition.title).not.toBe('')
      expect(definition.description).not.toContain('placeholder')
      expect(definition.primaryActionLabel).not.toBe('')
      expect(definition.rowActionLabel).not.toBe('')
      expect(definition.records.length).toBeGreaterThan(0)
      expect(definition.filters[0]).toEqual({ value: 'all', label: 'All' })
      for (const item of definition.records) {
        expect(item.cells).toHaveLength(definition.columns.length)
        expect(definition.filters.some((filter) => filter.value === item.group)).toBe(true)
      }
    }
  })

  it('covers every leaf in both actual CMS navigation variants', () => {
    const standard = collectCmsLeafKeys(createCmsNavigation())
    const extended = collectCmsLeafKeys(createCmsNavigation({ auditLog: true }))

    expect(standard).toEqual([
      'dashboard',
      'articles',
      'categories',
      'media',
      'all-users',
      'roles',
      'overview',
      'reports',
      'calendar',
      'settings',
    ])
    expect(extended).toEqual([
      'dashboard',
      'articles',
      'categories',
      'media',
      'all-users',
      'roles',
      'overview',
      'reports',
      'calendar',
      'settings',
      'audit-log',
    ])
    expect([...standard, ...extended].every(isCmsPageRoute)).toBe(true)
    expect(standard.includes('audit-log')).toBe(false)
    expect(extended.includes('audit-log')).toBe(true)
  })

  it('recognizes workspace routes without accepting shell-only or unknown keys', () => {
    expect(CMS_WORKSPACE_ROUTES.every(isCmsWorkspaceRoute)).toBe(true)
    expect(isCmsWorkspaceRoute('dashboard')).toBe(false)
    expect(isCmsWorkspaceRoute('missing')).toBe(false)
  })

  it('filters articles and toggles their publish state', () => {
    const controller = createCmsWorkspaceController('articles')

    controller.setFilter('Draft')
    expect(controller.visibleRecords().map((item) => item.cells[0])).toEqual([
      'Token migration playbook',
    ])
    controller.setQuery('token')
    const draft = controller.visibleRecords()[0]!
    controller.runRowAction(draft.id)

    expect(controller.visibleRecords()).toEqual([])
    expect(controller.store.getState().notice).toContain('published')
    expect(controller.selectedRecord()?.status).toBe('Published')
  })

  it('creates taxonomy records and attaches content through shared actions', () => {
    const controller = createCmsWorkspaceController('categories')
    controller.runPrimaryAction()

    const created = controller.selectedRecord()
    expect(created?.cells).toEqual(['New category 4', 'new-category-4', '0'])
    controller.runRowAction(created!.id)
    expect(controller.selectedRecord()).toMatchObject({
      cells: ['New category 4', 'new-category-4', '1'],
      group: 'Active',
      status: 'Active',
    })
  })

  it('runs route-specific primary and row actions for every workspace', () => {
    for (const route of CMS_WORKSPACE_ROUTES) {
      const controller = createCmsWorkspaceController(route)
      const firstId = controller.store.getState().records[0]!.id
      const before = controller.store.getState()

      controller.runPrimaryAction()
      const afterPrimary = controller.store.getState()
      expect(afterPrimary.notice).not.toBeNull()
      expect(afterPrimary).not.toBe(before)

      controller.runRowAction(firstId)
      const afterRow = controller.store.getState()
      expect(afterRow.selectedId).toBe(firstId)
      expect(afterRow.notice).not.toBeNull()
    }
  })

  it('refreshes analytics metrics without fabricating table rows', () => {
    const controller = createCmsWorkspaceController('overview')
    const before = controller.store.getState()
    controller.runPrimaryAction()
    const after = controller.store.getState()

    expect(after.records).toEqual(before.records)
    expect(after.metrics).not.toEqual(before.metrics)
    expect(after.notice).toContain('refreshed')
  })

  it('navigates calendar periods circularly and schedules in the active period', () => {
    const controller = createCmsWorkspaceController('calendar')
    controller.shiftPeriod(1)
    expect(controller.store.getState().periodIndex).toBe(2)
    controller.shiftPeriod(1)
    expect(controller.store.getState().periodIndex).toBe(0)

    controller.runPrimaryAction()
    expect(controller.selectedRecord()?.cells[1]).toBe('Jun 18')
    expect(controller.store.getState().notice).toContain('June 2026')
  })

  it('exports only the visible audit trail and lets an entry be reviewed', () => {
    const controller = createCmsWorkspaceController('audit-log')
    controller.setFilter('Attention')
    controller.runPrimaryAction()
    expect(controller.store.getState().notice).toBe('Exported 1 visible audit events.')

    const event = controller.visibleRecords()[0]!
    controller.runRowAction(event.id)
    expect(controller.selectedRecord()?.status).toBe('Reviewed')
    expect(controller.store.getState().notice).toContain('reviewed')
  })

  it('keeps each controller instance isolated for tab keep-alive', () => {
    const first = createCmsWorkspaceController('reports')
    const second = createCmsWorkspaceController('reports')
    first.runPrimaryAction()

    expect(first.store.getState().records).toHaveLength(4)
    expect(second.store.getState().records).toHaveLength(3)
  })
})
