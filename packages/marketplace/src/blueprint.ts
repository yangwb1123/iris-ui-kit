import type {
  IrisBlueprintNode,
  IrisCompiledBlueprintNode,
  IrisPageBlueprint,
  IrisViewPreset,
  JsonValue,
} from './types'

export interface BlueprintValidationOptions {
  allowedWidgets?: ReadonlySet<string>
  maxDepth?: number
  maxNodes?: number
}

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/
const FORBIDDEN_PROP = /^(?:on[A-Z]|dangerouslySetInnerHTML$|innerHTML$|component$)/

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 20) return false
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true
  }
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1))
  if (typeof value !== 'object') return false
  return Object.entries(value).every(
    ([key, item]) => !FORBIDDEN_PROP.test(key) && isJsonValue(item, depth + 1),
  )
}

function validateNode(
  node: IrisBlueprintNode,
  options: Required<Pick<BlueprintValidationOptions, 'maxDepth' | 'maxNodes'>> &
    BlueprintValidationOptions,
  path: string,
  depth: number,
  seenIds: Set<string>,
  count: { value: number },
  errors: string[],
): void {
  count.value += 1
  if (count.value > options.maxNodes) {
    errors.push(`nodes: exceeds maximum of ${options.maxNodes}`)
    return
  }
  if (depth > options.maxDepth) {
    errors.push(`${path}: exceeds maximum depth of ${options.maxDepth}`)
  }
  if (!IDENTIFIER.test(node.id)) errors.push(`${path}.id: invalid identifier`)
  else if (seenIds.has(node.id)) errors.push(`${path}.id: duplicate "${node.id}"`)
  else seenIds.add(node.id)
  if (!IDENTIFIER.test(node.widget)) errors.push(`${path}.widget: invalid widget key`)
  if (options.allowedWidgets && !options.allowedWidgets.has(node.widget)) {
    errors.push(`${path}.widget: "${node.widget}" is not in the local widget map`)
  }
  if (node.props && !isJsonValue(node.props)) {
    errors.push(`${path}.props: must be safe JSON without event/component injection keys`)
  }
  node.children?.forEach((child, index) =>
    validateNode(child, options, `${path}.children[${index}]`, depth + 1, seenIds, count, errors),
  )
}

export function validatePageBlueprint(
  blueprint: IrisPageBlueprint,
  options: BlueprintValidationOptions = {},
): string[] {
  const errors: string[] = []
  if (blueprint.schema !== 'iris-ui/page-blueprint@1') errors.push('schema: unsupported')
  if (!IDENTIFIER.test(blueprint.id)) errors.push('id: invalid identifier')
  if (!blueprint.version) errors.push('version: required')
  if (!Array.isArray(blueprint.nodes) || blueprint.nodes.length === 0) {
    errors.push('nodes: at least one node is required')
    return errors
  }
  const normalized = {
    ...options,
    maxDepth: options.maxDepth ?? 8,
    maxNodes: options.maxNodes ?? 200,
  }
  const ids = new Set<string>()
  const count = { value: 0 }
  blueprint.nodes.forEach((node, index) =>
    validateNode(node, normalized, `nodes[${index}]`, 0, ids, count, errors),
  )
  return errors
}

export function compilePageBlueprint(
  blueprint: IrisPageBlueprint,
  widgets: Readonly<Record<string, unknown>>,
  data: Readonly<Record<string, unknown>> = {},
): IrisCompiledBlueprintNode[] {
  const errors = validatePageBlueprint(blueprint, {
    allowedWidgets: new Set(Object.keys(widgets)),
  })
  if (errors.length > 0) throw new Error(`Invalid page blueprint\n- ${errors.join('\n- ')}`)
  const compile = (node: IrisBlueprintNode): IrisCompiledBlueprintNode => ({
    ...node,
    ...(node.dataKey ? { data: data[node.dataKey] } : {}),
    ...(node.children ? { children: node.children.map(compile) } : {}),
  })
  return blueprint.nodes.map(compile)
}

export function validateViewPreset(preset: IrisViewPreset): string[] {
  const errors: string[] = []
  if (preset.schema !== 'iris-ui/view-preset@1') errors.push('schema: unsupported')
  if (!IDENTIFIER.test(preset.id)) errors.push('id: invalid identifier')
  if (!preset.version) errors.push('version: required')
  if (
    preset.pageSize !== undefined &&
    (!Number.isInteger(preset.pageSize) || preset.pageSize < 1)
  ) {
    errors.push('pageSize: must be a positive integer')
  }
  if (preset.filters && !isJsonValue(preset.filters)) errors.push('filters: must be safe JSON')
  if (preset.sort?.some((sort) => !IDENTIFIER.test(sort.key))) {
    errors.push('sort: contains an invalid key')
  }
  return errors
}
