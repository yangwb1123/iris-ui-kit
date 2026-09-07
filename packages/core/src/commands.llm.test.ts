import { describe, expect, it, vi } from 'vitest'
import { createCommandRegistry, createLlmPlanner, toToolName, type ModelCall } from './commands'
import { cmd, createPlannerRegistry } from './commands.test-support'

describe('createLlmPlanner', () => {
  it('maps the chosen tool name back to a command id', async () => {
    const registry = createPlannerRegistry()
    let seen: string[] = []
    const call: ModelCall = async ({ tools }) => {
      seen = tools.map((tool) => tool.name)
      return { toolName: toToolName('sys:macos') }
    }
    const plan = await createLlmPlanner(call)('make it look like a mac', registry)
    expect(seen.sort()).toEqual(['app:settings', 'win:close', 'sys:macos'].map(toToolName).sort())
    expect(plan).toEqual({ commandId: 'sys:macos', say: 'Running “Switch to macOS”.' })
  })

  it('resolves a collision alias back to the selected command', async () => {
    const registry = createCommandRegistry()
    registry.registerMany([cmd('a:b', 'First'), cmd('a_b', 'Second')])
    const call: ModelCall = async ({ tools }) => ({ toolName: tools[1]!.name })

    const plan = await createLlmPlanner(call)('second', registry)
    expect(plan?.commandId).toBe('a_b')
  })

  it('passes through the model’s `say`', async () => {
    const call: ModelCall = async () => ({ toolName: toToolName('win:close'), say: 'Closing.' })
    const plan = await createLlmPlanner(call)('shut it', createPlannerRegistry())
    expect(plan).toEqual({ commandId: 'win:close', say: 'Closing.', args: undefined })
  })

  it('carries schema-valid model args into the PlanResult', async () => {
    const registry = createCommandRegistry()
    registry.register(
      cmd('system:search', 'Search the web', () => {}, {
        params: { query: { type: 'string', required: true } },
      }),
    )
    const call: ModelCall = async () => ({
      toolName: toToolName('system:search'),
      args: { query: 'hi' },
    })
    const plan = await createLlmPlanner(call)('do it', registry)
    expect(plan).toEqual({
      commandId: 'system:search',
      say: 'Running “Search the web”.',
      args: { query: 'hi' },
    })
  })

  it('falls back to fuzzy on no-tool / throw / unknown tool', async () => {
    const none: ModelCall = async () => ({ toolName: null })
    const boom: ModelCall = async () => {
      throw new Error('401')
    }
    const bogus: ModelCall = async () => ({ toolName: 'made_up' })
    expect(
      (await createLlmPlanner(none)('open settings', createPlannerRegistry()))?.commandId,
    ).toBe('app:settings')
    expect((await createLlmPlanner(boom)('close window', createPlannerRegistry()))?.commandId).toBe(
      'win:close',
    )
    expect(
      (await createLlmPlanner(bogus)('open settings', createPlannerRegistry()))?.commandId,
    ).toBe('app:settings')
  })

  it('falls back for malformed model results', async () => {
    const nullChoice: ModelCall = async () => null as unknown as Awaited<ReturnType<ModelCall>>
    const badSay: ModelCall = async () =>
      ({ toolName: toToolName('win:close'), say: 1 }) as unknown as Awaited<ReturnType<ModelCall>>
    const getterChoice: ModelCall = async () => {
      const choice = {}
      Object.defineProperty(choice, 'toolName', {
        enumerable: true,
        get: () => {
          throw new Error('boom')
        },
      })
      return choice as Awaited<ReturnType<ModelCall>>
    }

    expect(
      (await createLlmPlanner(nullChoice)('close window', createPlannerRegistry()))?.commandId,
    ).toBe('win:close')
    expect(
      (await createLlmPlanner(badSay)('close window', createPlannerRegistry()))?.commandId,
    ).toBe('win:close')
    expect(
      (await createLlmPlanner(getterChoice)('close window', createPlannerRegistry()))?.commandId,
    ).toBe('win:close')
  })

  it('falls back when the model fills invalid args for the chosen tool', async () => {
    const registry = createCommandRegistry()
    registry.register(
      cmd('system:search', 'Search the web', () => {}, {
        params: { query: { type: 'string', required: true } },
      }),
    )
    const fallback = vi.fn(() => null)
    const call: ModelCall = async () => ({
      toolName: toToolName('system:search'),
      args: { query: 1 },
    })

    const plan = await createLlmPlanner(call, fallback)('search for otters', registry)
    expect(fallback).toHaveBeenCalledWith('search for otters', registry)
    expect(plan).toBeNull()
  })

  it('uses a custom fallback', async () => {
    const none: ModelCall = async () => ({ toolName: null })
    const fallback = () => ({ commandId: 'win:close', say: 'fb' })
    expect(await createLlmPlanner(none, fallback)('x', createPlannerRegistry())).toEqual({
      commandId: 'win:close',
      say: 'fb',
    })
  })
})
