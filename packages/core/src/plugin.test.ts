import { describe, it, expect, vi, afterEach } from 'vitest'
import { createPlugin, runPlugins, reloadPlugins, type IrisPlugin } from './plugin'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createPlugin', () => {
  it('returns the definition unchanged (identity)', () => {
    const def: IrisPlugin = { name: 'x', install() {} }
    expect(createPlugin(def)).toBe(def)
  })

  it('warns when name is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createPlugin({ name: '', install() {} })
    expect(warn).toHaveBeenCalled()
  })
})

describe('runPlugins', () => {
  it('returns empty collections for no plugins', () => {
    const r = runPlugins([])
    expect(r.tokens).toEqual({})
    expect(r.messages).toEqual({})
    expect(r.stores.size).toBe(0)
  })

  it('collects tokens, messages, and stores', () => {
    const plugin = createPlugin({
      name: 'p',
      install(reg) {
        reg.registerTokens({ '--iris-x': 'red' })
        reg.registerMessages('zh-CN', { hello: '你好' })
        reg.registerStore('x', () => ({ value: 1 }))
      },
    })
    const r = runPlugins([plugin])
    expect(r.tokens).toEqual({ '--iris-x': 'red' })
    expect(r.messages['zh-CN']).toEqual({ hello: '你好' })
    expect(r.stores.get('x')).toEqual({ value: 1 })
  })

  it('invokes store factories eagerly, exactly once each', () => {
    const factory = vi.fn(() => ({ ok: true }))
    runPlugins([createPlugin({ name: 'p', install: (reg) => reg.registerStore('s', factory) })])
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('defers a lazy store factory until first access, then memoizes it', () => {
    const factory = vi.fn(() => ({ ok: true }))
    const r = runPlugins([
      createPlugin({ name: 'p', install: (reg) => reg.registerLazyStore('lazy', factory) }),
    ])
    // not invoked during runPlugins
    expect(factory).not.toHaveBeenCalled()
    // visible to has() before materialization
    expect(r.stores.has('lazy')).toBe(true)
    // first get materializes it...
    const first = r.stores.get('lazy')
    expect(factory).toHaveBeenCalledTimes(1)
    expect(first).toEqual({ ok: true })
    // ...subsequent gets return the SAME memoized instance (no re-invoke)
    expect(r.stores.get('lazy')).toBe(first)
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('warns when a lazy store key collides with an existing store', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    runPlugins([
      createPlugin({
        name: 'p',
        install: (reg) => {
          reg.registerStore('s', () => 'eager')
          reg.registerLazyStore('s', () => 'lazy')
        },
      }),
    ])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('registered by multiple plugins'))
  })

  it('merges messages for the same locale across plugins', () => {
    const a = createPlugin({ name: 'a', install: (r) => r.registerMessages('zh-CN', { a: '1' }) })
    const b = createPlugin({ name: 'b', install: (r) => r.registerMessages('zh-CN', { b: '2' }) })
    const r = runPlugins([a, b])
    expect(r.messages['zh-CN']).toEqual({ a: '1', b: '2' })
  })

  it('last token / store key wins on conflict and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const a = createPlugin({
      name: 'a',
      install: (r) => {
        r.registerTokens({ '--iris-x': '1' })
        r.registerStore('s', () => 'first')
      },
    })
    const b = createPlugin({
      name: 'b',
      install: (r) => {
        r.registerTokens({ '--iris-x': '2' })
        r.registerStore('s', () => 'second')
      },
    })
    const r = runPlugins([a, b])
    expect(r.tokens['--iris-x']).toBe('2')
    expect(r.stores.get('s')).toBe('second')
    expect(warn).toHaveBeenCalled()
  })

  it('preserves install order (deterministic)', () => {
    const order: string[] = []
    const mk = (n: string) => createPlugin({ name: n, install: () => order.push(n) })
    runPlugins([mk('a'), mk('b'), mk('c')])
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('warns when the same plugin is installed twice', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = createPlugin({ name: 'dup', install() {} })
    runPlugins([p, p])
    expect(warn).toHaveBeenCalled()
  })

  it('collects teardowns from install return values and onTeardown, runs LIFO', () => {
    const order: string[] = []
    const a = createPlugin({
      name: 'a',
      install: () => () => order.push('a-return'),
    })
    const b = createPlugin({
      name: 'b',
      install: (reg) => {
        reg.onTeardown(() => order.push('b-onTeardown'))
      },
    })
    const r = runPlugins([a, b])
    expect(order).toEqual([]) // not run until teardown()
    r.teardown()
    expect(order).toEqual(['b-onTeardown', 'a-return']) // LIFO
  })

  it('teardown is idempotent', () => {
    const fn = vi.fn()
    const r = runPlugins([createPlugin({ name: 'p', install: () => fn })])
    r.teardown()
    r.teardown()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('a throwing teardown is isolated and does not block the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const after = vi.fn()
    const boom = createPlugin({
      name: 'boom',
      install: () => () => {
        throw new Error('nope')
      },
    })
    const ok = createPlugin({ name: 'ok', install: () => after })
    // install order [ok, boom] → LIFO teardown runs boom (throws) then ok
    const r = runPlugins([ok, boom])
    expect(() => r.teardown()).not.toThrow()
    expect(after).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalled()
  })

  it('no teardowns → teardown() is a safe no-op', () => {
    const r = runPlugins([createPlugin({ name: 'p', install() {} })])
    expect(() => r.teardown()).not.toThrow()
  })
})

describe('runPlugins event bus', () => {
  it('lets one plugin emit and another (subscribed during its own install) receive it', () => {
    const received: unknown[] = []
    const emitter = createPlugin({
      name: 'emitter',
      install(reg) {
        reg.bus.emit('ping', { from: 'emitter' })
      },
    })
    const listener = createPlugin({
      name: 'listener',
      install(reg) {
        reg.bus.on('ping', (payload) => received.push(payload))
      },
    })
    // listener installs first so its subscription is live when emitter fires.
    runPlugins([listener, emitter])
    expect(received).toEqual([{ from: 'emitter' }])
  })

  it('CollectedRegistrations.bus is the identical instance plugins received via registry.bus', () => {
    let capturedBusFromInstall: unknown
    const p = createPlugin({
      name: 'p',
      install(reg) {
        capturedBusFromInstall = reg.bus
      },
    })
    const result = runPlugins([p])
    expect(result.bus).toBe(capturedBusFromInstall)
  })

  it('teardown() clears the bus, even if a plugin subscribed without unsubscribing', () => {
    const p = createPlugin({
      name: 'p',
      install(reg) {
        reg.bus.on('leaky', () => {})
      },
    })
    const result = runPlugins([p])
    expect(result.bus.listenerCount('leaky')).toBe(1)
    result.teardown()
    expect(result.bus.listenerCount('leaky')).toBe(0)
  })

  it('a namespaced plugin still shares the same bus, not an isolated one', () => {
    let capturedBusFromInstall: unknown
    const p = createPlugin({
      name: 'p',
      namespace: 'p-ns',
      install(reg) {
        capturedBusFromInstall = reg.bus
      },
    })
    const result = runPlugins([p])
    expect(capturedBusFromInstall).toBe(result.bus)
  })
})

describe('runPlugins dependency ordering', () => {
  function recordingPlugin(name: string, log: string[], dependsOn?: string[]) {
    return createPlugin({
      name,
      dependsOn,
      install() {
        log.push(name)
      },
    })
  }

  it('installs a plugin after the ones it dependsOn', () => {
    const log: string[] = []
    // Declared order puts the dependent first; ordering must fix it.
    runPlugins([recordingPlugin('table', log, ['data']), recordingPlugin('data', log)])
    expect(log).toEqual(['data', 'table'])
  })

  it('preserves array order for independent plugins (no reordering)', () => {
    const log: string[] = []
    runPlugins([recordingPlugin('a', log), recordingPlugin('b', log), recordingPlugin('c', log)])
    expect(log).toEqual(['a', 'b', 'c'])
  })

  it('resolves a transitive chain', () => {
    const log: string[] = []
    runPlugins([
      recordingPlugin('c', log, ['b']),
      recordingPlugin('b', log, ['a']),
      recordingPlugin('a', log),
    ])
    expect(log).toEqual(['a', 'b', 'c'])
  })

  it('warns on a missing dependency but still installs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const log: string[] = []
    runPlugins([recordingPlugin('x', log, ['nope'])])
    expect(log).toEqual(['x'])
    expect(warn.mock.calls.some((c) => String(c[0]).includes('not installed'))).toBe(true)
  })

  it('warns on a cycle and still completes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const log: string[] = []
    runPlugins([recordingPlugin('a', log, ['b']), recordingPlugin('b', log, ['a'])])
    expect(log.sort()).toEqual(['a', 'b']) // both installed once
    expect(warn.mock.calls.some((c) => String(c[0]).includes('cycle'))).toBe(true)
  })

  it('tears down in reverse install order (dependents first)', () => {
    const log: string[] = []
    const r = runPlugins([
      createPlugin({ name: 'table', dependsOn: ['data'], install: () => () => log.push('table') }),
      createPlugin({ name: 'data', install: () => () => log.push('data') }),
    ])
    r.teardown()
    expect(log).toEqual(['table', 'data']) // install was data→table; teardown LIFO
  })
})

