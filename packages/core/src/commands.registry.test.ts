import { describe, expect, it, vi } from 'vitest'
import { createCommandRegistry, fuzzyPlanner, fuzzyScore } from './commands'
import { cmd, createPlannerRegistry } from './commands.test-support'

describe('fuzzyScore', () => {
  it('matches subsequences, rejects non-subsequences, ranks contiguous higher', () => {
    expect(fuzzyScore('Open Settings', 'xyz')).toBeNull()
    expect(fuzzyScore('Open Settings', '')).toBe(0)
    const contiguous = fuzzyScore('Open Settings', 'sett')!
    const scattered = fuzzyScore('Open Settings', 'oes')!
    expect(contiguous).toBeGreaterThan(scattered)
  })
})

describe('createCommandRegistry', () => {
  it('registers, lists enabled, and unregisters', () => {
    const registry = createCommandRegistry()
    const off = registry.register(cmd('a', 'Alpha'))
    registry.register(cmd('b', 'Beta', () => {}, { enabled: () => false }))
    expect(registry.list().map((command) => command.id)).toEqual(['a'])
    off()
    expect(registry.list()).toHaveLength(0)
  })

  it('re-registering an id replaces it', () => {
    const registry = createCommandRegistry()
    registry.register(cmd('a', 'First'))
    registry.register(cmd('a', 'Second'))
    expect(registry.getState().commands).toHaveLength(1)
    expect(registry.getState().commands[0]!.title).toBe('Second')
  })

  it('registerMany returns a single unregister', () => {
    const registry = createCommandRegistry()
    const off = registry.registerMany([cmd('a', 'A'), cmd('b', 'B')])
    expect(registry.list()).toHaveLength(2)
    off()
    expect(registry.list()).toHaveLength(0)
  })

  it('search ranks fuzzy matches best-first and excludes disabled', () => {
    const registry = createCommandRegistry()
    registry.registerMany([
      cmd('settings', 'Open Settings', () => {}, { keywords: 'preferences skin' }),
      cmd('files', 'Open Files'),
      cmd('hidden', 'Settings Secret', () => {}, { enabled: () => false }),
    ])
    const hits = registry.search('settings')
    expect(hits[0]!.command.id).toBe('settings')
    expect(hits.map((hit) => hit.command.id)).not.toContain('hidden')
  })

  it('run invokes the command; disabled/missing are no-ops', async () => {
    const registry = createCommandRegistry()
    const ran = vi.fn()
    const blocked = vi.fn()
    registry.register(cmd('go', 'Go', ran))
    registry.register(cmd('no', 'No', blocked, { enabled: () => false }))
    await registry.run('go')
    await registry.run('no')
    await registry.run('missing')
    expect(ran).toHaveBeenCalledTimes(1)
    expect(blocked).not.toHaveBeenCalled()
  })
})

describe('fuzzyPlanner', () => {
  it('picks the top hit synchronously, null on no match', () => {
    const registry = createPlannerRegistry()
    expect(fuzzyPlanner('open settings', registry)?.commandId).toBe('app:settings')
    expect(fuzzyPlanner('zzzqqq nonsense', registry)).toBeNull()
  })
})
