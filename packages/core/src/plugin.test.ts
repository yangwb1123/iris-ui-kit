import { describe, it, expect, vi, afterEach } from 'vitest'
import { createPlugin, runPlugins, type IrisPlugin } from './plugin'

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
