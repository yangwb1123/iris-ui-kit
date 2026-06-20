import {
  toMcpTools,
  toToolName,
  type CommandRegistry,
  type McpToolDef,
} from '@iris-ui/core/commands'

/**
 * The Assistant's PLANNER seam, factored out of the view so it can be unit-tested
 * and so the LLM transport is dynamically imported (the Anthropic SDK only loads
 * when the AI planner is actually used — it stays off the default bundle).
 *
 * A planner turns natural-language `input` into a chosen `commandId` (plus what to
 * `say`), reading the live {@link CommandRegistry}. It returns `null` when nothing
 * matches. The deterministic {@link fuzzyPlanner} is the default; an LLM planner
 * ({@link createLlmPlanner}) is a drop-in that asks a model to pick the command —
 * so it may be ASYNC.
 */
export interface PlanResult {
  commandId: string
  say: string
}

export type Planner = (
  input: string,
  registry: CommandRegistry,
) => PlanResult | null | Promise<PlanResult | null>

/**
 * The default planner: deterministic fuzzy-match → top command (the original
 * Assistant behavior). Returns `null` when nothing matches. Synchronous.
 */
export const fuzzyPlanner = (input: string, registry: CommandRegistry): PlanResult | null => {
  const top = registry.search(input, 1)[0]?.command
  if (!top) return null
  return { commandId: top.id, say: `Running “${top.title}”.` }
}

/**
 * What the model is asked to do: read the user request and call EXACTLY one of
 * the provided tools (each tool == one desktop command). Forced via
 * `tool_choice: { type: 'any', disable_parallel_tool_use: true }` so the response
 * is a single `tool_use` block whose name maps back to a command id.
 */
export const LLM_SYSTEM =
  'You are the planner for a desktop "operating system" shell. The user types a ' +
  'natural-language request; choose the SINGLE best-matching action by calling ' +
  'exactly one of the provided tools. Each tool is one desktop command (open an ' +
  'app, a window action, or a system/skin action). Always call exactly one tool — ' +
  'pick the closest match even if the wording is loose. Do not reply with text.'

/** What an injected model call returns: the chosen tool name (or null), + optional prose. */
export interface ToolChoice {
  /** The MCP tool name the model picked, or `null` if it picked none. */
  toolName: string | null
  /** Optional natural-language line to show the user. */
  say?: string
}

/**
 * The injectable transport: given the user input and the command registry
 * projected as MCP tools, return the model's chosen tool. Injecting this keeps
 * {@link createLlmPlanner} network-free for tests and decoupled from any one SDK.
 */
export type ModelCall = (args: {
  input: string
  tools: McpToolDef[]
  system: string
}) => Promise<ToolChoice>

/**
 * Build an LLM-backed planner from a {@link ModelCall}. It projects the live
 * registry as MCP tools ({@link toMcpTools}), asks the model to pick one, then
 * maps the chosen tool name back to a command id. Any miss — empty registry,
 * transport error, no tool chosen, unknown tool — delegates to `fallback` (the
 * deterministic {@link fuzzyPlanner} by default), so the Assistant degrades
 * gracefully instead of dead-ending.
 */
export function createLlmPlanner(call: ModelCall, fallback: Planner = fuzzyPlanner): Planner {
  return async (input, registry) => {
    const tools = toMcpTools(registry)
    if (tools.length === 0) return fallback(input, registry)
    let choice: ToolChoice
    try {
      choice = await call({ input, tools, system: LLM_SYSTEM })
    } catch {
      return fallback(input, registry)
    }
    if (!choice.toolName) return fallback(input, registry)
    const command = registry.list().find((c) => toToolName(c.id) === choice.toolName)
    if (!command) return fallback(input, registry)
    return { commandId: command.id, say: choice.say ?? `Running “${command.title}”.` }
  }
}

export interface AnthropicCallOptions {
  /**
   * Anthropic API key. ⚠️ DEMO ONLY — this ships the key to the browser via
   * `dangerouslyAllowBrowser`. Never embed a real key client-side in production;
   * proxy the request through a server that holds the key. The Assistant surfaces
   * this warning in its AI-planner panel.
   */
  apiKey: string
  /** Model id; defaults to `claude-opus-4-8`. */
  model?: string
}

/**
 * Reference {@link ModelCall} backed by the official Anthropic SDK. The SDK is
 * dynamically imported so it's code-split out of the default desktop bundle and
 * only fetched when the AI planner is actually enabled.
 *
 * Forces a single tool call (`tool_choice: { type: 'any', disable_parallel_tool_use: true }`)
 * and reads the chosen tool's name from the `tool_use` block.
 */
export function createAnthropicCall(opts: AnthropicCallOptions): ModelCall {
  return async ({ input, tools, system }) => {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({
      apiKey: opts.apiKey,
      // DEMO ONLY — see AnthropicCallOptions.apiKey.
      dangerouslyAllowBrowser: true,
    })
    const response = await client.messages.create({
      model: opts.model ?? 'claude-opus-4-8',
      max_tokens: 1024,
      system,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      })),
      // `any` = must call a tool; `disable_parallel_tool_use` = at most one → exactly one.
      tool_choice: { type: 'any', disable_parallel_tool_use: true },
      messages: [{ role: 'user', content: input }],
    })
    for (const block of response.content) {
      if (block.type === 'tool_use') return { toolName: block.name }
    }
    return { toolName: null }
  }
}
