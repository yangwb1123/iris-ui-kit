import { describe, it, expect, vi } from 'vitest'
import {
  createCommandRegistry,
  fuzzyScore,
  toMcpTools,
  runMcpTool,
  toToolName,
  fuzzyPlanner,
  createLlmPlanner,
  type Command,
  type ModelCall,
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

  it('projects typed params into the MCP tool inputSchema', () => {
    const r = createCommandRegistry()
    r.register(
      cmd('web:search', 'Search the web', () => {}, {
        group: 'System',
        params: {
          query: { type: 'string', description: 'what to search for', required: true },
          engine: { type: 'string', enum: ['ddg', 'google'] },
        },
      }),
    )
    const [tool] = toMcpTools(r)
    expect(tool!.inputSchema.properties.query).toEqual({
      type: 'string',
      description: 'what to search for',
    })
    expect(tool!.inputSchema.properties.engine).toEqual({ type: 'string', enum: ['ddg', 'google'] })
    expect(tool!.inputSchema.required).toEqual(['query'])
  })

  it('runMcpTool forwards args to the command run', async () => {
    const r = createCommandRegistry()
    let received: Record<string, unknown> | undefined
    r.register(cmd('web:search', 'Search', (args) => void (received = args)))
    const ok = await runMcpTool(r, 'web_search', { query: 'cats' })
    expect(ok).toEqual({ ok: true, ran: 'web:search' })
    expect(received).toEqual({ query: 'cats' })
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

describe('agent planner', () => {
  const reg = () => {
    const r = createCommandRegistry()
    r.registerMany([
      cmd('app:settings', 'Open Settings', () => {}, { group: 'Apps' }),
      cmd('win:close', 'Close Window', () => {}, { group: 'Window' }),
      cmd('sys:macos', 'Switch to macOS', () => {}, { group: 'System' }),
    ])
    return r
  }

  it('fuzzyPlanner picks the top hit synchronously, null on no match', () => {
    const r = reg()
    expect(fuzzyPlanner('open settings', r)?.commandId).toBe('app:settings')
    expect(fuzzyPlanner('zzzqqq nonsense', r)).toBeNull()
  })

  it('createLlmPlanner maps the chosen tool name back to a command id', async () => {
    const r = reg()
    let seen: string[] = []
    const call: ModelCall = async ({ tools }) => {
      seen = tools.map((t) => t.name)
      return { toolName: toToolName('sys:macos') }
    }
    const plan = await createLlmPlanner(call)('make it look like a mac', r)
    expect(seen.sort()).toEqual(['app:settings', 'win:close', 'sys:macos'].map(toToolName).sort())
    expect(plan).toEqual({ commandId: 'sys:macos', say: 'Running “Switch to macOS”.' })
  })

  it('createLlmPlanner passes through the model’s `say`', async () => {
    const call: ModelCall = async () => ({ toolName: toToolName('win:close'), say: 'Closing.' })
    const plan = await createLlmPlanner(call)('shut it', reg())
    expect(plan).toEqual({ commandId: 'win:close', say: 'Closing.', args: undefined })
  })

  it('createLlmPlanner carries the model-filled args into the PlanResult', async () => {
    const call: ModelCall = async () => ({ toolName: toToolName('sys:macos'), args: { q: 'hi' } })
    const plan = await createLlmPlanner(call)('do it', reg())
    expect(plan).toEqual({
      commandId: 'sys:macos',
      say: 'Running “Switch to macOS”.',
      args: { q: 'hi' },
    })
  })

  it('createLlmPlanner falls back to fuzzy on no-tool / throw / unknown tool', async () => {
    const none: ModelCall = async () => ({ toolName: null })
    const boom: ModelCall = async () => {
      throw new Error('401')
    }
    const bogus: ModelCall = async () => ({ toolName: 'made_up' })
    expect((await createLlmPlanner(none)('open settings', reg()))?.commandId).toBe('app:settings')
    expect((await createLlmPlanner(boom)('close window', reg()))?.commandId).toBe('win:close')
    expect((await createLlmPlanner(bogus)('open settings', reg()))?.commandId).toBe('app:settings')
  })

  it('createLlmPlanner uses a custom fallback', async () => {
    const none: ModelCall = async () => ({ toolName: null })
    const fallback = () => ({ commandId: 'win:close', say: 'fb' })
    expect(await createLlmPlanner(none, fallback)('x', reg())).toEqual({
      commandId: 'win:close',
      say: 'fb',
    })
  })
})
