import {
  ICON_NODE_CONTAINER_TAGS,
  isAllowedIconNodeChild,
  isIconRootNodeTag,
  SAFE_ICON_NODE_TAGS,
} from './icon-nodes'
import { iconifyFail as fail } from './iconify-provider-errors'
import {
  DEFINITION_TAGS,
  GRADIENT_TAGS,
  LOCAL_REFERENCE,
  MAX_ATTRIBUTE_COUNT,
  MAX_ATTRIBUTE_LENGTH,
  MAX_BODY_LENGTH,
  MAX_NODE_COUNT,
  MAX_TREE_DEPTH,
  SHAPE_TAG_SET,
  XML_NAME,
  decodeXmlAttribute,
  validateAttribute,
} from './iconify-provider-security'
import type { IrisIconNode } from './types'

function skipWhitespace(value: string, start: number): number {
  let cursor = start
  while (/\s/.test(value[cursor] ?? '')) cursor++
  return cursor
}

function readAttribute(
  body: string,
  start: number,
  tag: string,
  iconName: string,
): { name: string; value: string; next: number } {
  const match = XML_NAME.exec(body.slice(start))
  if (!match) return fail('unsafe-icon', `malformed SVG attributes in Iconify icon "${iconName}"`)

  const name = match[0]
  let cursor = skipWhitespace(body, start + name.length)
  if (body[cursor] !== '=') {
    return fail('unsafe-icon', `missing SVG attribute value in Iconify icon "${iconName}"`)
  }
  cursor = skipWhitespace(body, cursor + 1)
  const quote = body[cursor]
  if (quote !== '"' && quote !== "'") {
    return fail('unsafe-icon', `unquoted SVG attribute in Iconify icon "${iconName}"`)
  }

  const valueStart = cursor + 1
  cursor = valueStart
  while (cursor < body.length && body[cursor] !== quote) {
    if (body[cursor] === '<') {
      return fail('unsafe-icon', `invalid character in SVG attribute in Iconify icon "${iconName}"`)
    }
    cursor++
  }
  if (cursor >= body.length) {
    return fail('unsafe-icon', `unterminated SVG attribute in Iconify icon "${iconName}"`)
  }
  if (cursor - valueStart > MAX_ATTRIBUTE_LENGTH) {
    return fail('limit-exceeded', `SVG attribute is too large in Iconify icon "${iconName}"`)
  }

  const value = decodeXmlAttribute(body.slice(valueStart, cursor), iconName)
  validateAttribute(tag, name, value, iconName)
  return { name, value, next: cursor + 1 }
}

interface ParsedOpeningTag {
  tag: string
  attrs: Record<string, string>
  selfClosing: boolean
  next: number
}

interface ParseBudget {
  nodeCount: number
}

function readOpeningTag(body: string, start: number, iconName: string): ParsedOpeningTag {
  const tagMatch = XML_NAME.exec(body.slice(start + 1))
  if (!tagMatch || !SAFE_ICON_NODE_TAGS.has(tagMatch[0])) {
    return fail('unsafe-icon', `unsupported SVG element in Iconify icon "${iconName}"`)
  }

  const tag = tagMatch[0]
  let cursor = start + 1 + tag.length
  const attrs: Record<string, string> = {}
  let attrCount = 0
  while (cursor < body.length) {
    const beforeWhitespace = cursor
    cursor = skipWhitespace(body, cursor)
    if (body.startsWith('/>', cursor)) {
      return { tag, attrs, selfClosing: true, next: cursor + 2 }
    }
    if (body[cursor] === '>') return { tag, attrs, selfClosing: false, next: cursor + 1 }
    if (cursor === beforeWhitespace) {
      return fail('unsafe-icon', `malformed SVG attributes in Iconify icon "${iconName}"`)
    }

    const attr = readAttribute(body, cursor, tag, iconName)
    if (Object.hasOwn(attrs, attr.name)) {
      return fail(
        'unsafe-icon',
        `duplicate SVG attribute "${attr.name}" in Iconify icon "${iconName}"`,
      )
    }
    attrCount++
    if (attrCount > MAX_ATTRIBUTE_COUNT) {
      return fail('limit-exceeded', `too many SVG attributes in Iconify icon "${iconName}"`)
    }
    attrs[attr.name] = attr.value
    cursor = attr.next
  }

  return fail('unsafe-icon', `unterminated SVG element in Iconify icon "${iconName}"`)
}

