import type { ModelCall } from '@iris-ui/core/commands'

/**
 * The Assistant's planner. The framework-agnostic brain — `fuzzyPlanner`,
 * `createLlmPlanner`, and the `Planner`/`ModelCall`/`ToolChoice` contracts — now
 * lives in `@iris-ui/core/commands` and is shared by all four desktop shells
 * (React/Vue/Solid/Svelte). This module re-exports it and adds the one piece that
 * can't sink to core: a concrete `ModelCall` transport backed by the Anthropic SDK
 * (an app-level dependency).
 */
export {
  fuzzyPlanner,
  createLlmPlanner,
  type Planner,
  type PlanResult,
  type ModelCall,
  type ToolChoice,
} from '@iris-ui/core/commands'

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
