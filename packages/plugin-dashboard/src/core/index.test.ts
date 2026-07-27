import { describe, it, expect, vi } from 'vitest'
import { runPlugins } from '@iris-ui-kit/core'
import { createDashboard, dashboardPlugin, dashboardTokens, type DashboardConfig } from './index'

const baseConfig = (): DashboardConfig => ({
  widgets: [
    { id: 'w1', title: 'Widget 1', col: 1, row: 1, colSpan: 1, rowSpan: 1 },
    { id: 'w2', title: 'Widget 2', col: 2, row: 1, colSpan: 2, rowSpan: 1 },
    { id: 'w3', title: 'Widget 3', col: 1, row: 2, colSpan: 1, rowSpan: 2 },
  ],
  columns: 3,
})

describe('createDashboard core', () => {
  it('returns initial state matching the config', () => {
    const store = createDashboard(baseConfig())
    const { widgets, columns } = store.getState()
    expect(widgets).toHaveLength(3)
    expect(widgets[0]!.id).toBe('w1')
    expect(columns).toBe(3)
  })

  it('defaults columns to 3 when not specified', () => {
    const store = createDashboard({ widgets: [] })
    expect(store.getState().columns).toBe(3)
  })

  it('moveWidget updates col and row and notifies subscribers', () => {
    const store = createDashboard(baseConfig())
    const listener = vi.fn()
    store.subscribe(listener)

    store.moveWidget('w1', 3, 2)

    const { widgets } = store.getState()
    const w1 = widgets.find((w) => w.id === 'w1')!
    expect(w1.col).toBe(3)
    expect(w1.row).toBe(2)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('moveWidget fires onMove callback with correct args', () => {
    const onMove = vi.fn()
    const store = createDashboard({ ...baseConfig(), onMove })
    store.moveWidget('w2', 1, 3)
    expect(onMove).toHaveBeenCalledWith('w2', 1, 3)
  })

  it('moveWidget is a no-op when widget does not exist', () => {
    const store = createDashboard(baseConfig())
    const before = store.getState()
    store.moveWidget('nonexistent', 2, 2)
    expect(store.getState()).toBe(before)
  })

  it('moveWidget is a no-op when col and row are unchanged', () => {
    const store = createDashboard(baseConfig())
    const before = store.getState()
    store.moveWidget('w1', 1, 1)
    expect(store.getState()).toBe(before)
  })

  it('addWidget appends a widget and notifies subscribers', () => {
    const store = createDashboard(baseConfig())
    const listener = vi.fn()
    store.subscribe(listener)

    store.addWidget({ id: 'w4', title: 'Widget 4', col: 2, row: 2, colSpan: 1, rowSpan: 1 })

    const { widgets } = store.getState()
    expect(widgets).toHaveLength(4)
    expect(widgets[3]!.id).toBe('w4')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('addWidget is a no-op when a widget with the same id already exists', () => {
    const store = createDashboard(baseConfig())
    const before = store.getState()
    store.addWidget({ id: 'w1', title: 'Duplicate', col: 1, row: 1, colSpan: 1, rowSpan: 1 })
    expect(store.getState()).toBe(before)
  })

  it('removeWidget removes a widget and notifies subscribers', () => {
    const store = createDashboard(baseConfig())
    const listener = vi.fn()
    store.subscribe(listener)

    store.removeWidget('w2')

    const { widgets } = store.getState()
    expect(widgets).toHaveLength(2)
    expect(widgets.find((w) => w.id === 'w2')).toBeUndefined()
    expect(listener).toHaveBeenCalledOnce()
  })

  it('removeWidget is a no-op for a non-existent id', () => {
    const store = createDashboard(baseConfig())
    const before = store.getState()
    store.removeWidget('ghost')
    expect(store.getState()).toBe(before)
  })

  it('subscribe returns an unsubscribe function that stops notifications', () => {
    const store = createDashboard(baseConfig())
    const listener = vi.fn()
    const unsub = store.subscribe(listener)
    unsub()
    store.moveWidget('w1', 2, 3)
    expect(listener).not.toHaveBeenCalled()
  })

  it('mutations do not mutate the original config object', () => {
    const cfg = baseConfig()
    const store = createDashboard(cfg)
    store.moveWidget('w1', 3, 3)
    // Original config still has w1 at col=1,row=1
    expect(cfg.widgets[0]!.col).toBe(1)
    expect(cfg.widgets[0]!.row).toBe(1)
  })
})

describe('dashboardPlugin', () => {
  it('registers dashboard tokens', () => {
    const { tokens } = runPlugins([dashboardPlugin])
    expect(tokens['--iris-dashboard-gap']).toBe(dashboardTokens['--iris-dashboard-gap'])
    expect(tokens['--iris-dashboard-widget-bg']).toBe(dashboardTokens['--iris-dashboard-widget-bg'])
    expect(tokens['--iris-dashboard-widget-radius']).toBe(
      dashboardTokens['--iris-dashboard-widget-radius'],
    )
  })
})