function readClosingTag(body: string, start: number, tag: string, iconName: string): number {
  if (!body.startsWith('</', start)) {
    return fail('unsafe-icon', `expected closing SVG element in Iconify icon "${iconName}"`)
  }
  let cursor = start + 2
  const match = XML_NAME.exec(body.slice(cursor))
  if (!match || match[0] !== tag) {
    return fail('unsafe-icon', `mismatched SVG element in Iconify icon "${iconName}"`)
  }
  cursor = skipWhitespace(body, cursor + match[0].length)
  if (body[cursor] !== '>') {
    return fail('unsafe-icon', `malformed SVG closing element in Iconify icon "${iconName}"`)
  }
  return cursor + 1
}

function parseNode(
  body: string,
  start: number,
  iconName: string,
  depth: number,
  budget: ParseBudget,
): { node: IrisIconNode; next: number } {
  if (depth > MAX_TREE_DEPTH) {
    return fail('limit-exceeded', `SVG nesting is too deep in Iconify icon "${iconName}"`)
  }
  budget.nodeCount++
  if (budget.nodeCount > MAX_NODE_COUNT) {
    return fail('limit-exceeded', `too many SVG elements in Iconify icon "${iconName}"`)
  }

  const opening = readOpeningTag(body, start, iconName)
  const node: IrisIconNode = { tag: opening.tag, attrs: opening.attrs }
  if (opening.selfClosing) return { node, next: opening.next }

  let cursor = skipWhitespace(body, opening.next)
  if (!ICON_NODE_CONTAINER_TAGS.has(opening.tag)) {
    if (!body.startsWith('</', cursor)) {
      return fail(
        'unsafe-icon',
        `nested content is not supported in SVG <${opening.tag}> in Iconify icon "${iconName}"`,
      )
    }
    return { node, next: readClosingTag(body, cursor, opening.tag, iconName) }
  }

  const children: IrisIconNode[] = []
  while (cursor < body.length) {
    cursor = skipWhitespace(body, cursor)
    if (body.startsWith('</', cursor)) {
      node.children = children
      return { node, next: readClosingTag(body, cursor, opening.tag, iconName) }
    }
    if (cursor >= body.length || body[cursor] !== '<' || body.startsWith('<!', cursor)) {
      return fail('unsafe-icon', `unexpected SVG text or markup in Iconify icon "${iconName}"`)
    }
    const child = parseNode(body, cursor, iconName, depth + 1, budget)
    if (!isAllowedIconNodeChild(opening.tag, child.node.tag)) {
      return fail(
        'unsafe-icon',
        `unsupported <${child.node.tag}> child in <${opening.tag}> in Iconify icon "${iconName}"`,
      )
    }
    children.push(child.node)
    cursor = child.next
  }

  return fail('unsafe-icon', `unterminated SVG element in Iconify icon "${iconName}"`)
}

function nodeReferences(node: IrisIconNode): Array<{ id: string; kind: string }> {
  const result: Array<{ id: string; kind: string }> = []
  for (const attr of ['fill', 'stroke']) {
    const match = LOCAL_REFERENCE.exec(String(node.attrs[attr] ?? ''))
    if (match) result.push({ id: match[1]!, kind: 'gradient' })
  }
  for (const [attr, kind] of [
    ['clip-path', 'clipPath'],
    ['mask', 'mask'],
  ]) {
    const match = LOCAL_REFERENCE.exec(String(node.attrs[attr] ?? ''))
    if (match) result.push({ id: match[1]!, kind })
  }
  return result
}

