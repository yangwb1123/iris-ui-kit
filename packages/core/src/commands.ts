import { createStore, type Store } from './store'

/**
 * `@iris-ui-kit/core/commands` — a framework-agnostic COMMAND / ACTION registry: the
 * substrate behind a command palette (⌘K) AND an automation/agent layer. Apps,
 * the window manager, and the shell `register` named actions; a palette searches
 * + runs them, and an MCP/agent can enumerate the same registry as tools and
 * invoke `run(id)` — so "an agent operates across the aggregated apps" reduces to
 * "every capability is a registered Command." Off the core path (own subpath).
 */

/**
 * A typed parameter a command accepts. Projected into the MCP tool `inputSchema`
 * ({@link toMcpTools}) so an agent/model can fill it, then handed to `run(args)`.
 */
export interface CommandParam {
  type: 'string' | 'number' | 'boolean'
  description?: string
  /** Required params land in the JSON-schema `required` list. */
  required?: boolean
  /** Restrict a string param to a fixed set of values. */
  enum?: string[]
}

export interface Command {
  id: string
  title: string
  /** Extra search terms (synonyms, app name, …). */
  keywords?: string
  /** Group label for the palette ('Apps', 'Window', 'System', …). */
  group?: string
  icon?: string
  /**
   * Typed parameters the command accepts, keyed by name. Param-less commands omit
   * this. Projected into the MCP tool schema so an agent can fill arguments.
   */
  params?: Record<string, CommandParam>
  /**
   * Invoke the command. May be async. Receives the caller-supplied `args` (an
   * agent/model fills them from {@link Command.params}; the palette runs with
   * none — param-less commands ignore the argument).
   */
  run: (args?: Record<string, unknown>) => void | Promise<void>
  /** When it returns false the command is hidden + run() is a no-op. */
  enabled?: () => boolean
}

export interface CommandHit {
  command: Command
  score: number
}

export interface CommandRegistryState {
  /** All registered commands, in registration order. */
  commands: Command[]
}

export interface CommandRegistry {
  store: Store<CommandRegistryState>
  getState(): CommandRegistryState
  subscribe(listener: (state: CommandRegistryState) => void): () => void
  /** Register a command; returns an unregister fn. Re-registering an id replaces it. */
  register(command: Command): () => void
  /** Register several; returns one unregister fn for all of them. */
  registerMany(commands: Command[]): () => void
  unregister(id: string): void
  /** Currently-enabled commands. */
  list(): Command[]
  /** Fuzzy-search enabled commands, best first. Empty query → all (by group/title). */
  search(query: string, limit?: number): CommandHit[]
  /** Run a command by id with optional args (no-op if missing/disabled). */
  run(id: string, args?: Record<string, unknown>): Promise<void>
}

/**
 * Subsequence fuzzy score of `query` within `text` (case-insensitive). Returns
 * null when `query` isn't a subsequence; higher is better. Rewards contiguous
 * runs, word-boundary starts, and early matches. Empty query → 0 (everything
 * matches equally).
 */
export function fuzzyScore(text: string, query: string): number | null {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const t = text.toLowerCase()
  let ti = 0
  let score = 0
  let streak = 0
  for (let qi = 0; qi < q.length; qi += 1) {
    const ch = q[qi]!
    let found = -1
    for (let i = ti; i < t.length; i += 1) {
      if (t[i] === ch) {
        found = i
        break
      }
    }
    if (found === -1) return null
    streak = found === ti ? streak + 1 : 0
    score += 10 + streak * 5 // contiguous matches compound
    if (found === 0 || ' /-_.'.includes(t[found - 1] ?? '')) score += 8 // word-boundary
    score -= Math.min(found - ti, 6) // penalize gaps a little
    ti = found + 1
  }
  return score
}

const isEnabled = (c: Command): boolean => (c.enabled ? c.enabled() : true)

export function createCommandRegistry(): CommandRegistry {
  const store = createStore<CommandRegistryState>({ commands: [] })

  const unregister = (id: string): void =>
    store.setState((s) => ({ commands: s.commands.filter((c) => c.id !== id) }))

  const register = (command: Command): (() => void) => {
    store.setState((s) => ({
      commands: [...s.commands.filter((c) => c.id !== command.id), command],
    }))
    return () => unregister(command.id)
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    register,
    registerMany(commands) {
      // Batch into one emit, return a single unregister.
      store.setState((s) => {
        const ids = new Set(commands.map((c) => c.id))
        return { commands: [...s.commands.filter((c) => !ids.has(c.id)), ...commands] }
      })
      return () =>
        store.setState((s) => {
          const ids = new Set(commands.map((c) => c.id))
          return { commands: s.commands.filter((c) => !ids.has(c.id)) }
        })
    },
    unregister,
    list: () => store.getState().commands.filter(isEnabled),

    search(query, limit = 20) {
      const enabled = store.getState().commands.filter(isEnabled)
      const hits: CommandHit[] = []
      for (const command of enabled) {
        const haystack = `${command.title} ${command.keywords ?? ''} ${command.group ?? ''}`
        const score = fuzzyScore(haystack, query)
        if (score !== null) hits.push({ command, score })
      }
      hits.sort((a, b) => b.score - a.score || a.command.title.localeCompare(b.command.title))
      return hits.slice(0, limit)
    },

    async run(id, args) {
      const command = store.getState().commands.find((c) => c.id === id)
      if (command && isEnabled(command)) await command.run(args)
    },
  }
}

