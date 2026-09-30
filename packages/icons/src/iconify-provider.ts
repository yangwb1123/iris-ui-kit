import type { IrisIcon, IrisIconSet } from './types'
import { iconifyFail as fail } from './iconify-provider-errors'
import { parseIconifyBody } from './iconify-provider-svg'

const DEFAULT_API_URL = 'https://api.iconify.design'
const MAX_ICON_COUNT = 100
const MAX_RESPONSE_BYTES = 1_000_000

export { IconifyProviderError } from './iconify-provider-errors'
export type { IconifyProviderErrorCode } from './iconify-provider-errors'

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
