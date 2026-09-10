import { describe, expect, it, vi } from 'vitest'
import {
  createCommandRegistry,
  runMcpTool,
  toMcpTools,
  toToolName,
  validateMcpToolArgs,
  type Command,
} from './commands'
import { cmd } from './commands.test-support'

describe('commands MCP bridge', () => {
  it('exposes commands as MCP tools and runs them by tool name (agent surface)', async () => {
    const registry = createCommandRegistry()
    const ran = vi.fn()
    registry.register(cmd('open:settings', 'Open Settings', ran, { group: 'System' }))
    registry.register(cmd('hidden', 'Hidden', () => {}, { enabled: () => false }))
    const tools = toMcpTools(registry)
    expect(tools.map((tool) => tool.name)).toEqual(['open_settings'])
    expect(tools[0]!.description).toBe('System: Open Settings')
    expect(toToolName('a:b/c')).toBe('a_b_c')
    const ok = await runMcpTool(registry, 'open_settings')
    expect(ok).toEqual({ ok: true, ran: 'open:settings' })
    expect(ran).toHaveBeenCalledTimes(1)
    expect((await runMcpTool(registry, 'nope')).ok).toBe(false)
  })

  it('projects typed params into the MCP tool inputSchema', () => {
    const registry = createCommandRegistry()
    registry.register(
      cmd('web:search', 'Search the web', () => {}, {
        group: 'System',
        params: {
          query: { type: 'string', description: 'what to search for', required: true },
          engine: { type: 'string', enum: ['ddg', 'google'] },
        },
      }),
    )
    const [tool] = toMcpTools(registry)
    expect(tool!.inputSchema.properties.query).toEqual({
      type: 'string',
      description: 'what to search for',
    })
    expect(tool!.inputSchema.properties.engine).toEqual({ type: 'string', enum: ['ddg', 'google'] })
    expect(tool!.inputSchema.required).toEqual(['query'])
  })

  it('runMcpTool forwards schema-valid args to the command run', async () => {
    const registry = createCommandRegistry()
    let received: Record<string, unknown> | undefined
    registry.register(
      cmd('web:search', 'Search', (args) => void (received = args), {
        params: { query: { type: 'string' } },
      }),
    )
    const ok = await runMcpTool(registry, 'web_search', { query: 'cats' })
    expect(ok).toEqual({ ok: true, ran: 'web:search' })
    expect(received).toEqual({ query: 'cats' })
  })

  it('rejects missing, unknown, wrong-type, non-finite, and enum arguments before run', async () => {
    const registry = createCommandRegistry()
    const ran = vi.fn()
    registry.register(
      cmd('safe:command', 'Safe', ran, {
        params: {
          query: { type: 'string', required: true },
          count: { type: 'number' },
          enabled: { type: 'boolean' },
          mode: { type: 'string', enum: ['safe', 'fast'] },
        },
      }),
    )

    await expect(runMcpTool(registry, 'safe_command', { count: 1 })).resolves.toEqual({
      ok: false,
      error: 'invalid arguments: missing required argument: query',
    })
    await expect(
      runMcpTool(registry, 'safe_command', { query: 'x', extra: true }),
    ).resolves.toEqual({
      ok: false,
      error: 'invalid arguments: unknown argument: extra',
    })
    await expect(runMcpTool(registry, 'safe_command', { query: 1 })).resolves.toEqual({
      ok: false,
      error: 'invalid arguments: invalid type for argument: query',
    })
    await expect(
      runMcpTool(registry, 'safe_command', { query: 'x', count: Number.POSITIVE_INFINITY }),
    ).resolves.toEqual({
      ok: false,
      error: 'invalid arguments: invalid type for argument: count',
    })
    await expect(
      runMcpTool(registry, 'safe_command', { query: 'x', count: Number.NaN }),
    ).resolves.toEqual({
      ok: false,
      error: 'invalid arguments: invalid type for argument: count',
    })
    await expect(
      runMcpTool(registry, 'safe_command', { query: 'x', enabled: 'yes' }),
    ).resolves.toEqual({
      ok: false,
      error: 'invalid arguments: invalid type for argument: enabled',
    })
    await expect(
      runMcpTool(registry, 'safe_command', { query: 'x', mode: 'unsafe' }),
    ).resolves.toEqual({
      ok: false,
      error: 'invalid arguments: invalid value for argument: mode',
    })
    expect(ran).not.toHaveBeenCalled()
  })

  it('accepts no-param calls but rejects supplied unknown arguments', async () => {
    const registry = createCommandRegistry()
    const ran = vi.fn()
    registry.register(cmd('no:params', 'No params', ran))

    await expect(runMcpTool(registry, 'no_params')).resolves.toEqual({ ok: true, ran: 'no:params' })
    await expect(runMcpTool(registry, 'no_params', {})).resolves.toEqual({
      ok: true,
      ran: 'no:params',
    })
    await expect(runMcpTool(registry, 'no_params', { unexpected: 1 })).resolves.toEqual({
      ok: false,
      error: 'invalid arguments: unknown argument: unexpected',
    })
    expect(ran).toHaveBeenCalledTimes(2)
  })

  it('returns stable failures for disabled, unknown, and throwing commands', async () => {
    const registry = createCommandRegistry()
    const disabledRun = vi.fn()
    registry.register(cmd('disabled', 'Disabled', disabledRun, { enabled: () => false }))
    registry.register(
      cmd('throws', 'Throws', () => {
        throw new Error('secret')
      }),
    )
    registry.register(
      cmd('rejects', 'Rejects', async () => {
        throw new Error('also secret')
      }),
    )

    await expect(runMcpTool(registry, 'disabled')).resolves.toEqual({
      ok: false,
      error: 'disabled tool: disabled',
    })
    await expect(runMcpTool(registry, 'missing')).resolves.toEqual({
      ok: false,
      error: 'unknown tool: missing',
    })
    await expect(runMcpTool(registry, 'throws')).resolves.toEqual({
      ok: false,
      error: 'command failed: throws',
    })
    await expect(runMcpTool(registry, 'rejects')).resolves.toEqual({
      ok: false,
      error: 'command failed: rejects',
    })
    expect(disabledRun).not.toHaveBeenCalled()
  })

  it('allocates deterministic unique names for sanitized collisions', async () => {
    const registry = createCommandRegistry()
    const first = vi.fn()
    const second = vi.fn()
    const unrelated = vi.fn()
    registry.registerMany([
      cmd('a:b', 'First', first),
      cmd('a_b', 'Second', second),
      cmd('a_b_2', 'Unrelated', unrelated),
    ])

    expect(toMcpTools(registry).map((tool) => tool.name)).toEqual(['a_b', 'a_b_3', 'a_b_2'])
    expect(new Set(toMcpTools(registry).map((tool) => tool.name)).size).toBe(3)
    await expect(runMcpTool(registry, 'a_b_3')).resolves.toEqual({ ok: true, ran: 'a_b' })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    expect(unrelated).not.toHaveBeenCalled()
  })

  it('omits commands whose ids cannot produce a valid MCP tool name', async () => {
    const registry = createCommandRegistry()
    const empty = vi.fn()
    const settings = vi.fn()
    registry.registerMany([
      cmd('', 'Empty', empty),
      cmd('open:settings', 'Open Settings', settings),
    ])

    expect(toMcpTools(registry).map((tool) => tool.name)).toEqual(['open_settings'])
    await expect(runMcpTool(registry, '')).resolves.toEqual({ ok: false, error: 'unknown tool: ' })
    expect(empty).not.toHaveBeenCalled()
    expect(settings).not.toHaveBeenCalled()
  })

  it('omits commands with runtime-invalid ids instead of throwing', async () => {
    const registry = createCommandRegistry()
    const broken = vi.fn()
    const safe = vi.fn()
    registry.register({ id: 1 as unknown as string, title: 'Broken', run: broken } as Command)
    registry.register(cmd('safe', 'Safe', safe))

    expect(toMcpTools(registry).map((tool) => tool.name)).toEqual(['safe'])
    await expect(runMcpTool(registry, 'safe')).resolves.toEqual({ ok: true, ran: 'safe' })
    await expect(runMcpTool(registry, '1')).resolves.toEqual({
      ok: false,
      error: 'unknown tool: 1',
    })
    expect(broken).not.toHaveBeenCalled()
    expect(safe).toHaveBeenCalledTimes(1)
  })

  it('fails closed for malformed parameter definitions', async () => {
    const registry = createCommandRegistry()
    const broken = vi.fn()
    const params = { query: null } as unknown as Command['params']
    registry.register(cmd('broken', 'Broken', broken, { params }))

    expect(validateMcpToolArgs(params, { query: 'cats' })).toEqual({
      ok: false,
      error: 'invalid command definition: invalid parameter: query',
    })
    expect(toMcpTools(registry)).toEqual([])
    await expect(runMcpTool(registry, 'broken', { query: 'cats' })).resolves.toEqual({
      ok: false,
      error: 'unknown tool: broken',
    })
    expect(broken).not.toHaveBeenCalled()
  })

  it('fails closed for getter-backed param and arg objects', async () => {
    const registry = createCommandRegistry()
    const broken = vi.fn()
    const safe = vi.fn()
    const param = {}
    Object.defineProperty(param, 'type', {
      enumerable: true,
      get: () => {
        throw new Error('boom')
      },
    })
    const params = Object.create(null) as Record<string, unknown>
    Object.defineProperty(params, 'query', { enumerable: true, value: param })
    const args = {}
    Object.defineProperty(args, 'query', {
      enumerable: true,
      get: () => {
        throw new Error('boom')
      },
    })

    registry.register(cmd('broken', 'Broken', broken, { params: params as Command['params'] }))
    registry.register(
      cmd('safe', 'Safe', safe, { params: { query: { type: 'string', required: true } } }),
    )

    expect(validateMcpToolArgs(params as Command['params'], { query: 'cats' })).toEqual({
      ok: false,
      error: 'invalid command definition: invalid parameter: query',
    })
    expect(toMcpTools(registry).map((tool) => tool.name)).toEqual(['safe'])
    await expect(runMcpTool(registry, 'broken', { query: 'cats' })).resolves.toEqual({
      ok: false,
      error: 'unknown tool: broken',
    })
    await expect(runMcpTool(registry, 'safe', args as Record<string, unknown>)).resolves.toEqual({
      ok: false,
      error: 'invalid arguments: expected an object',
    })
    expect(broken).not.toHaveBeenCalled()
    expect(safe).not.toHaveBeenCalled()
  })

  it('handles own __proto__ params and args without prototype pollution', async () => {
    const registry = createCommandRegistry()
    let received: Record<string, unknown> | undefined
    const params = Object.create(null) as Record<string, unknown>
    Object.defineProperty(params, '__proto__', {
      enumerable: true,
      value: { type: 'string', required: true },
    })
    const args = Object.create(null) as Record<string, unknown>
    Object.defineProperty(args, '__proto__', { enumerable: true, value: 'safe' })

    registry.register(
      cmd(
        'proto',
        'Proto',
        (value) => {
          received = value
        },
        { params: params as Command['params'] },
      ),
    )

    const [tool] = toMcpTools(registry)
    expect(Object.keys(tool!.inputSchema.properties)).toEqual(['__proto__'])
    expect(tool!.inputSchema.properties.__proto__).toEqual({ type: 'string' })
    expect(tool!.inputSchema.required).toEqual(['__proto__'])
    await expect(runMcpTool(registry, 'proto', args)).resolves.toEqual({ ok: true, ran: 'proto' })
    expect(Object.keys(received ?? {})).toEqual(['__proto__'])
    expect(received?.['__proto__']).toBe('safe')
  })

  it('treats enabled failures as disabled for MCP projection and invocation', async () => {
    const registry = createCommandRegistry()
    const broken = vi.fn()
    const safe = vi.fn()
    registry.register(
      cmd('broken', 'Broken', broken, {
        enabled: () => {
          throw new Error('boom')
        },
      }),
    )
    registry.register(cmd('safe', 'Safe', safe))

    expect(toMcpTools(registry).map((tool) => tool.name)).toEqual(['safe'])
    await expect(runMcpTool(registry, 'broken')).resolves.toEqual({
      ok: false,
      error: 'disabled tool: broken',
    })
    await expect(runMcpTool(registry, 'safe')).resolves.toEqual({ ok: true, ran: 'safe' })
    expect(broken).not.toHaveBeenCalled()
    expect(safe).toHaveBeenCalledTimes(1)
  })
})