function validateReferences(nodes: readonly IrisIconNode[], iconName: string): void {
  const definitions = new Map<string, string>()
  const visitIds = (node: IrisIconNode): void => {
    const id = node.attrs.id
    if (typeof id === 'string') {
      if (!DEFINITION_TAGS.has(node.tag)) {
        fail('unsafe-icon', `SVG id on unsupported <${node.tag}> in Iconify icon "${iconName}"`)
      }
      if (definitions.has(id)) {
        fail('unsafe-icon', `duplicate SVG id "${id}" in Iconify icon "${iconName}"`)
      }
      definitions.set(id, node.tag)
    }
    for (const child of node.children ?? []) visitIds(child)
  }
  for (const node of nodes) visitIds(node)

  const references = new Map<string, Set<string>>()
  const collectRefs = (node: IrisIconNode, output: Set<string>, root: boolean): void => {
    if (!root && typeof node.attrs.id === 'string' && DEFINITION_TAGS.has(node.tag)) return
    for (const reference of nodeReferences(node)) output.add(reference.id)
    for (const child of node.children ?? []) collectRefs(child, output, false)
  }

  for (const node of nodes) {
    const addDefinition = (current: IrisIconNode): void => {
      if (typeof current.attrs.id === 'string' && DEFINITION_TAGS.has(current.tag)) {
        const deps = new Set<string>()
        collectRefs(current, deps, true)
        references.set(current.attrs.id, deps)
      }
      for (const child of current.children ?? []) addDefinition(child)
    }
    addDefinition(node)
  }

  const validateNodeRefs = (node: IrisIconNode): void => {
    for (const reference of nodeReferences(node)) {
      const target = definitions.get(reference.id)
      const validTarget =
        target !== undefined &&
        (reference.kind === 'gradient' ? GRADIENT_TAGS.has(target) : target === reference.kind)
      if (!validTarget) {
        fail(
          'unsafe-icon',
          `unresolved or incompatible SVG reference "${reference.id}" in Iconify icon "${iconName}"`,
        )
      }
    }
    for (const child of node.children ?? []) validateNodeRefs(child)
  }
  for (const node of nodes) validateNodeRefs(node)

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visitDependencies = (id: string): void => {
    if (visiting.has(id))
      fail('unsafe-icon', `cyclic SVG definitions in Iconify icon "${iconName}"`)
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of references.get(id) ?? []) {
      if (references.has(dependency)) visitDependencies(dependency)
    }
    visiting.delete(id)
    visited.add(id)
  }
  for (const id of references.keys()) visitDependencies(id)
}

function hasRenderableGeometry(node: IrisIconNode): boolean {
  if (SHAPE_TAG_SET.has(node.tag)) return true
  return node.tag === 'g' && (node.children ?? []).some(hasRenderableGeometry)
}

export function parseIconifyBody(body: string, iconName: string): IrisIconNode[] {
  if (body.length > MAX_BODY_LENGTH) {
    return fail('limit-exceeded', `SVG body is too large in Iconify icon "${iconName}"`)
  }
  const nodes: IrisIconNode[] = []
  const budget: ParseBudget = { nodeCount: 0 }
  let cursor = 0
  while (cursor < body.length) {
    cursor = skipWhitespace(body, cursor)
    if (cursor >= body.length) break
    if (body[cursor] !== '<' || body.startsWith('</', cursor) || body.startsWith('<!', cursor)) {
      return fail('unsafe-icon', `unexpected SVG text or markup in Iconify icon "${iconName}"`)
    }
    const parsed = parseNode(body, cursor, iconName, 0, budget)
    if (!isIconRootNodeTag(parsed.node.tag)) {
      return fail('unsafe-icon', `unsupported root SVG element in Iconify icon "${iconName}"`)
    }
    nodes.push(parsed.node)
    cursor = parsed.next
  }
  if (nodes.length === 0 || !nodes.some(hasRenderableGeometry)) {
    return fail('unsafe-icon', `Iconify icon "${iconName}" contains no visible SVG geometry`)
  }
  validateReferences(nodes, iconName)
  return nodes
}
