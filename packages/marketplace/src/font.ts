import type { IrisFontResource, IrisFontSource } from './types'

export interface FontAssetCache {
  get(url: string): Promise<ArrayBuffer | undefined>
  put(url: string, data: ArrayBuffer): Promise<void>
}

export function memoryFontAssetCache(): FontAssetCache {
  const entries = new Map<string, ArrayBuffer>()
  return {
    async get(url) {
      return entries.get(url)?.slice(0)
    },
    async put(url, data) {
      entries.set(url, data.slice(0))
    },
  }
}

export function cacheStorageFontAssetCache(name = 'iris-font-assets'): FontAssetCache {
  const api = (globalThis as { caches?: CacheStorage }).caches
  return {
    async get(url) {
      if (!api) return undefined
      const cache = await api.open(name)
      return (await cache.match(url))?.arrayBuffer()
    },
    async put(url, data) {
      if (!api) return
      const cache = await api.open(name)
      await cache.put(url, new Response(data))
    },
  }
}

interface FontFaceSetLike {
  add(font: FontFace): void
  delete(font: FontFace): boolean
}

export interface FontInstallerConfig {
  fetch?: typeof fetch
  cache?: FontAssetCache
  fonts?: FontFaceSetLike
  target?: Pick<HTMLElement, 'style'>
  FontFace?: typeof FontFace
}

export interface InstalledFont {
  family: string
  faces: FontFace[]
  fromCache: number
  revert(): void
}

const SAFE_FAMILY = /^[A-Za-z0-9 _-]{1,100}$/

export function validateFontResource(font: IrisFontResource): string[] {
  const errors: string[] = []
  if (font.schema !== 'iris-ui/font@1') errors.push('schema: unsupported')
  if (!SAFE_FAMILY.test(font.family)) errors.push('family: contains unsupported characters')
  if (!Array.isArray(font.sources) || font.sources.length === 0) {
    errors.push('sources: at least one source is required')
  }
  font.sources?.forEach((source, index) => {
    if (!/^https?:\/\//.test(source.url) && !source.url.startsWith('/')) {
      errors.push(`sources[${index}].url: must be an HTTP(S) or root-relative URL`)
    }
  })
  return errors
}

function descriptors(font: IrisFontResource, source: IrisFontSource): FontFaceDescriptors {
  return {
    display: font.display ?? 'swap',
    style: source.style ?? 'normal',
    weight: source.weight ?? '400',
    ...(source.unicodeRange ? { unicodeRange: source.unicodeRange } : {}),
  }
}

async function digest(data: ArrayBuffer): Promise<string | undefined> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return undefined
  const bytes = new Uint8Array(await subtle.digest('SHA-256', data))
  return `sha256-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

async function loadFontSource(
  source: IrisFontSource,
  fetcher: typeof fetch,
  cache: FontAssetCache,
): Promise<{ data: ArrayBuffer; fromCache: boolean }> {
  const cached = await cache.get(source.url)
  let data = cached
  if (!data) {
    const response = await fetcher(source.url)
    if (!response.ok) throw new Error(`Unable to fetch font ${source.url}: HTTP ${response.status}`)
    data = await response.arrayBuffer()
  }
  if (source.integrity) {
    const actual = await digest(data)
    if (!actual || actual !== source.integrity) {
      throw new Error(`Integrity check failed for font ${source.url}`)
    }
  }
  if (!cached) await cache.put(source.url, data)
  return { data, fromCache: Boolean(cached) }
}

interface FontRuntime {
  fetcher: typeof fetch
  FontFaceCtor: typeof FontFace
  fonts: FontFaceSetLike
  target?: Pick<HTMLElement, 'style'>
}

function resolveFontRuntime(config: FontInstallerConfig): FontRuntime | undefined {
  const fetcher = config.fetch ?? globalThis.fetch
  const FontFaceCtor = config.FontFace ?? globalThis.FontFace
  const fonts =
    config.fonts ??
    (globalThis as unknown as { document?: { fonts?: FontFaceSetLike } }).document?.fonts
  if (!fetcher || !FontFaceCtor || !fonts) return undefined
  const target =
    config.target ??
    (globalThis as { document?: { documentElement?: Pick<HTMLElement, 'style'> } }).document
      ?.documentElement
  return { fetcher, FontFaceCtor, fonts, target }
}

function applyFontFamily(
  font: IrisFontResource,
  target: Pick<HTMLElement, 'style'> | undefined,
): () => void {
  if (font.apply === false || !target) return () => {}
  const previous = target.style.getPropertyValue('--iris-font-family')
  const fallbacks = (font.fallbacks ?? ['system-ui', 'sans-serif']).join(', ')
  target.style.setProperty('--iris-font-family', `"${font.family}", ${fallbacks}`)
  return () => {
    if (previous) target.style.setProperty('--iris-font-family', previous)
    else target.style.removeProperty('--iris-font-family')
  }
}

export async function installFont(
  font: IrisFontResource,
  config: FontInstallerConfig = {},
): Promise<InstalledFont> {
  const errors = validateFontResource(font)
  if (errors.length > 0) throw new Error(`Invalid font resource\n- ${errors.join('\n- ')}`)
  const runtime = resolveFontRuntime(config)
  if (!runtime) {
    return { family: font.family, faces: [], fromCache: 0, revert() {} }
  }
  const { fetcher, FontFaceCtor, fonts, target } = runtime
  const cache = config.cache ?? memoryFontAssetCache()
  const faces: FontFace[] = []
  let fromCache = 0
  try {
    for (const source of font.sources) {
      const loaded = await loadFontSource(source, fetcher, cache)
      if (loaded.fromCache) fromCache += 1
      const face = new FontFaceCtor(font.family, loaded.data, descriptors(font, source))
      await face.load()
      fonts.add(face)
      faces.push(face)
    }
  } catch (error) {
    faces.forEach((face) => fonts.delete(face))
    throw error
  }
  const revertFamily = applyFontFamily(font, target)
  return {
    family: font.family,
    faces,
    fromCache,
    revert() {
      faces.forEach((face) => fonts.delete(face))
      revertFamily()
    },
  }
}
