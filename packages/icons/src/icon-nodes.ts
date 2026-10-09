import type { IrisIconNode } from './types'
import {
  ATTRIBUTE_VALUE_VALIDATORS,
  isNumberValue,
  MAX_ATTRIBUTE_COUNT,
  MAX_ATTRIBUTE_LENGTH,
  MAX_NODE_COUNT,
  MAX_TREE_DEPTH,
  SAFE_EXTENSION_ATTR,
  SHAPE_TAGS,
} from './svg-safety'

export const SAFE_ICON_NODE_TAGS = new Set([
  ...SHAPE_TAGS,
  'clipPath',
  'defs',
  'g',
  'linearGradient',
  'mask',
  'radialGradient',
  'stop',
])
export const ICON_NODE_CONTAINER_TAGS = new Set([
  'clipPath',
  'defs',
  'g',
  'linearGradient',
  'mask',
  'radialGradient',
])
export const SAFE_ICON_NODE_ATTRS = new Set([
  'aria-hidden',
  'aria-label',
  'class',
  'clip-rule',
  'clip-path',
  'clipPathUnits',
  'cx',
  'cy',
  'd',
  'fill',
  'fill-rule',
  'fill-opacity',
  'fr',
  'fx',
  'fy',
  'gradientTransform',
  'gradientUnits',
  'height',
  'id',
  'mask',
  'mask-type',
  'maskContentUnits',
  'maskUnits',
  'offset',
  'opacity',
  'pathLength',
  'points',
  'r',
  'role',
  'rx',
  'ry',
  'spreadMethod',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'stroke-width',
  'transform',
  'vector-effect',
  'width',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2',
])

const NUMERIC_ATTRS = new Set([
  'cx',
  'cy',
  'fill-opacity',
  'fr',
  'fx',
  'fy',
  'height',
  'opacity',
  'offset',
  'pathLength',
  'r',
  'rx',
  'ry',
  'stop-opacity',
  'stroke-dashoffset',
  'stroke-opacity',
  'stroke-width',
  'width',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2',
])

function isIconNode(value: unknown): value is IrisIconNode {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const node = value as Partial<IrisIconNode>
  return (
    typeof node.tag === 'string' &&
    typeof node.attrs === 'object' &&
    node.attrs !== null &&
    !Array.isArray(node.attrs)
  )
}

function isSafeAttributeValue(name: string, rawValue: string | number): boolean {
  if (typeof rawValue === 'number' && !Number.isFinite(rawValue)) return false
  const value = String(rawValue)
  if (value.length > MAX_ATTRIBUTE_LENGTH) return false
  if (NUMERIC_ATTRS.has(name)) return isNumberValue(value)
  return ATTRIBUTE_VALUE_VALIDATORS[name]?.(value) ?? true
}

function hasOnlySafeAttributes(attrs: Record<string, string | number>): boolean {
  let count = 0
  for (const name in attrs) {
    if (!Object.hasOwn(attrs, name)) continue
    if (++count > MAX_ATTRIBUTE_COUNT) return false
    if (
      (!SAFE_ICON_NODE_ATTRS.has(name) && !SAFE_EXTENSION_ATTR.test(name)) ||
      !isSafeAttributeValue(name, attrs[name]!)
    ) {
      return false
    }
  }
  return true
}

function sanitizeAttributes(
  attrs: Record<string, string | number>,
): Record<string, string | number> {
  const result: Record<string, string | number> = {}
  let count = 0
  for (const name in attrs) {
    if (!Object.hasOwn(attrs, name)) continue
    if (++count > MAX_ATTRIBUTE_COUNT) break
    const value = attrs[name]!
    if (
      (SAFE_ICON_NODE_ATTRS.has(name) || SAFE_EXTENSION_ATTR.test(name)) &&
      isSafeAttributeValue(name, value)
    ) {
      result[name] = value
    }
  }
  return result
}

export function isAllowedIconNodeChild(parent: string, child: string): boolean {
  if (parent === 'linearGradient' || parent === 'radialGradient') return child === 'stop'
  if (parent === 'defs') {
    return (
      child === 'defs' || ['clipPath', 'linearGradient', 'mask', 'radialGradient'].includes(child)
    )
  }
  if (parent === 'g' || parent === 'clipPath' || parent === 'mask') {
    return SHAPE_TAGS.has(child) || child === 'g' || child === 'defs'
  }
  return false
}

export function isIconRootNodeTag(tag: string): boolean {
  return SHAPE_TAGS.has(tag) || tag === 'g' || tag === 'defs'
}

/**
 * Bound and sanitize an icon node tree before rendering. Custom registries can
 * be assembled in user code, so unlike provider-parsed data they may contain
 * cycles, unsafe tags or attributes, malformed children, or unexpectedly large
 * trees. Invalid branches and attributes are omitted; ordinary safe flat icon
 * arrays are returned without cloning.
 */
export function normalizeIconNodes(nodes: readonly IrisIconNode[]): readonly IrisIconNode[] {
  if (
    !Array.isArray(nodes) ||
    nodes.length === 0 ||
    (nodes.length <= MAX_NODE_COUNT &&
      nodes.every(
        (node) =>
          isIconNode(node) &&
          SAFE_ICON_NODE_TAGS.has(node.tag) &&
          isIconRootNodeTag(node.tag) &&
          hasOnlySafeAttributes(node.attrs) &&
          (node.children === undefined ||
            (Array.isArray(node.children) && node.children.length === 0)),
      ))
  ) {
    return Array.isArray(nodes) ? nodes : []
  }

  const active = new WeakSet<object>()
  let nodeCount = 0

  const visit = (value: unknown, depth: number, parent?: string): IrisIconNode | undefined => {
    if (
      !isIconNode(value) ||
      !SAFE_ICON_NODE_TAGS.has(value.tag) ||
      depth > MAX_TREE_DEPTH ||
      nodeCount >= MAX_NODE_COUNT ||
      (parent === undefined
        ? !isIconRootNodeTag(value.tag)
        : !isAllowedIconNodeChild(parent, value.tag))
    ) {
      return undefined
    }
    if (active.has(value)) return undefined

    nodeCount++
    active.add(value)
    const attrs = sanitizeAttributes(value.attrs)
    const children: IrisIconNode[] = []
    if (ICON_NODE_CONTAINER_TAGS.has(value.tag) && Array.isArray(value.children)) {
      for (const child of value.children) {
        const normalized = visit(child, depth + 1, value.tag)
        if (normalized) children.push(normalized)
        if (nodeCount >= MAX_NODE_COUNT) break
      }
    }
    active.delete(value)

    return children.length > 0 ? { tag: value.tag, attrs, children } : { tag: value.tag, attrs }
  }

  const result: IrisIconNode[] = []
  for (const node of nodes) {
    const normalized = visit(node, 0)
    if (normalized) result.push(normalized)
    if (nodeCount >= MAX_NODE_COUNT) break
  }
  return result
}
