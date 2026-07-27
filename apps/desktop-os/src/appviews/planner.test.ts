import { describe, it, expect, vi } from 'vitest'
import { createCommandRegistry, toToolName, type McpToolDef } from '@iris-ui-kit/core/commands'
import { createAnthropicCall, createLlmPlanner, fuzzyPlanner, type ModelCall } from './planner'

// Mock the Anthropic SDK so the transport can be tested without a key or network.
// The dynamic `import('@anthropic-ai/sdk')` inside createAnthropicCall resolves to this.
const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create }
    constructor(_opts: unknown) {
      void _opts
    }
  },
}))

function makeRegistry() {
  const reg = createCommandRegistry()
  const ran: string[] = []
  reg.registerMany([
    {
      id: 'app.open.settings',
      title: 'Open Settings',
      group: 'Apps',
      run: () => void ran.push('settings'),
    },
    { id: 'win.close', title: 'Close Window', group: 'Window', run: () => void ran.push('close') },
    {
      id: 'sys.skin.macos',
      title: 'Switch to macOS',
      group: 'System',
      run: () => void ran.push('macos'),
    },
  ])
  return { reg, ran }
}

describe('fuzzyPlanner', () => {
  it('picks the top fuzzy hit and is synchronous', () => {
    const { reg } = makeRegistry()
    const plan = fuzzyPlanner('open settings', reg)
    expect(plan).not.toBeNull()
    expect(plan!.commandId).toBe('app.open.settings')
  })

  it('returns null when nothing matches', () => {
    const { reg } = makeRegistry()
    expect(fuzzyPlanner('zzzqqq nonsense xyzzy', reg)).toBeNull()
  })
})

describe('createLlmPlanner', () => {
  it('maps the model-chosen tool name back to its command id and runs it', async () => {
    const { reg, ran } = makeRegistry()
    let seen: McpToolDef[] = []
    const call: ModelCall = async ({ tools }) => {
      seen = tools
      return { toolName: toToolName('sys.skin.macos') }
    }
    const plan = await createLlmPlanner(call)('make it look like a mac', reg)

    // The model is handed the registry projected as MCP tools.
    expect(seen.map((t) => t.name).sort()).toEqual(
      ['app.open.settings', 'win.close', 'sys.skin.macos'].map(toToolName).sort(),
    )
    expect(plan!.commandId).toBe('sys.skin.macos')

    await reg.run(plan!.commandId)
    expect(ran).toContain('macos')
  })

  it('passes through the model’s `say` when provided', async () => {
    const { reg } = makeRegistry()
    const call: ModelCall = async () => ({
      toolName: toToolName('win.close'),
      say: 'Closing it now.',
    })
    const plan = await createLlmPlanner(call)('shut this', reg)
    expect(plan).toEqual({ commandId: 'win.close', say: 'Closing it now.' })
  })

  it('falls back to the deterministic planner when the model picks no tool', async () => {
    const { reg } = makeRegistry()
    const call: ModelCall = async () => ({ toolName: null })
    const plan = await createLlmPlanner(call)('open settings', reg)
    expect(plan!.commandId).toBe('app.open.settings')
  })

  it('falls back when the transport throws (no key, network error, …)', async () => {
    const { reg } = makeRegistry()
    const call: ModelCall = async () => {
      throw new Error('401 unauthorized')
    }
    const plan = await createLlmPlanner(call)('close window', reg)
    expect(plan!.commandId).toBe('win.close')
  })

  it('falls back when the chosen tool name is not a real command', async () => {
    const { reg } = makeRegistry()
    const call: ModelCall = async () => ({ toolName: 'totally_made_up_tool' })
    const plan = await createLlmPlanner(call)('open settings', reg)
    expect(plan!.commandId).toBe('app.open.settings')
  })

  it('uses a custom fallback planner', async () => {
    const { reg } = makeRegistry()
    const call: ModelCall = async () => ({ toolName: null })
    const fallback = () => ({ commandId: 'win.close', say: 'fallback' })
    const plan = await createLlmPlanner(call, fallback)('anything', reg)
    expect(plan).toEqual({ commandId: 'win.close', say: 'fallback' })
  })
})

describe('createAnthropicCall (SDK transport, mocked)', () => {
  const tools: McpToolDef[] = [
    {
      name: 'system_search',
      description: 'System: Search the web',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  ]

  it('forces a single tool call and reads the tool name + filled args', async () => {
    create.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'system_search', input: { query: 'otters' } }],
    })
    const call = createAnthropicCall({ apiKey: 'sk-test', model: 'claude-opus-4-8' })
    const choice = await call({ input: 'search the web for otters', tools, system: 'sys' })

    expect(choice).toEqual({ toolName: 'system_search', args: { query: 'otters' } })
    // The request forces exactly one tool and forwards the projected schema.
    const req = create.mock.calls.at(-1)![0]
    expect(req.model).toBe('claude-opus-4-8')
    expect(req.tool_choice).toEqual({ type: 'any', disable_parallel_tool_use: true })
    expect(req.tools[0]).toEqual({
      name: 'system_search',
      description: 'System: Search the web',
      input_schema: tools[0]!.inputSchema,
    })
  })

  it('returns toolName null when the model emits no tool_use block', async () => {
    create.mockResolvedValueOnce({ content: [{ type: 'text', text: 'no tool' }] })
    const call = createAnthropicCall({ apiKey: 'sk-test' })
    expect(await call({ input: 'hi', tools, system: 'sys' })).toEqual({ toolName: null })
  })

  it('drives createLlmPlanner end-to-end (mock network) to a real command + args', async () => {
    create.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: toToolName('app.open.settings'), input: { q: 1 } }],
    })
    const { reg } = makeRegistry()
    const planner = createLlmPlanner(createAnthropicCall({ apiKey: 'sk-test' }))
    const plan = await planner('open the settings app', reg)
    expect(plan).toEqual({
      commandId: 'app.open.settings',
      say: 'Running “Open Settings”.',
      args: { q: 1 },
    })
  })
})
