import { describe, it, expect, vi } from 'vitest'
import {
  createCommandRegistry,
  fuzzyScore,
  toMcpTools,
  runMcpTool,
  toToolName,
  type Command,
} from './commands'

const cmd = (id: string, title: string, run = () => {}, extra: Partial<Command> = {}): Command => ({
  id,
  title,
  run,
  ...extra,
})

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
    const r = createCommandRegistry()
    const off = r.register(cmd('a', 'Alpha'))
    r.register(cmd('b', 'Beta', () => {}, { enabled: () => false }))
    expect(r.list().map((c) => c.id)).toEqual(['a']) // b disabled
    off()
    expect(r.list()).toHaveLength(0)
  })

  it('re-registering an id replaces it', () => {
    const r = createCommandRegistry()
    r.register(cmd('a', 'First'))
    r.register(cmd('a', 'Second'))
    expect(r.getState().commands).toHaveLength(1)
    expect(r.getState().commands[0]!.title).toBe('Second')
  })

  it('registerMany returns a single unregister', () => {
    const r = createCommandRegistry()
    const off = r.registerMany([cmd('a', 'A'), cmd('b', 'B')])
    expect(r.list()).toHaveLength(2)
    off()
    expect(r.list()).toHaveLength(0)
  })

  it('search ranks fuzzy matches best-first and excludes disabled', () => {
    const r = createCommandRegistry()
    r.registerMany([
      cmd('settings', 'Open Settings', () => {}, { keywords: 'preferences skin' }),
      cmd('files', 'Open Files'),
      cmd('hidden', 'Settings Secret', () => {}, { enabled: () => false }),
    ])
    const hits = r.search('settings')
    expect(hits[0]!.command.id).toBe('settings')
    expect(hits.map((h) => h.command.id)).not.toContain('hidden')
  })

  it('exposes commands as MCP tools and runs them by tool name (agent surface)', async () => {
    const r = createCommandRegistry()
    const ran = vi.fn()
    r.register(cmd('open:settings', 'Open Settings', ran, { group: 'System' }))
    r.register(cmd('hidden', 'Hidden', () => {}, { enabled: () => false }))
    const tools = toMcpTools(r)
    expect(tools.map((t) => t.name)).toEqual(['open_settings']) // sanitized, disabled excluded
    expect(tools[0]!.description).toBe('System: Open Settings')
    expect(toToolName('a:b/c')).toBe('a_b_c')
    const ok = await runMcpTool(r, 'open_settings')
    expect(ok).toEqual({ ok: true, ran: 'open:settings' })
    expect(ran).toHaveBeenCalledTimes(1)
    expect((await runMcpTool(r, 'nope')).ok).toBe(false)
  })

  it('run invokes the command; disabled/missing are no-ops', async () => {
    const r = createCommandRegistry()
    const ran = vi.fn()
    const blocked = vi.fn()
    r.register(cmd('go', 'Go', ran))
    r.register(cmd('no', 'No', blocked, { enabled: () => false }))
    await r.run('go')
    await r.run('no')
    await r.run('missing')
    expect(ran).toHaveBeenCalledTimes(1)
    expect(blocked).not.toHaveBeenCalled()
  })
})
