import { describe, expect, it, vi } from 'vitest'
import {
  createGridCore,
  createGridExpansionFeature,
  createGridFeature,
  createGridSelectionFeature,
  createGridSortingFeature,
  GRID_EXPANSION_CHANGE_EVENT,
  GRID_SELECTION_CHANGE_EVENT,
  GRID_SORTING_CHANGE_EVENT,
  type GridExpansionChange,
  type GridExpansionMethods,
  type GridSelectionChange,
  type GridSelectionMethods,
  type GridSortingChange,
  type GridSortingMethods,
} from './grid'

describe('createGridCore', () => {
  it('loads dependencies before dependents and exposes contributed methods', () => {
    const order: string[] = []
    const data = createGridFeature({
      name: 'data',
      setup() {
        order.push('data')
        return { methods: { getRows: () => ['a', 'b'] } }
      },
    })
    const exportFeature = createGridFeature({
      name: 'export',
      dependsOn: ['data'],
      setup(context) {
        order.push('export')
        const getRows = context.getMethod<() => string[]>('getRows')
        return { methods: { exportRows: () => getRows?.().join(',') ?? '' } }
      },
    })

    const core = createGridCore({ features: [exportFeature, data] })

    expect(order).toEqual(['data', 'export'])
    expect(core.features).toEqual(['data', 'export'])
    expect(core.methodNames).toEqual(['getRows', 'exportRows'])
    expect(core.invoke<string>('exportRows')).toBe('a,b')
  })

  it('keeps setup, ready, events, and reverse dispose in one feature lifecycle', () => {
    const calls: string[] = []
    const listener = createGridFeature({
      name: 'listener',
      setup(context) {
        calls.push('listener:setup')
        context.on<{ value: number }>('change', ({ value }) => calls.push(`change:${value}`))
        return {
          onReady: () => calls.push('listener:ready'),
          dispose: () => calls.push('listener:dispose'),
        }
      },
    })
    const source = createGridFeature({
      name: 'source',
      setup(context) {
        calls.push('source:setup')
        return {
          methods: { change: (value: number) => context.emit('change', { value }) },
          onReady: () => calls.push('source:ready'),
          dispose: () => calls.push('source:dispose'),
        }
      },
    })
    const core = createGridCore({ features: [listener, source] })

    core.ready().ready()
    core.invoke('change', 3)
    core.destroy()
    core.destroy()

    expect(calls).toEqual([
      'listener:setup',
      'source:setup',
      'listener:ready',
      'source:ready',
      'change:3',
      'source:dispose',
      'listener:dispose',
    ])
    expect(core.status).toBe('destroyed')
    expect(core.features).toEqual([])
    expect(core.methodNames).toEqual([])
  })

  it('runs onReady immediately for a feature loaded after ready', () => {
    const ready = vi.fn()
    const core = createGridCore().ready()

    core.use(createGridFeature({ name: 'late', setup: () => ({ onReady: ready }) }))

    expect(ready).toHaveBeenCalledOnce()
  })

  it('rejects duplicate methods and rolls back setup subscriptions', () => {
    const core = createGridCore({
      features: [createGridFeature({ name: 'first', setup: () => ({ methods: { reset() {} } }) })],
    })
    const bad = createGridFeature({
      name: 'bad',
      setup(context) {
        context.on('ping', () => {})
        return { methods: { reset() {} } }
      },
    })

    expect(() => core.use(bad)).toThrow('already registered')
    expect(core.features).toEqual(['first'])
  })

  it('rolls back earlier features when a later setup fails', () => {
    const calls: string[] = []
    const first = createGridFeature({
      name: 'first',
      setup(context) {
        context.on('ping', () => calls.push('first:event'))
        return {
          methods: { firstMethod: () => 'first' },
          dispose: () => calls.push('first:dispose'),
        }
      },
    })
    const failing = createGridFeature({
      name: 'failing',
      setup(context) {
        context.on('ping', () => calls.push('failing:event'))
        throw new Error('setup failed')
      },
    })
    const core = createGridCore()

    expect(() => core.use(first, failing)).toThrow('setup failed')
    expect(core.features).toEqual([])
    expect(core.methodNames).toEqual([])

    core.emit('ping', undefined)
    expect(calls).toEqual(['first:dispose'])
  })

  it('cleans up all features installed during failed construction', () => {
    const dispose = vi.fn()
    const first = createGridFeature({
      name: 'first',
      setup: () => ({ dispose }),
    })
    const failing = createGridFeature({
      name: 'failing',
      setup() {
        throw new Error('construction failed')
      },
    })

    expect(() => createGridCore({ features: [first, failing] })).toThrow('construction failed')
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('rolls back batch methods and features after a method collision', () => {
    const calls: string[] = []
    const existing = createGridFeature({
      name: 'existing',
      setup: () => ({ methods: { reset: () => 'existing' } }),
    })
    const first = createGridFeature({
      name: 'first',
      setup(context) {
        context.on('ping', () => calls.push('first:event'))
        return {
          methods: { firstMethod: () => 'first' },
          dispose: () => calls.push('first:dispose'),
        }
      },
    })
    const collision = createGridFeature({
      name: 'collision',
      setup(context) {
        context.on('ping', () => calls.push('collision:event'))
        return {
          methods: { reset: () => 'collision' },
          dispose: () => calls.push('collision:dispose'),
        }
      },
    })
    const core = createGridCore({ features: [existing] })

    expect(() => core.use(first, collision)).toThrow('Grid method "reset" is already registered.')
    expect(core.features).toEqual(['existing'])
    expect(core.methodNames).toEqual(['reset'])
    expect(core.hasFeature('first')).toBe(false)
    expect(core.hasMethod('firstMethod')).toBe(false)
    expect(core.invoke<string>('reset')).toBe('existing')

    core.emit('ping', undefined)
    expect(calls).toEqual(['collision:dispose', 'first:dispose'])
  })

  it('atomically rolls back an initial ready failure and can retry', () => {
    const readyCalls: string[] = []
    const disposeCalls: string[] = []
    const eventCalls: string[] = []
    const firstError = new Error('initial ready failed')
    let failingAttempts = 0

    const first = createGridFeature({
      name: 'first',
      setup(context) {
        context.on('ping', () => eventCalls.push('first:event'))
        return {
          methods: { firstMethod: () => 'first' },
          onReady: () => readyCalls.push('first:ready'),
          dispose: () => disposeCalls.push('first:dispose'),
        }
      },
    })
    const failing = createGridFeature({
      name: 'failing',
      setup(context) {
        context.on('ping', () => eventCalls.push('failing:event'))
        return {
          methods: { failingMethod: () => 'failing' },
          onReady: () => {
            readyCalls.push('failing:ready')
            failingAttempts += 1
            if (failingAttempts === 1) throw firstError
          },
          dispose: () => disposeCalls.push('failing:dispose'),
        }
      },
    })
    const last = createGridFeature({
      name: 'last',
      setup(context) {
        context.on('ping', () => eventCalls.push('last:event'))
        return {
          methods: { lastMethod: () => 'last' },
          onReady: () => readyCalls.push('last:ready'),
          dispose: () => disposeCalls.push('last:dispose'),
        }
      },
    })
    const core = createGridCore({ features: [first, failing, last] })

    let caught: unknown
    try {
      core.ready()
    } catch (error) {
      caught = error
    }

    expect(caught).toBe(firstError)
    expect(readyCalls).toEqual(['first:ready', 'failing:ready', 'last:ready'])
    expect(disposeCalls).toEqual(['last:dispose', 'failing:dispose', 'first:dispose'])
    expect(core.status).toBe('created')
    expect(core.features).toEqual([])
    expect(core.methodNames).toEqual([])

    core.emit('ping', undefined)
    expect(eventCalls).toEqual([])

    core.use(first, failing, last).ready()
    expect(core.status).toBe('ready')
    expect(readyCalls).toEqual([
      'first:ready',
      'failing:ready',
      'last:ready',
      'first:ready',
      'failing:ready',
      'last:ready',
    ])
    expect(core.features).toEqual(['first', 'failing', 'last'])
  })

  it('rolls back a ready-time batch after onReady fails and remains usable', () => {
    const existingReady = vi.fn()
    const existing = createGridFeature({
      name: 'existing',
      setup: () => ({
        methods: { existingMethod: () => 'existing' },
        onReady: existingReady,
      }),
    })
    const firstDispose = vi.fn()
    const first = createGridFeature({
      name: 'first',
      setup: (context) => {
        context.on('ping', () => {})
        return { methods: { firstMethod: () => 'first' }, dispose: firstDispose }
      },
    })
    const failingDispose = vi.fn()
    const failing = createGridFeature({
      name: 'failing',
      setup: (context) => {
        context.on('ping', () => {})
        return {
          methods: { failingMethod: () => 'failing' },
          onReady: () => {
            throw new Error('ready failed')
          },
          dispose: failingDispose,
        }
      },
    })
    const core = createGridCore({ features: [existing] }).ready()

    expect(() => core.use(first, failing)).toThrow('ready failed')
    expect(core.status).toBe('ready')
    expect(core.features).toEqual(['existing'])
    expect(core.methodNames).toEqual(['existingMethod'])
    expect(existingReady).toHaveBeenCalledOnce()
    expect(firstDispose).toHaveBeenCalledOnce()
    expect(failingDispose).toHaveBeenCalledOnce()

    const recoveryReady = vi.fn()
    core.use(
      createGridFeature({
        name: 'recovery',
        setup: () => ({ onReady: recoveryReady }),
      }),
    )
    expect(recoveryReady).toHaveBeenCalledOnce()
    expect(core.features).toEqual(['existing', 'recovery'])
  })

  it('fails fast for missing, cyclic, and duplicate feature dependencies', () => {
    const missing = createGridFeature({
      name: 'missing-user',
      dependsOn: ['missing'],
      setup() {},
    })
    expect(() => createGridCore({ features: [missing] })).toThrow('requires missing feature')

    const a = createGridFeature({ name: 'a', dependsOn: ['b'], setup() {} })
    const b = createGridFeature({ name: 'b', dependsOn: ['a'], setup() {} })
    expect(() => createGridCore({ features: [a, b] })).toThrow('dependency cycle')

    const duplicate = createGridFeature({ name: 'duplicate', setup() {} })
    expect(() => createGridCore({ features: [duplicate, duplicate] })).toThrow('already installed')
  })

  it('does not allow new work after destroy', () => {
    const core = createGridCore()
    core.destroy()

    expect(() => core.ready()).toThrow('destroyed')
    expect(() => core.emit('change', 1)).toThrow('destroyed')
    expect(() => core.invoke('missing')).toThrow('destroyed')
  })
})

describe('createGridSelectionFeature', () => {
  it('composes selection state, methods, callback, and event as one capability', () => {
    const onChange = vi.fn()
    const events: Array<GridSelectionChange<number>> = []
    const core = createGridCore({
      features: [
        createGridSelectionFeature<Record<string, unknown>, number>({
          defaultSelected: [1],
          getKeys: () => [1, 2, 3],
          onChange,
        }),
      ],
    })
    core.on<GridSelectionChange<number>>(GRID_SELECTION_CHANGE_EVENT, (event) => events.push(event))
    expect(core.invoke('getSelectionModel')).toBeDefined()
    const selection =
      core.getMethod<GridSelectionMethods<number>['toggleRowSelection']>('toggleRowSelection')

    selection?.(2)
    core.invoke('selectAll')

    expect(core.invoke<number[]>('getSelection')).toEqual([1, 2, 3])
    expect(core.invoke<boolean>('isRowSelected', 3)).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(events).toEqual([{ selectedKeys: [1, 2] }, { selectedKeys: [1, 2, 3] }])
  })

  it('supports controlled sync without emitting a change event', () => {
    const onChange = vi.fn()
    const core = createGridCore({
      features: [createGridSelectionFeature({ onChange })],
    })
    const event = vi.fn()
    core.on(GRID_SELECTION_CHANGE_EVENT, event)

    core.invoke('syncSelection', ['external'])

    expect(core.invoke('getSelection')).toEqual(['external'])
    expect(onChange).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
  })
})

describe('createGridExpansionFeature', () => {
  it('composes expansion state, methods, callback, and event as one capability', () => {
    const onChange = vi.fn()
    const events: Array<GridExpansionChange<number>> = []
    const core = createGridCore({
      features: [
        createGridExpansionFeature<Record<string, unknown>, number>({
          defaultExpanded: [1],
          getKeys: () => [1, 2, 3],
          onChange,
        }),
      ],
    })
    core.on<GridExpansionChange<number>>(GRID_EXPANSION_CHANGE_EVENT, (event) => events.push(event))
    expect(core.invoke('getExpansionModel')).toBeDefined()
    const toggle =
      core.getMethod<GridExpansionMethods<number>['toggleRowExpansion']>('toggleRowExpansion')

    toggle?.(2)
    core.invoke('expandAllRows')

    expect(core.invoke<number[]>('getExpandedKeys')).toEqual([1, 2, 3])
    expect(core.invoke<boolean>('isRowExpanded', 3)).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(events).toEqual([{ expandedKeys: [1, 2] }, { expandedKeys: [1, 2, 3] }])
  })

  it('supports collapse-all and does not emit for an already empty model', () => {
    const event = vi.fn()
    const core = createGridCore({ features: [createGridExpansionFeature()] })
    core.on(GRID_EXPANSION_CHANGE_EVENT, event)

    core.invoke('collapseAllRows')
    core.invoke('expandRow', 'a')
    core.invoke('collapseAllRows')

    expect(core.invoke('getExpandedKeys')).toEqual([])
    expect(event).toHaveBeenCalledTimes(2)
  })
})

describe('createGridSortingFeature', () => {
  it('composes tri-state single sorting, methods, callback, and event', () => {
    const onSortChange = vi.fn()
    const events: GridSortingChange[] = []
    const core = createGridCore({
      features: [createGridSortingFeature({ onSortChange })],
    })
    core.on<GridSortingChange>(GRID_SORTING_CHANGE_EVENT, (event) => events.push(event))
    expect(core.invoke('getSortingModel')).toBeDefined()
    const cycle = core.getMethod<GridSortingMethods['cycleSort']>('cycleSort')

    cycle?.('name')
    cycle?.('name')
    cycle?.('name')

    expect(core.invoke('getSort')).toBeNull()
    expect(onSortChange).toHaveBeenCalledTimes(3)
    expect(events).toEqual([
      { mode: 'single', sort: { key: 'name', direction: 'asc' } },
      { mode: 'single', sort: { key: 'name', direction: 'desc' } },
      { mode: 'single', sort: null },
    ])
  })

  it('cycles multiple columns in click order and clears through the active mode', () => {
    const core = createGridCore({
      features: [createGridSortingFeature({ mode: 'multiple' })],
    })

    core.invoke('cycleMultiSort', 'name')
    core.invoke('cycleMultiSort', 'age')
    core.invoke('cycleMultiSort', 'name')

    expect(core.invoke('getMultiSort')).toEqual([
      { key: 'name', direction: 'desc' },
      { key: 'age', direction: 'asc' },
    ])
    core.invoke('clearSort')
    expect(core.invoke('getMultiSort')).toEqual([])
  })

  it('supports silent controlled-state synchronization', () => {
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const event = vi.fn()
    const core = createGridCore({
      features: [createGridSortingFeature({ onSortChange, onMultiSortChange })],
    })
    core.on(GRID_SORTING_CHANGE_EVENT, event)

    core.invoke('syncSort', { key: 'name', direction: 'desc' })
    core.invoke('syncMultiSort', [{ key: 'age', direction: 'asc' }])

    expect(core.invoke('getSort')).toEqual({ key: 'name', direction: 'desc' })
    expect(core.invoke('getMultiSort')).toEqual([{ key: 'age', direction: 'asc' }])
    expect(onSortChange).not.toHaveBeenCalled()
    expect(onMultiSortChange).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
  })
})
