import type { Command, CommandParam, CommandRegistry } from './commands-registry'

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

const MCP_TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/

function isValidMcpToolName(name: string): boolean {
  return MCP_TOOL_NAME_PATTERN.test(name)
}

type McpParamDefinitionsValidation =
  { ok: true; params: Record<string, CommandParam> } | { ok: false; error: string }

export interface McpToolArgsValidation {
  ok: boolean
  error?: string
}

export interface McpToolResult {
  ok: boolean
  ran?: string
  error?: string
}

export interface McpToolArgsValidationResult extends McpToolArgsValidation {
  args?: Record<string, unknown>
}

export interface McpCommandEntry {
  command: Command
  commandId: string
  title: string
  group?: string
  params: Record<string, CommandParam>
  name: string
}

interface NormalizedMcpCommand {
  command: Command
  id: string
  title: string
  group?: string
  params: Record<string, CommandParam>
}

export function getOwnEnumerableDataEntries(
  value: unknown,
): { ok: true; entries: Array<[string, unknown]> } | { ok: false } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { ok: false }

  let descriptors: Record<string, PropertyDescriptor>
  try {
    descriptors = Object.getOwnPropertyDescriptors(value)
  } catch {
    return { ok: false }
  }

  const entries: Array<[string, unknown]> = []
  for (const key of Object.keys(descriptors)) {
    const descriptor = descriptors[key]
    if (!descriptor?.enumerable) continue
    if ('get' in descriptor || 'set' in descriptor) return { ok: false }
    entries.push([key, descriptor.value])
  }
  return { ok: true, entries }
}

export function toNullProtoRecord<T>(entries: Array<[string, T]>): Record<string, T> {
  const record = Object.create(null) as Record<string, T>
  for (const [key, value] of entries) record[key] = value
  return record
}

function normalizeMcpStringEnum(value: unknown): string[] | undefined | null {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return null

  let descriptors: Record<string, PropertyDescriptor>
  try {
    descriptors = Object.getOwnPropertyDescriptors(value)
  } catch {
    return null
  }

  const lengthDescriptor = descriptors.length
  if (!lengthDescriptor || 'get' in lengthDescriptor || 'set' in lengthDescriptor) return null

  const length = lengthDescriptor.value
  if (!Number.isSafeInteger(length) || length < 0) return null

  const items: string[] = []
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[`${index}`]
    if (
      !descriptor ||
      !descriptor.enumerable ||
      'get' in descriptor ||
      'set' in descriptor ||
      typeof descriptor.value !== 'string'
    ) {
      return null
    }
    items.push(descriptor.value)
  }
  return items
}

function normalizeMcpParamDefinition(value: unknown): CommandParam | null {
  const entriesResult = getOwnEnumerableDataEntries(value)
  if (!entriesResult.ok) return null

  const record = toNullProtoRecord(entriesResult.entries)
  const type = record.type
  if (type !== 'string' && type !== 'number' && type !== 'boolean') return null

  const description = record.description
  if (description !== undefined && typeof description !== 'string') return null

  const required = record.required
  if (required !== undefined && typeof required !== 'boolean') return null

  const enumValues = normalizeMcpStringEnum(record.enum)
  if (enumValues === null) return null
  if (enumValues !== undefined && type !== 'string') return null

  const param: CommandParam = { type }
  if (description !== undefined) param.description = description
  if (required !== undefined) param.required = required
  if (enumValues !== undefined) param.enum = enumValues
  return param
}

function validateMcpParamDefinitions(params: Command['params']): McpParamDefinitionsValidation {
  if (params === undefined) {
    return { ok: true, params: Object.create(null) as Record<string, CommandParam> }
  }

  const entriesResult = getOwnEnumerableDataEntries(params)
  if (!entriesResult.ok) {
    return { ok: false, error: 'invalid command definition: params must be an object' }
  }

  const definitions = Object.create(null) as Record<string, CommandParam>
  for (const [name, value] of entriesResult.entries) {
    const param = normalizeMcpParamDefinition(value)
    if (!param) {
      return { ok: false, error: `invalid command definition: invalid parameter: ${name}` }
    }
    definitions[name] = param
  }
  return { ok: true, params: definitions }
}

/** Project a command's {@link Command.params} into a JSON-schema object. */
function paramsToSchema(params: Command['params']): McpToolDef['inputSchema'] {
  const validated = validateMcpParamDefinitions(params)
  if (!validated.ok) {
    return {
      type: 'object',
      properties: Object.create(null) as Record<string, McpToolProperty>,
      required: [],
    }
  }

  const properties = Object.create(null) as Record<string, McpToolProperty>
  const required: string[] = []
  for (const [name, param] of Object.entries(validated.params)) {
    const property: McpToolProperty = { type: param.type }
    if (param.description) property.description = param.description
    if (param.enum) property.enum = param.enum
    properties[name] = property
    if (param.required) required.push(name)
  }
  return { type: 'object', properties, required }
}

function isEnabledForMcp(command: Command): boolean {
  try {
    if (command.enabled === undefined) return true
    return typeof command.enabled === 'function' ? command.enabled() : false
  } catch {
    return false
  }
}

function normalizeMcpCommand(command: Command): NormalizedMcpCommand | null {
  try {
    if (typeof command.id !== 'string' || typeof command.title !== 'string') return null
    if (command.group !== undefined && typeof command.group !== 'string') return null

    const paramsValidation = validateMcpParamDefinitions(command.params)
    if (!paramsValidation.ok) return null

    const name = toToolName(command.id)
    if (!isValidMcpToolName(name)) return null

    return {
      command,
      id: command.id,
      title: command.title,
      group: command.group,
      params: paramsValidation.params,
    }
  } catch {
    return null
  }
}

