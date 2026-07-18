import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  createPlugin,
  runPlugins,
  namespaceTokenKey,
  namespaceStoreKey,
  validateNamespace,
  detectNamespaceConflicts,
  createNamespacedRegistry,
  type IrisPlugin,
} from './plugin'

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// namespaceTokenKey
// ---------------------------------------------------------------------------
describe('namespaceTokenKey', () => {
  it('prefixes --iris- keys with namespace', () => {
    expect(namespaceTokenKey('--iris-bg', 'editor')).toBe('--iris-editor-bg')
  })

  it('prefixes --iris- keys with multi-segment namespace', () => {
    expect(namespaceTokenKey('--iris-bg', 'my-plugin')).toBe('--iris-my-plugin-bg')
  })

  it('is idempotent when namespace already present in --iris- key', () => {
    expect(namespaceTokenKey('--iris-editor-bg', 'editor')).toBe('--iris-editor-bg')
  })

  it('handles non --iris- prefixed keys (--custom)', () => {
    expect(namespaceTokenKey('--custom', 'editor')).toBe('--editor-custom')
  })

  it('handles keys without -- prefix', () => {
    expect(namespaceTokenKey('key', 'editor')).toBe('--editor-key')
  })

  it('handles deep --iris- chain keys — idempotent when namespace is present', () => {
    // The key already contains 'editor' after '--iris-', so it's treated as idempotent.
    expect(namespaceTokenKey('--iris-editor-line-highlight', 'editor')).toBe(
      '--iris-editor-line-highlight',
    )
  })
})

// ---------------------------------------------------------------------------
// namespaceStoreKey
// ---------------------------------------------------------------------------
describe('namespaceStoreKey', () => {
  it('prefixes key with namespace using :: separator', () => {
    expect(namespaceStoreKey('settings', 'editor')).toBe('editor::settings')
  })

  it('is idempotent when separator already present', () => {
    expect(namespaceStoreKey('editor::settings', 'editor')).toBe('editor::settings')
  })

  it('handles multi-segment namespace', () => {
    expect(namespaceStoreKey('config', 'my-plugin')).toBe('my-plugin::config')
  })

  it('is idempotent for different namespace when separator exists', () => {
    // If the key already has ::, we treat it as fully-qualified and don't re-wrap
    expect(namespaceStoreKey('other::key', 'ns')).toBe('other::key')
  })
})

// ---------------------------------------------------------------------------
// validateNamespace
// ---------------------------------------------------------------------------
describe('validateNamespace', () => {
  it('accepts valid namespaces', () => {
    expect(() => validateNamespace('editor', 'p')).not.toThrow()
    expect(() => validateNamespace('my-plugin', 'p')).not.toThrow()
    expect(() => validateNamespace('com123', 'p')).not.toThrow()
    expect(() => validateNamespace('a', 'p')).not.toThrow()
    expect(() => validateNamespace('abc-123-def', 'p')).not.toThrow()
  })

  it('rejects namespaces with uppercase letters', () => {
    expect(() => validateNamespace('Editor', 'p')).toThrow(TypeError)
    expect(() => validateNamespace('MY-PLUGIN', 'p')).toThrow(TypeError)
  })

  it('rejects namespaces with spaces', () => {
    expect(() => validateNamespace('my plugin', 'p')).toThrow(TypeError)
  })

  it('rejects empty namespace', () => {
    expect(() => validateNamespace('', 'p')).toThrow(TypeError)
  })

  it('rejects namespaces with path traversal chars', () => {
    expect(() => validateNamespace('../etc', 'p')).toThrow(TypeError)
    expect(() => validateNamespace('..', 'p')).toThrow(TypeError)
  })

  it('rejects namespaces with prototype pollution key', () => {
    expect(() => validateNamespace('__proto__', 'p')).toThrow(TypeError)
  })

  it('rejects namespaces with double underscore', () => {
    expect(() => validateNamespace('__bad', 'p')).toThrow(TypeError)
    expect(() => validateNamespace('bad__', 'p')).toThrow(TypeError)
  })

  it('rejects namespaces with special characters', () => {
    expect(() => validateNamespace('editor!', 'p')).toThrow(TypeError)
    expect(() => validateNamespace('editor@foo', 'p')).toThrow(TypeError)
    expect(() => validateNamespace('editor/foo', 'p')).toThrow(TypeError)
  })

  it('includes plugin name in error message', () => {
    expect(() => validateNamespace('BAD', 'my-cool-plugin')).toThrow(/my-cool-plugin/)
  })
})