/**
 * MCP / agent bridge — expose the registry's commands as model-callable TOOLS.
 * This is the seam that turns the command registry into an agent surface: an MCP
 * server (or an in-app LLM planner) enumerates {@link toMcpTools} and invokes
 * {@link runMcpTool} by name. A command's {@link Command.params} become the tool's
 * JSON-schema `inputSchema`, so an agent can fill arguments that flow through to
 * `run(args)`; param-less commands project an empty schema.
 */
/** A JSON-schema property derived from a {@link CommandParam}. */
export interface McpToolProperty {
  type: string
  description?: string
  enum?: string[]
}

export interface McpToolDef {
  /** MCP-safe tool name (`^[a-zA-Z0-9_-]+$`), derived from the command id. */
  name: string
  description: string
  /** JSON schema for the tool's arguments, projected from {@link Command.params}. */
  inputSchema: {
    type: 'object'
    properties: Record<string, McpToolProperty>
    required: string[]
  }
}

/** Make a command id MCP-tool-name-safe (the spec restricts the charset). */
export const toToolName = (id: string): string => id.replace(/[^a-zA-Z0-9_-]/g, '_')

/** Project a command's {@link Command.params} into a JSON-schema object. */
function paramsToSchema(params: Command['params']): McpToolDef['inputSchema'] {
  const properties: Record<string, McpToolProperty> = {}
  const required: string[] = []
  for (const [name, p] of Object.entries(params ?? {})) {
    const prop: McpToolProperty = { type: p.type }
    if (p.description) prop.description = p.description
    if (p.enum) prop.enum = p.enum
    properties[name] = prop
    if (p.required) required.push(name)
  }
  return { type: 'object', properties, required }
}

export function toMcpTools(registry: CommandRegistry): McpToolDef[] {
  return registry.list().map((c) => ({
    name: toToolName(c.id),
    description: c.group ? `${c.group}: ${c.title}` : c.title,
    inputSchema: paramsToSchema(c.params),
  }))
}

export interface McpToolResult {
  ok: boolean
  ran?: string
  error?: string
}

/** Invoke a command by its MCP tool name (what an agent calls), with optional args. */
export async function runMcpTool(
  registry: CommandRegistry,
  name: string,
  args?: Record<string, unknown>,
): Promise<McpToolResult> {
  const command = registry.list().find((c) => toToolName(c.id) === name)
  if (!command) return { ok: false, error: `unknown tool: ${name}` }
  await registry.run(command.id, args)
  return { ok: true, ran: command.id }
}

/**
 * AGENT PLANNER over the registry — turn natural-language input into a chosen
 * command. The deterministic {@link fuzzyPlanner} is the default; {@link createLlmPlanner}
 * is a drop-in that asks a model (via an injected {@link ModelCall}) to pick a
 * command by tool name over {@link toMcpTools}. Framework-agnostic by design: every
 * desktop shell (React/Vue/Solid/Svelte) consumes the SAME planner, supplying its
 * own SDK-backed transport for the `ModelCall` — so "the assistant picks the
 * command via a model" is one logic across all four frameworks.
 */

export interface PlanResult {
  /** The chosen command id. */
  commandId: string
  /** A short line to show the user. */
  say: string
  /** Arguments to pass to the command's `run` (filled by an LLM planner from the
   * command's params; `undefined` for the deterministic planner). */
  args?: Record<string, unknown>
}

/**
 * Turn `input` into a chosen command (+ what to `say`), reading the live registry.
 * Returns `null` when nothing matches. May be ASYNC — an LLM planner awaits a
 * model call.
 */
export type Planner = (
  input: string,
  registry: CommandRegistry,
) => PlanResult | null | Promise<PlanResult | null>

/** Deterministic planner: fuzzy-match → top command. Synchronous; `null` on no match. */
export const fuzzyPlanner = (input: string, registry: CommandRegistry): PlanResult | null => {
  const top = registry.search(input, 1)[0]?.command
  if (!top) return null
  return { commandId: top.id, say: `Running “${top.title}”.` }
}

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

/**
 * Build an LLM-backed planner from a {@link ModelCall}. Projects the live registry
 * as MCP tools ({@link toMcpTools}), asks the model to pick one, then maps the
 * chosen tool name back to a command id ({@link toToolName}). Any miss — empty
 * registry, transport error, no tool chosen, unknown tool — delegates to
 * `fallback` (the deterministic {@link fuzzyPlanner} by default), so callers
 * degrade gracefully instead of dead-ending.
 */
export function createLlmPlanner(call: ModelCall, fallback: Planner = fuzzyPlanner): Planner {
  return async (input, registry) => {
    const tools = toMcpTools(registry)
    if (tools.length === 0) return fallback(input, registry)
    let choice: ToolChoice
    try {
      choice = await call({ input, tools, system: LLM_PLANNER_SYSTEM })
    } catch {
      return fallback(input, registry)
    }
    if (!choice.toolName) return fallback(input, registry)
    const command = registry.list().find((c) => toToolName(c.id) === choice.toolName)
    if (!command) return fallback(input, registry)
    return {
      commandId: command.id,
      say: choice.say ?? `Running “${command.title}”.`,
      args: choice.args,
    }
  }
}
