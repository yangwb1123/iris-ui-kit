import type { IrisIcon, IrisIconNode, IrisIconSet } from './types'

const DEFAULT_API_URL = 'https://api.iconify.design'
const MAX_ICON_COUNT = 100
const MAX_RESPONSE_BYTES = 1_000_000
const MAX_BODY_LENGTH = 65_536
const MAX_NODE_COUNT = 512
const MAX_ATTRIBUTE_LENGTH = 32_768
const SAFE_TAGS = new Set(['circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'rect'])
const SAFE_ATTRIBUTES = new Set([
  'cx',
  'cy',
  'd',
  'fill',
  'fill-rule',
  'fill-opacity',
  'height',
  'opacity',
  'pathLength',
  'points',
  'r',
  'rx',
  'ry',
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
const XML_NAME = /^[A-Za-z_][A-Za-z0-9_.:-]*/
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?%?$/
const NUMBER_LIST = /^[\s,+\-.\deE]+$/
const PATH_DATA = /^[\s,+\-.\deEMmZzLlHhVvCcSsQqTtAa]+$/
const TRANSFORM = /^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\s*\(\s*[+\-.\deE,\s]+\)\s*)+$/
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

function decodeXmlAttribute(value: string, iconName: string): string {
  const decoded = value.replace(
    /&(#x[\da-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g,
    (entity, token: string) => {
      if (token === 'amp') return '&'
      if (token === 'lt') return '<'
      if (token === 'gt') return '>'
      if (token === 'quot') return '"'
      if (token === 'apos') return "'"
      const codePoint = token.startsWith('#x')
        ? Number.parseInt(token.slice(2), 16)
        : Number.parseInt(token.slice(1), 10)
      const validXmlCharacter =
        codePoint === 0x9 ||
        codePoint === 0xa ||
        codePoint === 0xd ||
        (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
        (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
        (codePoint >= 0x10000 && codePoint <= 0x10ffff)
      if (!validXmlCharacter)
        fail('unsafe-icon', `invalid XML character in Iconify icon "${iconName}"`)
      return String.fromCodePoint(codePoint)
    },
  )
  if (decoded.includes('&')) {
    return fail('unsafe-icon', `unsupported XML entity in Iconify icon "${iconName}"`)
  }
  return decoded
}

function isSafePaint(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return (
    SAFE_PAINT.has(normalized) ||
    /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(normalized) ||
    /^(?:rgb|rgba|hsl|hsla)\([\d\s,.%+\-/]+\)$/i.test(normalized)
  )
}

function validateAttribute(name: string, value: string, iconName: string): void {
  if (!SAFE_ATTRIBUTES.has(name)) {
    fail('unsafe-icon', `unsupported SVG attribute "${name}" in Iconify icon "${iconName}"`)
  }
  const valid =
    name === 'd'
      ? value.length <= MAX_ATTRIBUTE_LENGTH && PATH_DATA.test(value)
      : name === 'points' || name === 'stroke-dasharray'
        ? value === 'none' || (value.length <= MAX_ATTRIBUTE_LENGTH && NUMBER_LIST.test(value))
        : name === 'transform'
          ? value.length <= 512 && TRANSFORM.test(value)
          : name === 'fill' || name === 'stroke'
            ? isSafePaint(value)
            : name === 'fill-rule'
              ? value === 'nonzero' || value === 'evenodd'
              : name === 'stroke-linecap'
                ? value === 'butt' || value === 'round' || value === 'square'
                : name === 'stroke-linejoin'
                  ? value === 'miter' ||
                    value === 'round' ||
                    value === 'bevel' ||
                    value === 'miter-clip'
                  : name === 'vector-effect'
                    ? value === 'none' || value === 'non-scaling-stroke'
                    : name === 'opacity' || name === 'fill-opacity' || name === 'stroke-opacity'
                      ? NUMBER.test(value)
                      : NUMBER.test(value)
  if (!valid) {
    fail('unsafe-icon', `invalid SVG value for "${name}" in Iconify icon "${iconName}"`)
  }
}

function parseLeafNode(
  body: string,
  start: number,
  iconName: string,
): { node: IrisIconNode; next: number } {
  let cursor = start + 1
  const tagMatch = XML_NAME.exec(body.slice(cursor))
  if (!tagMatch || !SAFE_TAGS.has(tagMatch[0])) {
    return fail('unsafe-icon', `unsupported SVG element in Iconify icon "${iconName}"`)
  }
  const tag = tagMatch[0]
  cursor += tag.length
  const attrs: Record<string, string> = {}

  while (cursor < body.length) {
    const whitespaceStart = cursor
    while (/\s/.test(body[cursor] ?? '')) cursor++
    const hadWhitespace = cursor > whitespaceStart

    if (body.startsWith('/>', cursor)) return { node: { tag, attrs }, next: cursor + 2 }
    if (body[cursor] === '>') {
      cursor++
      while (/\s/.test(body[cursor] ?? '')) cursor++
      if (!body.startsWith('</', cursor)) {
        return fail(
          'unsafe-icon',
          `nested SVG markup is not supported in Iconify icon "${iconName}"`,
        )
      }
      cursor += 2
      const closeMatch = XML_NAME.exec(body.slice(cursor))
      if (!closeMatch || closeMatch[0] !== tag) {
        return fail('unsafe-icon', `mismatched SVG element in Iconify icon "${iconName}"`)
      }
      cursor += closeMatch[0].length
      while (/\s/.test(body[cursor] ?? '')) cursor++
      if (body[cursor] !== '>') {
        return fail('unsafe-icon', `malformed SVG closing element in Iconify icon "${iconName}"`)
      }
      return { node: { tag, attrs }, next: cursor + 1 }
    }
    if (!hadWhitespace) {
      return fail('unsafe-icon', `malformed SVG attributes in Iconify icon "${iconName}"`)
    }
    if (cursor >= body.length) break

    const attrMatch = XML_NAME.exec(body.slice(cursor))
    if (!attrMatch)
      return fail('unsafe-icon', `malformed SVG attributes in Iconify icon "${iconName}"`)
    const attrName = attrMatch[0]
    cursor += attrName.length
    while (/\s/.test(body[cursor] ?? '')) cursor++
    if (body[cursor] !== '=') {
      return fail('unsafe-icon', `missing SVG attribute value in Iconify icon "${iconName}"`)
    }
    cursor++
    while (/\s/.test(body[cursor] ?? '')) cursor++
    const quote = body[cursor]
    if (quote !== '"' && quote !== "'") {
      return fail('unsafe-icon', `unquoted SVG attribute in Iconify icon "${iconName}"`)
    }
    cursor++
    const valueStart = cursor
    while (cursor < body.length && body[cursor] !== quote) {
      if (body[cursor] === '<') {
        return fail(
          'unsafe-icon',
          `invalid character in SVG attribute in Iconify icon "${iconName}"`,
        )
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
    cursor++
    if (Object.hasOwn(attrs, attrName)) {
      return fail(
        'unsafe-icon',
        `duplicate SVG attribute "${attrName}" in Iconify icon "${iconName}"`,
      )
    }
    validateAttribute(attrName, value, iconName)
    attrs[attrName] = value
  }

  return fail('unsafe-icon', `unterminated SVG element in Iconify icon "${iconName}"`)
}

function parseIconifyBody(body: string, iconName: string): IrisIconNode[] {
  if (body.length > MAX_BODY_LENGTH) {
    return fail('limit-exceeded', `SVG body is too large in Iconify icon "${iconName}"`)
  }
  const nodes: IrisIconNode[] = []
  let cursor = 0
  while (cursor < body.length) {
    while (/\s/.test(body[cursor] ?? '')) cursor++
    if (cursor >= body.length) break
    if (body[cursor] !== '<' || body.startsWith('</', cursor) || body.startsWith('<!', cursor)) {
      return fail('unsafe-icon', `unexpected SVG text or markup in Iconify icon "${iconName}"`)
    }
    const parsed = parseLeafNode(body, cursor, iconName)
    nodes.push(parsed.node)
    if (nodes.length > MAX_NODE_COUNT) {
      return fail('limit-exceeded', `too many SVG elements in Iconify icon "${iconName}"`)
    }
    cursor = parsed.next
  }
  if (nodes.length === 0) {
    return fail('unsafe-icon', `Iconify icon "${iconName}" contains no supported SVG elements`)
  }
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
 * Create an optional, on-demand Iconify JSON provider. Only a restricted set of
 * flat SVG shapes and presentation attributes is accepted; scripts, external
 * references, CSS, nested markup, and unknown tags/attributes fail closed.
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