function getRegistryCommandsForMcp(registry: CommandRegistry): Command[] {
  try {
    const commands = registry.getState().commands
    return Array.isArray(commands) ? commands : []
  } catch {
    return []
  }
}

/**
 * Allocate MCP names in registry order. Reserve every unsuffixed name first so
 * a collision suffix cannot steal an unrelated command's existing name.
 */
function mcpCommandEntries(commands: Command[]): McpCommandEntry[] {
  const safeCommands = commands
    .filter(isEnabledForMcp)
    .map((command) => normalizeMcpCommand(command))
    .filter((command): command is NormalizedMcpCommand => command !== null)
  const bases = new Set(safeCommands.map((command) => toToolName(command.id)))
  const used = new Set<string>()
  const nextSuffix = new Map<string, number>()
  const entries: McpCommandEntry[] = []

  for (const command of safeCommands) {
    const base = toToolName(command.id)
    let name = base
    if (used.has(name)) {
      let suffix = nextSuffix.get(base) ?? 1
      do {
        suffix += 1
        name = `${base}_${suffix}`
      } while (used.has(name) || bases.has(name))
      nextSuffix.set(base, suffix)
    } else {
      nextSuffix.set(base, 1)
    }
    used.add(name)
    entries.push({
      command: command.command,
      commandId: command.id,
      title: command.title,
      group: command.group,
      params: command.params,
      name,
    })
  }
  return entries
}

export function toMcpTools(registry: CommandRegistry): McpToolDef[] {
  return mcpCommandEntries(getRegistryCommandsForMcp(registry)).map(
    ({ name, title, group, params }) => ({
      name,
      description: group ? `${group}: ${title}` : title,
      inputSchema: paramsToSchema(params),
    }),
  )
}

export function isMcpArgsObject(args: unknown): args is Record<string, unknown> {
  return args === undefined || (args !== null && typeof args === 'object' && !Array.isArray(args))
}

function normalizeMcpArgs(args: unknown): McpToolArgsValidationResult {
  if (args === undefined) return { ok: true, args: undefined }
  if (!isMcpArgsObject(args)) return { ok: false, error: 'invalid arguments: expected an object' }

  const entriesResult = getOwnEnumerableDataEntries(args)
  if (!entriesResult.ok) return { ok: false, error: 'invalid arguments: expected an object' }

  return { ok: true, args: toNullProtoRecord(entriesResult.entries) }
}

function isMcpParamValueValid(param: CommandParam, value: unknown): boolean {
  if (param.type === 'string') return typeof value === 'string'
  if (param.type === 'number') return typeof value === 'number' && Number.isFinite(value)
  return typeof value === 'boolean'
}

function validateMcpParamValue(
  name: string,
  param: CommandParam,
  value: unknown,
): string | undefined {
  if (!isMcpParamValueValid(param, value)) {
    return `invalid arguments: invalid type for argument: ${name}`
  }
  if (param.type === 'string' && param.enum && !param.enum.includes(value as string)) {
    return `invalid arguments: invalid value for argument: ${name}`
  }
  return undefined
}

export function validateAndNormalizeMcpToolArgs(
  params: Command['params'],
  args: unknown,
): McpToolArgsValidationResult {
  const argsValidation = normalizeMcpArgs(args)
  if (!argsValidation.ok) return argsValidation

  const definitionsValidation = validateMcpParamDefinitions(params)
  if (!definitionsValidation.ok) return { ok: false, error: definitionsValidation.error }

  const supplied = argsValidation.args ?? (Object.create(null) as Record<string, unknown>)
  const definitions = definitionsValidation.params
  for (const name of Object.keys(definitions)) {
    const param = definitions[name]!
    if (param.required && !Object.prototype.hasOwnProperty.call(supplied, name)) {
      return { ok: false, error: `invalid arguments: missing required argument: ${name}` }
    }
  }
  for (const name of Object.keys(supplied)) {
    const param = definitions[name]
    if (!param) return { ok: false, error: `invalid arguments: unknown argument: ${name}` }

    const error = validateMcpParamValue(name, param, supplied[name])
    if (error) return { ok: false, error }
  }
  return { ok: true, args: argsValidation.args }
}

/** Validate MCP arguments against the command's projected JSON-schema inputs. */
export function validateMcpToolArgs(
  params: Command['params'],
  args: unknown,
): McpToolArgsValidation {
  const validation = validateAndNormalizeMcpToolArgs(params, args)
  return validation.ok ? { ok: true } : { ok: false, error: validation.error }
}

export function findMcpCommandEntryByName(
  registry: CommandRegistry,
  name: string,
): McpCommandEntry | undefined {
  return mcpCommandEntries(getRegistryCommandsForMcp(registry)).find((entry) => entry.name === name)
}

/** Invoke a command by its MCP tool name (what an agent calls), with optional args. */
export async function runMcpTool(
  registry: CommandRegistry,
  name: string,
  args?: Record<string, unknown>,
): Promise<McpToolResult> {
  const commands = getRegistryCommandsForMcp(registry)
  const entry = mcpCommandEntries(commands).find((candidate) => candidate.name === name)
  if (!entry) {
    const disabled = commands.find((command) => {
      if (isEnabledForMcp(command)) return false
      const normalized = normalizeMcpCommand(command)
      return normalized ? toToolName(normalized.id) === name : false
    })
    if (disabled) return { ok: false, error: `disabled tool: ${name}` }
    return { ok: false, error: `unknown tool: ${name}` }
  }

  const validation = validateAndNormalizeMcpToolArgs(entry.params, args)
  if (!validation.ok) return { ok: false, error: validation.error }

  try {
    await registry.run(entry.commandId, validation.args)
  } catch {
    return { ok: false, error: `command failed: ${entry.commandId}` }
  }
  return { ok: true, ran: entry.commandId }
}
