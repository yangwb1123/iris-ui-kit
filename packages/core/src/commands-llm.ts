import type { CommandRegistry, Planner } from './commands-registry'
import { fuzzyPlanner } from './commands-registry'
import {
  findMcpCommandEntryByName,
  getOwnEnumerableDataEntries,
  isMcpArgsObject,
  toMcpTools,
  toNullProtoRecord,
  validateAndNormalizeMcpToolArgs,
  type McpToolDef,
} from './commands-mcp'

/** System prompt for an LLM planner: pick exactly one tool (= one command). */
export const LLM_PLANNER_SYSTEM =
  'You are the planner for a desktop "operating system" shell. The user types a ' +
  'natural-language request; choose the SINGLE best-matching action by calling ' +
  'exactly one of the provided tools. Each tool is one desktop command (open an ' +
  'app, a window action, or a system action). Always call exactly one tool — pick ' +
  'the closest match even if the wording is loose. When the chosen tool declares ' +
  'parameters, fill them from the request. Do not reply with text.'

/** What an injected model call returns: the chosen tool name (or null), + optional prose/args. */
export interface ToolChoice {
  /** The MCP tool name the model picked, or `null` if it picked none. */
  toolName: string | null
  /** Optional natural-language line to show the user. */
  say?: string
  /** Arguments the model filled for the chosen tool. */
  args?: Record<string, unknown>
}

/**
 * The injectable transport: given the user input and the registry projected as
 * MCP tools, return the model's chosen tool. Injecting this keeps the planner
 * network-free for tests and decoupled from any one SDK — each shell wires its own
 * (e.g. an `@anthropic-ai/sdk`-backed call).
 */
export type ModelCall = (args: {
  input: string
  tools: McpToolDef[]
  system: string
}) => Promise<ToolChoice>

function normalizeToolChoice(choice: unknown): ToolChoice | null {
  const entriesResult = getOwnEnumerableDataEntries(choice)
  if (!entriesResult.ok) return null

  const record = toNullProtoRecord(entriesResult.entries)
  const toolName = Object.prototype.hasOwnProperty.call(record, 'toolName') ? record.toolName : null
  if (toolName !== null && typeof toolName !== 'string') return null

  const say = record.say
  if (say !== undefined && typeof say !== 'string') return null

  const args = Object.prototype.hasOwnProperty.call(record, 'args') ? record.args : undefined
  if (args !== undefined && !isMcpArgsObject(args)) return null

  return {
    toolName,
    say,
    args: args as Record<string, unknown> | undefined,
  }
}

/**
 * Build an LLM-backed planner from a {@link ModelCall}. Projects the live registry
 * as MCP tools ({@link toMcpTools}), asks the model to pick one, then maps the
 * chosen tool name back to a command id using the same deterministic projection.
 * Any miss — empty registry, transport error, no tool chosen, unknown tool —
 * delegates to `fallback` (the deterministic {@link fuzzyPlanner} by default), so
 * callers degrade gracefully instead of dead-ending.
 */
export function createLlmPlanner(call: ModelCall, fallback: Planner = fuzzyPlanner): Planner {
  return async (input: string, registry: CommandRegistry) => {
    const tools = toMcpTools(registry)
    if (tools.length === 0) return fallback(input, registry)

    let rawChoice: ToolChoice
    try {
      rawChoice = await call({ input, tools, system: LLM_PLANNER_SYSTEM })
    } catch {
      return fallback(input, registry)
    }

    const choice = normalizeToolChoice(rawChoice)
    if (!choice?.toolName) return fallback(input, registry)

    const command = findMcpCommandEntryByName(registry, choice.toolName)
    if (!command) return fallback(input, registry)

    const validation = validateAndNormalizeMcpToolArgs(command.params, choice.args)
    if (!validation.ok) return fallback(input, registry)

    return {
      commandId: command.commandId,
      say: choice.say ?? `Running “${command.title}”.`,
      args: validation.args,
    }
  }
}
