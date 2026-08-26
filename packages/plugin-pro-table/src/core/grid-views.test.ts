import { describe, expect, it, vi } from 'vitest'
import { createGridCore } from '@iris-ui-kit/core/grid'
import {
  createGridViewsFeature,
  GRID_VIEWS_CHANGE_EVENT,
  type GridViewsChange,
  type GridViewsModel,
} from './grid'

type Row = { id: number; name: string; score: number }

type ViewSnapshot = { sort?: null; filter?: string }

describe('plugin-pro-table GridViews feature', () => {
  it('loads and sanitizes named views through the shared core storage format', () => {
    const values = new Map<string, string>([
      [
        'views',
        JSON.stringify([
          { name: 'Active', snapshot: { filter: 'ada' } },
          { name: '', snapshot: {} },
          { name: '__iris-save-view', snapshot: {} },
          { name: 'Bad', snapshot: null },
        ]),
      ],
    ])
    const grid = createGridCore<Row>({
      features: [
        createGridViewsFeature<Row, ViewSnapshot>({
          key: 'views',
          storage: {
            getItem: (key) => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
          },
          getSnapshot: () => ({}),
          applySnapshot: () => {},
        }),
      ],
    })

    expect(grid.invoke('getViews')).toEqual([{ name: 'Active', snapshot: { filter: 'ada' } }])
  })

  it('saves, upserts and selects named views with one model and event channel', () => {
    const values = new Map<string, string>()
    let current: ViewSnapshot = { filter: 'ada' }
    let applied: ViewSnapshot | null = null
    const onChange = vi.fn()
    const grid = createGridCore<Row>({
      features: [
        createGridViewsFeature<Row, ViewSnapshot>({
          storage: {
            getItem: (key) => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
          },
          getSnapshot: () => current,
          applySnapshot: (snapshot) => {
            applied = snapshot
          },
          onChange,
        }),
      ],
    })
    const events: GridViewsChange[] = []
    grid.on<GridViewsChange>(GRID_VIEWS_CHANGE_EVENT, (change) => events.push(change))
    const model = grid.invoke<GridViewsModel<ViewSnapshot>>('getViewsModel')
    const snapshots: number[] = []
    model.store.subscribe((state) => snapshots.push(state.views.length))

    expect(grid.invoke<boolean>('saveView', '  Focus  ')).toBe(true)
    expect(grid.invoke<string | null>('getActiveView')).toBe('Focus')
    expect(JSON.parse(values.get('iris-table-views')!)).toEqual([
      { name: 'Focus', snapshot: { filter: 'ada' } },
    ])

    current = { filter: 'lin' }
    expect(grid.invoke<boolean>('saveView', 'Focus')).toBe(true)
    expect(grid.invoke('getViews')).toEqual([{ name: 'Focus', snapshot: { filter: 'lin' } }])
    expect(grid.invoke<boolean>('saveView', '__iris-save-view')).toBe(false)
    expect(grid.invoke<boolean>('selectView', 'missing')).toBe(false)
    expect(grid.invoke<boolean>('selectView', 'Focus')).toBe(true)
    expect(applied).toEqual({ filter: 'lin' })
    expect(events.map((event) => event.type)).toEqual(['save', 'save', 'select'])
    expect(onChange).toHaveBeenCalledTimes(3)
    expect(snapshots).toEqual([1, 1, 1])
  })

  it('isolates named-view snapshots at save, read and select boundaries', () => {
    const values = new Map<string, string>()
    const current: ViewSnapshot = { filter: 'saved' }
    const applied: ViewSnapshot[] = []
    const grid = createGridCore<Row>({
      features: [
        createGridViewsFeature<Row, ViewSnapshot>({
          storage: {
            getItem: (key) => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
          },
          getSnapshot: () => current,
          applySnapshot: (snapshot) => {
            applied.push({ ...snapshot })
            snapshot.filter = 'mutated by apply'
          },
        }),
      ],
    })
    const model = grid.invoke<GridViewsModel<ViewSnapshot>>('getViewsModel')

    expect(model.save('Saved')).toBe(true)
    current.filter = 'mutated source'
    expect(model.getViews()).toEqual([{ name: 'Saved', snapshot: { filter: 'saved' } }])

    const returned = model.getViews()
    returned[0]!.snapshot.filter = 'mutated getViews result'
    const state = model.get()
    state.views[0]!.snapshot.filter = 'mutated get result'
    expect(model.getViews()).toEqual([{ name: 'Saved', snapshot: { filter: 'saved' } }])

    expect(model.select('Saved')).toBe(true)
    expect(model.select('Saved')).toBe(true)
    expect(applied).toEqual([{ filter: 'saved' }, { filter: 'saved' }])
  })

  it('deletes, reloads and clears views while controlled sync stays silent', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const grid = createGridCore<Row>({
      features: [
        createGridViewsFeature<Row, ViewSnapshot>({
          storage,
          getSnapshot: () => ({ filter: 'one' }),
          applySnapshot: () => {},
        }),
      ],
    })
    const events: GridViewsChange[] = []
    grid.on<GridViewsChange>(GRID_VIEWS_CHANGE_EVENT, (change) => events.push(change))

    grid.invoke('saveView', 'One')
    grid.invoke('syncActiveView', 'external')
    expect(grid.invoke<string | null>('getActiveView')).toBe('external')
    expect(events).toHaveLength(1)
    expect(grid.invoke<boolean>('deleteView', 'missing')).toBe(false)
    expect(grid.invoke<boolean>('deleteView', 'One')).toBe(true)

    values.set('iris-table-views', JSON.stringify([{ name: 'Two', snapshot: { filter: 'two' } }]))
    grid.invoke('reloadViews')
    expect(grid.invoke('getViews')).toEqual([{ name: 'Two', snapshot: { filter: 'two' } }])
    grid.invoke('clearViews')
    expect(grid.invoke('getViews')).toEqual([])
    expect(values.get('iris-table-views')).toBe('[]')
    expect(events.map((event) => event.type)).toEqual(['save', 'delete', 'reload', 'clear'])
  })

  it('keeps storage failures fail-inert while local state remains usable', () => {
    const grid = createGridCore<Row>({
      features: [
        createGridViewsFeature<Row, ViewSnapshot>({
          storage: {
            getItem: () => {
              throw new Error('denied')
            },
            setItem: () => {
              throw new Error('quota')
            },
          },
          getSnapshot: () => ({ filter: 'local' }),
          applySnapshot: () => {},
        }),
      ],
    })

    expect(grid.invoke('getViews')).toEqual([])
    expect(grid.invoke<boolean>('saveView', 'Local')).toBe(true)
    expect(grid.invoke('getViews')).toEqual([{ name: 'Local', snapshot: { filter: 'local' } }])
    expect(() => grid.invoke('clearViews')).not.toThrow()
  })

  it('supports an explicit memory-only mode', () => {
    const grid = createGridCore<Row>({
      features: [
        createGridViewsFeature<Row, ViewSnapshot>({
          storage: false,
          getSnapshot: () => ({ filter: 'memory' }),
          applySnapshot: () => {},
        }),
      ],
    })

    expect(grid.invoke<boolean>('saveView', 'Memory')).toBe(true)
    expect(grid.invoke('getViews')).toEqual([{ name: 'Memory', snapshot: { filter: 'memory' } }])
    expect(grid.invoke<boolean>('selectView', 'Memory')).toBe(true)
  })
})
