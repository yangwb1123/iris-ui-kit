/**
 * `@iris-ui-kit/core/commands` — a framework-agnostic COMMAND / ACTION registry: the
 * substrate behind a command palette (⌘K) AND an automation/agent layer. Apps,
 * the window manager, and the shell `register` named actions; a palette searches
 * + runs them, and an MCP/agent can enumerate the same registry as tools and
 * invoke `run(id)` — so "an agent operates across the aggregated apps" reduces to
 * "every capability is a registered Command." Off the core path (own subpath).
 */

export {
  createCommandRegistry,
  fuzzyPlanner,
  fuzzyScore,
  type Command,
  type CommandHit,
  type CommandParam,
  type CommandRegistry,
  type CommandRegistryState,
  type PlanResult,
  type Planner,
} from './commands-registry'
export {
  runMcpTool,
  toMcpTools,
  toToolName,
  validateMcpToolArgs,
  type McpToolArgsValidation,
  type McpToolDef,
  type McpToolProperty,
  type McpToolResult,
} from './commands-mcp'
export {
  createLlmPlanner,
  LLM_PLANNER_SYSTEM,
  type ModelCall,
  type ToolChoice,
} from './commands-llm'
