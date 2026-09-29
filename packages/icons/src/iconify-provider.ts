import {
  ICON_NODE_CONTAINER_TAGS,
  isAllowedIconNodeChild,
  isIconRootNodeTag,
  SAFE_ICON_NODE_TAGS,
} from './icon-nodes'
import type { IrisIcon, IrisIconNode, IrisIconSet } from './types'

const DEFAULT_API_URL = 'https://api.iconify.design'
const MAX_ICON_COUNT = 100
const MAX_RESPONSE_BYTES = 1_000_000
const MAX_BODY_LENGTH = 65_536
const MAX_NODE_COUNT = 512
const MAX_TREE_DEPTH = 16
const MAX_ATTRIBUTE_COUNT = 32
const MAX_ATTRIBUTE_LENGTH = 32_768
const SHAPE_TAG_SET = new Set(['circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'rect'])
const PRESENTATION_ATTRIBUTES = [
  'clip-rule',
  'fill',
  'fill-rule',
  'fill-opacity',
  'mask',
  'opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'stroke-width',
  'transform',
  'vector-effect',
  'clip-path',
] as const
const SAFE_SHAPE_ATTRIBUTES = new Set([
  ...PRESENTATION_ATTRIBUTES,
  'clip-rule',
  'cx',
  'cy',
  'd',
  'height',
  'pathLength',
  'points',
  'r',
  'rx',
  'ry',
  'width',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2',
])
const SAFE_ATTRIBUTES: Record<string, Set<string>> = {
  circle: SAFE_SHAPE_ATTRIBUTES,
  ellipse: SAFE_SHAPE_ATTRIBUTES,
  line: SAFE_SHAPE_ATTRIBUTES,
  path: SAFE_SHAPE_ATTRIBUTES,
  polygon: SAFE_SHAPE_ATTRIBUTES,
  polyline: SAFE_SHAPE_ATTRIBUTES,
  rect: SAFE_SHAPE_ATTRIBUTES,
  g: new Set(PRESENTATION_ATTRIBUTES),
  defs: new Set(),
  clipPath: new Set(['clipPathUnits', 'id', 'transform']),
  mask: new Set([
    ...PRESENTATION_ATTRIBUTES,
    'height',
    'id',
    'mask-type',
    'maskContentUnits',
    'maskUnits',
    'width',
    'x',
    'y',
  ]),
  linearGradient: new Set([
    'gradientTransform',
    'gradientUnits',
    'id',
    'spreadMethod',
    'x1',
    'x2',
    'y1',
    'y2',
  ]),
  radialGradient: new Set([
    'cx',
    'cy',
    'fr',
    'fx',
    'fy',
    'gradientTransform',
    'gradientUnits',
    'id',
    'r',
    'spreadMethod',
  ]),
  stop: new Set(['offset', 'stop-color', 'stop-opacity']),
}
const DEFINITION_TAGS = new Set(['clipPath', 'linearGradient', 'mask', 'radialGradient'])
const GRADIENT_TAGS = new Set(['linearGradient', 'radialGradient'])
const XML_NAME = /^[A-Za-z_][A-Za-z0-9_.:-]*/
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?%?$/
const NUMBER_LIST = /^[\s,+\-.\deE]+$/
const PATH_DATA = /^[\s,+\-.\deEMmZzLlHhVvCcSsQqTtAa]+$/
const TRANSFORM = /^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\s*\(\s*[+\-.\deE,\s]+\)\s*)+$/
const LOCAL_REFERENCE = /^url\(#([A-Za-z_][A-Za-z0-9_.:-]{0,127})\)$/
const SAFE_ID = /^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/
const SAFE_PAINT = new Set([
  'aqua',
  'black',
  'blue',
  'brown',
  'currentcolor',
  'cyan',
  'fuchsia',
  'gray',
  'green',
  'grey',
  'lime',
  'magenta',
  'maroon',
  'navy',
  'none',
  'olive',
  'orange',
  'purple',
  'red',
  'silver',
  'teal',
  'transparent',
  'white',
  'yellow',
])

export type IconifyProviderErrorCode =
  | 'configuration'
  | 'http'
  | 'invalid-name'
  | 'invalid-response'
  | 'limit-exceeded'
  | 'missing-icon'
  | 'network'
  | 'unsafe-icon'

/** Error returned for invalid Iconify data, failed requests, or unsafe SVG content. */
export class IconifyProviderError extends Error {
  constructor(
    readonly code: IconifyProviderErrorCode,
    message: string,
  ) {
    super(`[iris-ui] ${message}`)
    this.name = 'IconifyProviderError'
  }
}

/** Minimal response surface required from a fetch implementation. */
export interface IconifyFetchResponse {
  ok: boolean
  status: number
  text(): Promise<string>
}

/** Fetch signature kept structural so the icons package does not require DOM types. */
export type IconifyFetch = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<IconifyFetchResponse>

export interface IconifyProviderOptions {
  /** Iconify-compatible JSON API base URL. Defaults to https://api.iconify.design. */
  apiUrl?: string
  /** Inject fetch for tests, custom transports, or restricted environments. */
  fetch?: IconifyFetch
  /** Registry set name returned by loadIcons(). Defaults to `iconify`. */
  setName?: string
}

export interface IconifyProvider {
  /**
   * Fetch and validate semantic names such as `mdi:home`, returning an Iris icon
   * set ready for `createIconRegistry({ sets: [set] })`. Each prefix is fetched
   * separately; no remote SVG markup is passed to the renderer.
   */
  loadIcons(names: readonly string[]): Promise<IrisIconSet>
  /** Fetch one fully-qualified Iconify name. */
  loadIcon(name: string): Promise<IrisIcon>
}

interface QualifiedName {
  prefix: string
  name: string
  fullName: string
}

function fail(code: IconifyProviderErrorCode, message: string): never {
  throw new IconifyProviderError(code, message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseQualifiedName(value: string): QualifiedName {
  const match = /^([a-z0-9]+(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(value)
  if (!match) {
    return fail(
      'invalid-name',
      `invalid Iconify name "${value}"; expected a lowercase "prefix:name" identifier`,
    )
  }
  return { prefix: match[1]!, name: match[2]!, fullName: value }
}

function isValidXmlCharacter(codePoint: number): boolean {
  return (
    codePoint === 0x9 ||
    codePoint === 0xa ||
    codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff)
  )
}

function decodeXmlEntity(token: string, iconName: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
  }
  if (Object.hasOwn(named, token)) return named[token]!

  const codePoint = token.startsWith('#x')
    ? Number.parseInt(token.slice(2), 16)
    : Number.parseInt(token.slice(1), 10)
  if (!isValidXmlCharacter(codePoint)) {
    return fail('unsafe-icon', `invalid XML character in Iconify icon "${iconName}"`)
  }
  return String.fromCodePoint(codePoint)
}

function decodeXmlAttribute(value: string, iconName: string): string {
  const decoded = value.replace(
    /&(#x[\da-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g,
    (_entity, token: string) => decodeXmlEntity(token, iconName),
  )
  if (decoded.includes('&')) {
    return fail('unsafe-icon', `unsupported XML entity in Iconify icon "${iconName}"`)
  }
  return decoded
}

function isSafeColor(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return (
    SAFE_PAINT.has(normalized) ||
    /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(normalized) ||
    /^(?:rgb|rgba|hsl|hsla)\([\d\s,.%+\-/]+\)$/i.test(normalized)
  )
}

function isSafePaint(value: string): boolean {
  return isSafeColor(value) || LOCAL_REFERENCE.test(value)
}

const ATTRIBUTE_VALIDATORS: Record<string, (value: string) => boolean> = {
  d: (value) => value.length <= MAX_ATTRIBUTE_LENGTH && PATH_DATA.test(value),
  points: isNumberList,
  'stroke-dasharray': isNumberList,
  transform: (value) => value.length <= 512 && TRANSFORM.test(value),
  gradientTransform: (value) => value.length <= 512 && TRANSFORM.test(value),
  fill: isSafePaint,
  stroke: isSafePaint,
  'clip-path': isLocalReferenceOrNone,
  mask: isLocalReferenceOrNone,
  id: (value) => SAFE_ID.test(value),
  gradientUnits: (value) => value === 'objectBoundingBox' || value === 'userSpaceOnUse',
  clipPathUnits: (value) => value === 'objectBoundingBox' || value === 'userSpaceOnUse',
  maskUnits: (value) => value === 'objectBoundingBox' || value === 'userSpaceOnUse',
  maskContentUnits: (value) => value === 'objectBoundingBox' || value === 'userSpaceOnUse',
  'mask-type': (value) => value === 'alpha' || value === 'luminance',
  spreadMethod: (value) => value === 'pad' || value === 'reflect' || value === 'repeat',
  'stop-color': isSafeColor,
  'fill-rule': (value) => value === 'nonzero' || value === 'evenodd',
  'stroke-linecap': (value) => ['butt', 'round', 'square'].includes(value),
  'stroke-linejoin': (value) => ['miter', 'round', 'bevel', 'miter-clip'].includes(value),
  'vector-effect': (value) => value === 'none' || value === 'non-scaling-stroke',
}

function isNumberList(value: string): boolean {
  return value === 'none' || (value.length <= MAX_ATTRIBUTE_LENGTH && NUMBER_LIST.test(value))
}

function isLocalReferenceOrNone(value: string): boolean {
  return value === 'none' || LOCAL_REFERENCE.test(value)
}

function isValidAttributeValue(name: string, value: string): boolean {
  return (ATTRIBUTE_VALIDATORS[name] ?? isNumberValue)(value)
}

function isNumberValue(value: string): boolean {
  return NUMBER.test(value)
}

function validateAttribute(tag: string, name: string, value: string, iconName: string): void {
  if (!SAFE_ATTRIBUTES[tag]?.has(name)) {
    fail('unsafe-icon', `unsupported SVG attribute "${name}" in Iconify icon "${iconName}"`)
  }
  if (!isValidAttributeValue(name, value)) {
    fail('unsafe-icon', `invalid SVG value for "${name}" in Iconify icon "${iconName}"`)
  }
}

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

function parseIconifyBody(body: string, iconName: string): IrisIconNode[] {
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

function dimension(value: unknown, label: string, iconName: string): number {
  if (value === undefined) return 24
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 4096) {
    return fail('unsafe-icon', `invalid ${label} in Iconify icon "${iconName}"`)
  }
  return value
}

function toIrisIcon(name: string, data: unknown): IrisIcon {
  if (!isRecord(data) || typeof data.body !== 'string') {
    return fail('invalid-response', `Iconify response did not contain a valid icon "${name}"`)
  }
  const width = dimension(data.width, 'width', name)
  const height = dimension(data.height, 'height', name)
  return {
    name,
    viewBox: `0 0 ${width} ${height}`,
    nodes: parseIconifyBody(data.body, name),
  }
}

function parseResponse(text: string, prefix: string): Record<string, unknown> {
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    return fail('limit-exceeded', `Iconify response for "${prefix}" exceeds the size limit`)
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return fail('invalid-response', `Iconify returned invalid JSON for "${prefix}"`)
  }
  if (!isRecord(value) || value.prefix !== prefix || !isRecord(value.icons)) {
    return fail('invalid-response', `Iconify returned an invalid icon collection for "${prefix}"`)
  }
  return value.icons
}

function normalizeApiUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return fail('configuration', `invalid Iconify API URL "${value}"`)
  }
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    return fail('configuration', 'Iconify API URL must use HTTP(S) without embedded credentials')
  }
  url.search = ''
  url.hash = ''
  return url
}

/**
 * Create an optional, on-demand Iconify JSON provider. A restricted SVG subset
 * supports shapes, groups, definitions, gradients, clip paths, and masks. Scripts,
 * CSS, external references, filters, unknown tags, and unsafe attributes fail closed.
 */
export function createIconifyProvider(options: IconifyProviderOptions = {}): IconifyProvider {
  const apiBase = normalizeApiUrl(options.apiUrl ?? DEFAULT_API_URL)
  const setName = options.setName ?? 'iconify'

  async function loadIcons(names: readonly string[]): Promise<IrisIconSet> {
    if (names.length > MAX_ICON_COUNT) {
      return fail(
        'limit-exceeded',
        `an Iconify request may contain at most ${MAX_ICON_COUNT} icons`,
      )
    }
    const uniqueNames = [...new Set(names)]
    const groups = new Map<string, QualifiedName[]>()
    for (const value of uniqueNames) {
      const parsed = parseQualifiedName(value)
      const group = groups.get(parsed.prefix) ?? []
      group.push(parsed)
      groups.set(parsed.prefix, group)
    }

    const fetcher = options.fetch ?? (globalThis as unknown as { fetch?: IconifyFetch }).fetch
    if (groups.size > 0 && !fetcher) {
      return fail('configuration', 'fetch is unavailable; provide IconifyProviderOptions.fetch')
    }

    const icons: Record<string, IrisIcon> = {}
    for (const [prefix, requested] of groups) {
      const endpoint = new URL(apiBase.href)
      endpoint.pathname = `${endpoint.pathname.replace(/\/+$/, '')}/${prefix}.json`
      endpoint.searchParams.set('icons', requested.map(({ name }) => name).join(','))

      let response: IconifyFetchResponse
      try {
        response = await fetcher!(endpoint.href, { headers: { Accept: 'application/json' } })
      } catch {
        return fail('network', `failed to fetch Iconify collection "${prefix}"`)
      }
      if (!response.ok) {
        return fail('http', `Iconify request for "${prefix}" failed with status ${response.status}`)
      }

      let text: string
      try {
        text = await response.text()
      } catch {
        return fail('network', `failed to read Iconify response for "${prefix}"`)
      }
      const collection = parseResponse(text, prefix)
      for (const { name, fullName } of requested) {
        if (!Object.hasOwn(collection, name)) {
          return fail('missing-icon', `Iconify did not return requested icon "${fullName}"`)
        }
        icons[fullName] = toIrisIcon(fullName, collection[name])
      }
    }

    return { name: setName, icons }
  }

  return {
    loadIcons,
    async loadIcon(name) {
      const set = await loadIcons([name])
      return set.icons[name]!
    },
  }
}