describe('IrisPlugin destroy() lifecycle', () => {
  it('destroy is called when a plugin is removed via reloadPlugins', () => {
    const destroy = vi.fn()
    const prev = [createPlugin({ name: 'a', install() {}, destroy })]
    const next: IrisPlugin[] = []
    reloadPlugins(prev, next)
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('destroy is NOT called for plugins that remain in the set', () => {
    const destroyA = vi.fn()
    const destroyB = vi.fn()
    const prev = [
      createPlugin({ name: 'a', install() {}, destroy: destroyA }),
      createPlugin({ name: 'b', install() {}, destroy: destroyB }),
    ]
    const next = [prev[0]!] // keep a, remove b
    reloadPlugins(prev, next)
    expect(destroyA).not.toHaveBeenCalled()
    expect(destroyB).toHaveBeenCalledTimes(1)
  })

  it('destroy is isolated (a throwing destroy does not block others)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ok = vi.fn()
    const prev = [
      createPlugin({
        name: 'boom',
        install() {},
        destroy() {
          throw new Error('fail')
        },
      }),
      createPlugin({ name: 'ok', install() {}, destroy: ok }),
    ]
    reloadPlugins(prev, [])
    expect(ok).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalled()
  })

  it('reloadPlugins calls runPlugins on the next set', () => {
    const installB = vi.fn()
    const prev = [createPlugin({ name: 'a', install: vi.fn() })]
    const next = [createPlugin({ name: 'b', install: installB })]
    reloadPlugins(prev, next)
    expect(installB).toHaveBeenCalledTimes(1)
  })

  it('reloadPlugins returns the registrations from the next set', () => {
    const prev: IrisPlugin[] = []
    const next = [createPlugin({ name: 'x', install: (r) => r.registerStore('s', () => 42) })]
    const r = reloadPlugins(prev, next)
    expect(r.stores.get('s')).toBe(42)
  })
})
