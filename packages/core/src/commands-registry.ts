import { createStore, type Store } from './store'

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

const isEnabled = (command: Command): boolean => (command.enabled ? command.enabled() : true)

function unregisterCommand(store: Store<CommandRegistryState>, id: string): void {
  store.setState((state) => ({ commands: state.commands.filter((command) => command.id !== id) }))
}

function registerCommand(store: Store<CommandRegistryState>, command: Command): () => void {
  store.setState((state) => ({
    commands: [...state.commands.filter((item) => item.id !== command.id), command],
  }))
  return () => unregisterCommand(store, command.id)
}

function registerManyCommands(store: Store<CommandRegistryState>, commands: Command[]): () => void {
  const ids = new Set(commands.map((command) => command.id))
  store.setState((state) => ({
    commands: [...state.commands.filter((command) => !ids.has(command.id)), ...commands],
  }))
  return () =>
    store.setState((state) => ({
      commands: state.commands.filter((command) => !ids.has(command.id)),
    }))
}

function searchCommands(
  store: Store<CommandRegistryState>,
  query: string,
  limit: number,
): CommandHit[] {
  const hits: CommandHit[] = []
  for (const command of store.getState().commands.filter(isEnabled)) {
    const haystack = `${command.title} ${command.keywords ?? ''} ${command.group ?? ''}`
    const score = fuzzyScore(haystack, query)
    if (score !== null) hits.push({ command, score })
  }
  hits.sort((a, b) => b.score - a.score || a.command.title.localeCompare(b.command.title))
  return hits.slice(0, limit)
}

async function runCommand(
  store: Store<CommandRegistryState>,
  id: string,
  args?: Record<string, unknown>,
): Promise<void> {
  const command = store.getState().commands.find((item) => item.id === id)
  if (command && isEnabled(command)) await command.run(args)
}

export function createCommandRegistry(): CommandRegistry {
  const store = createStore<CommandRegistryState>({ commands: [] })

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    register: (command) => registerCommand(store, command),
    registerMany: (commands) => registerManyCommands(store, commands),
    unregister: (id) => unregisterCommand(store, id),
    list: () => store.getState().commands.filter(isEnabled),
    search: (query, limit = 20) => searchCommands(store, query, limit),
    run: (id, args) => runCommand(store, id, args),
  }
}

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
