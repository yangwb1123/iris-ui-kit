import { describe, it, expect } from 'vitest'
import { createCommandRegistry, toToolName, type McpToolDef } from '@iris-ui/core/commands'
import { createLlmPlanner, fuzzyPlanner, type ModelCall } from './planner'

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