// ---------------------------------------------------------------------------
// detectNamespaceConflicts
// ---------------------------------------------------------------------------
describe('detectNamespaceConflicts', () => {
  it('warns when two plugins share the same namespace', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const plugins: IrisPlugin[] = [
      createPlugin({ name: 'a', namespace: 'ns', install() {} }),
      createPlugin({ name: 'b', namespace: 'ns', install() {} }),
    ]
    detectNamespaceConflicts(plugins)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Namespace "ns" is used by multiple plugins'),
    )
    warn.mockRestore()
  })

  it('does not warn when namespaces are unique', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const plugins: IrisPlugin[] = [
      createPlugin({ name: 'a', namespace: 'ns-a', install() {} }),
      createPlugin({ name: 'b', namespace: 'ns-b', install() {} }),
    ]
    detectNamespaceConflicts(plugins)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('does not warn when no plugins declare namespace (defaults to name)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const plugins: IrisPlugin[] = [
      createPlugin({ name: 'a', install() {} }),
      createPlugin({ name: 'b', install() {} }),
    ]
    detectNamespaceConflicts(plugins)
    // Each plugin's implied namespace = its name, which are unique
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('warns when a declared namespace collides with another plugin name (implicit ns)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const plugins: IrisPlugin[] = [
      createPlugin({ name: 'shared', install() {} }), // implicit ns = 'shared'
      createPlugin({ name: 'other', namespace: 'shared', install() {} }),
    ]
    detectNamespaceConflicts(plugins)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"shared"'))
    warn.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// createNamespacedRegistry
// ---------------------------------------------------------------------------
describe('createNamespacedRegistry', () => {
  it('prefixes token keys with namespace', () => {
    const collected: Record<string, string> = {}
    const base: Parameters<typeof createNamespacedRegistry>[0] = {
      registerTokens(tokens) {
        Object.assign(collected, tokens)
      },
      registerMessages() {},
      registerStore() {},
      registerLazyStore() {},
      onTeardown() {},
      readStore() {},
    }
    const reg = createNamespacedRegistry(base, 'editor')
    reg.registerTokens({ '--iris-bg': '#000' })
    expect(collected).toHaveProperty('--iris-editor-bg')
    expect(collected['--iris-editor-bg']).toBe('#000')
  })

  it('prefixes store keys with namespace', () => {
    const storeKeys: string[] = []
    const base: Parameters<typeof createNamespacedRegistry>[0] = {
      registerTokens() {},
      registerMessages() {},
      registerStore(key) {
        storeKeys.push(key)
      },
      registerLazyStore(key) {
        storeKeys.push(key)
      },
      onTeardown() {},
      readStore() {},
    }
    const reg = createNamespacedRegistry(base, 'editor')
    reg.registerStore('settings', () => ({}))
    reg.registerLazyStore('heavy', () => ({}))
    expect(storeKeys).toEqual(['editor::settings', 'editor::heavy'])
  })

  it('does NOT namespace messages', () => {
    const collectedLocales: string[] = []
    const base: Parameters<typeof createNamespacedRegistry>[0] = {
      registerTokens() {},
      registerMessages(locale) {
        collectedLocales.push(locale)
      },
      registerStore() {},
      registerLazyStore() {},
      onTeardown() {},
      readStore() {},
    }
    const reg = createNamespacedRegistry(base, 'editor')
    reg.registerMessages('zh-CN', { hello: '你好' })
    expect(collectedLocales).toEqual(['zh-CN'])
  })

  it('delegates onTeardown', () => {
    const fns: Array<() => void> = []
    const base: Parameters<typeof createNamespacedRegistry>[0] = {
      registerTokens() {},
      registerMessages() {},
      registerStore() {},
      registerLazyStore() {},
      onTeardown(fn) {
        fns.push(fn)
      },
      readStore() {},
    }
    const reg = createNamespacedRegistry(base, 'editor')
    const tear = () => {}
    reg.onTeardown(tear)
    expect(fns).toEqual([tear])
  })

  it('delegates readStore', () => {
    const base: Parameters<typeof createNamespacedRegistry>[0] = {
      registerTokens() {},
      registerMessages() {},
      registerStore() {},
      registerLazyStore() {},
      onTeardown() {},
      readStore(key) {
        return key === 'editor::settings' ? { value: 42 } : undefined
      },
    }
    const reg = createNamespacedRegistry(base, 'editor')
    expect(reg.readStore('editor::settings')).toEqual({ value: 42 })
    expect(reg.readStore('nonexistent')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// runPlugins with namespace
// ---------------------------------------------------------------------------
describe('runPlugins with namespace', () => {
  it('prefixes tokens when plugin declares namespace', () => {
    const plugin = createPlugin({
      name: 'editor',
      namespace: 'editor',
      install(reg) {
        reg.registerTokens({ '--iris-bg': '#000' })
      },
    })
    const result = runPlugins([plugin])
    expect(result.tokens).toHaveProperty('--iris-editor-bg')
    expect(result.tokens['--iris-editor-bg']).toBe('#000')
  })

  it('prefixes store keys when plugin declares namespace', () => {
    const store = { x: 1 }
    const plugin = createPlugin({
      name: 'editor',
      namespace: 'editor',
      install(reg) {
        reg.registerStore('settings', () => store)
      },
    })
    const result = runPlugins([plugin])
    expect(result.stores.has('editor::settings')).toBe(true)
    expect(result.stores.get('editor::settings')).toBe(store)
  })

  it('does NOT prefix when plugin omits namespace (backward compat)', () => {
    const store = { x: 1 }
    const plugin = createPlugin({
      name: 'editor',
      install(reg) {
        reg.registerTokens({ '--iris-bg': '#000' })
        reg.registerStore('settings', () => store)
      },
    })
    const result = runPlugins([plugin])
    expect(result.tokens).toHaveProperty('--iris-bg')
    expect(result.stores.has('settings')).toBe(true)
    expect(result.stores.get('settings')).toBe(store)
  })

  it('prefixes lazy store keys when plugin declares namespace', () => {
    const plugin = createPlugin({
      name: 'editor',
      namespace: 'editor',
      install(reg) {
        reg.registerLazyStore('heavy', () => ({ lazy: true }))
      },
    })
    const result = runPlugins([plugin])
    expect(result.stores.has('editor::heavy')).toBe(true)
    // Not materialized yet
    expect(result.stores.get('editor::heavy')).toEqual({ lazy: true })
  })

  it('devWarns on namespace conflict during runPlugins', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const a = createPlugin({ name: 'a', namespace: 'ns', install() {} })
    const b = createPlugin({ name: 'b', namespace: 'ns', install() {} })
    runPlugins([a, b])
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Namespace "ns" is used by multiple plugins'),
    )
    warn.mockRestore()
  })

  it('throws on invalid namespace during runPlugins', () => {
    const plugin = createPlugin({
      name: 'bad',
      namespace: 'UPPERCASE',
      install() {},
    })
    expect(() => runPlugins([plugin])).toThrow(TypeError)
  })

  it('readStore reads cross-plugin stores', () => {
    const storeA = { value: 'from-a' }
    const pluginA = createPlugin({
      name: 'plugin-a',
      namespace: 'ns-a',
      install(reg) {
        reg.registerStore('data', () => storeA)
      },
    })
    const readSpy = vi.fn()
    const pluginB = createPlugin({
      name: 'plugin-b',
      namespace: 'ns-b',
      dependsOn: ['plugin-a'],
      install(reg) {
        const data = reg.readStore('ns-a::data')
        readSpy(data)
      },
    })
    runPlugins([pluginA, pluginB])
    expect(readSpy).toHaveBeenCalledWith(storeA)
  })

  it('readStore returns undefined for missing key (does not throw)', () => {
    const p = createPlugin({
      name: 'test',
      namespace: 'test',
      install(reg) {
        expect(reg.readStore('nonexistent::key')).toBeUndefined()
      },
    })
    expect(() => runPlugins([p])).not.toThrow()
  })

  it('mixed namespaced and non-namespaced plugins work together', () => {
    const nsStore = { ns: true }
    const plainStore = { plain: true }

    const nsPlugin = createPlugin({
      name: 'ns-plugin',
      namespace: 'ns',
      install(reg) {
        reg.registerTokens({ '--iris-x': 'ns-val' })
        reg.registerStore('x', () => nsStore)
      },
    })
    const plainPlugin = createPlugin({
      name: 'plain',
      install(reg) {
        reg.registerTokens({ '--iris-y': 'plain-val' })
        reg.registerStore('y', () => plainStore)
      },
    })

    const result = runPlugins([nsPlugin, plainPlugin])
    expect(result.tokens['--iris-ns-x']).toBe('ns-val')
    expect(result.tokens['--iris-y']).toBe('plain-val')
    expect(result.stores.get('ns::x')).toBe(nsStore)
    expect(result.stores.get('y')).toBe(plainStore)
  })

  // SSR-safety test
  it('namespace logic works without DOM (SSR safe)', () => {
    const plugin = createPlugin({
      name: 'test',
      namespace: 'test-ns',
      install(reg) {
        reg.registerTokens({ '--iris-bg': '#000' })
        reg.registerStore('cfg', () => ({ x: 1 }))
      },
    })
    const result = runPlugins([plugin])
    expect(result.tokens).toHaveProperty('--iris-test-ns-bg')
    expect(result.stores.has('test-ns::cfg')).toBe(true)
  })

  it('backward compat: existing plugin.test.ts behavior preserved', () => {
    // Reproduce critical tests from plugin.test.ts to ensure no regression
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
})
