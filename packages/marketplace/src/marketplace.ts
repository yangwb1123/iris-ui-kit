import { createStore, type Store } from '@iris-ui-kit/core'
import {
  isRuntimeRegistryType,
  parseRuntimeRegistryPayload,
  type RuntimeRegistryPayload,
} from '@iris-ui-kit/registry'
import { validateSkin, type Skin } from '@iris-ui-kit/skins'
import type {
  InstalledRuntimeResource,
  IrisFontResource,
  IrisMarketplaceEntry,
  IrisMarketplaceManifest,
  IrisPageBlueprint,
  IrisViewPreset,
  RuntimeMarketplaceState,
  RuntimeMarketplaceStorage,
  RuntimeResourceInstaller,
} from './types'
import { memoryMarketplaceStorage } from './storage'
import { validateFontResource } from './font'
import { validatePageBlueprint, validateViewPreset } from './blueprint'

export interface RuntimeMarketplaceConfig {
  manifestUrl: string
  fetch?: typeof fetch
  storage?: RuntimeMarketplaceStorage
  installers?: Partial<Record<RuntimeRegistryPayload['type'], RuntimeResourceInstaller>>
}

export interface RuntimeMarketplace {
  store: Store<RuntimeMarketplaceState>
  getState(): RuntimeMarketplaceState
  subscribe(listener: (state: RuntimeMarketplaceState) => void): () => void
  loadCatalog(): Promise<IrisMarketplaceEntry[]>
  list(): IrisMarketplaceEntry[]
  search(query: string): IrisMarketplaceEntry[]
  install(name: string): Promise<InstalledRuntimeResource>
  installPayload(payload: RuntimeRegistryPayload): Promise<InstalledRuntimeResource>
  uninstall(name: string): Promise<boolean>
  hydrate(): Promise<void>
  get(name: string): InstalledRuntimeResource | undefined
  destroy(): void
}

function parseManifestEntry(value: unknown, names: Set<string>): IrisMarketplaceEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid marketplace manifest entry')
  }
  const entry = value as Partial<IrisMarketplaceEntry>
  const invalid =
    typeof entry.name !== 'string' ||
    entry.name.trim().length === 0 ||
    names.has(entry.name) ||
    typeof entry.version !== 'string' ||
    entry.version.trim().length === 0 ||
    typeof entry.url !== 'string' ||
    entry.url.trim().length === 0 ||
    !isRuntimeRegistryType(entry.type as RuntimeRegistryPayload['type'])
  if (invalid) throw new Error('Invalid marketplace manifest entry')
  if (entry.integrity && !/^sha256-[a-f\d]{64}$/i.test(entry.integrity)) {
    throw new Error('Invalid marketplace manifest integrity')
  }
  const parsed = entry as IrisMarketplaceEntry
  names.add(parsed.name)
  return parsed
}

function parseManifest(value: unknown): IrisMarketplaceManifest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid marketplace manifest')
  }
  const manifest = value as Partial<IrisMarketplaceManifest>
  if (
    manifest.schema !== 'iris-ui/marketplace@1' ||
    typeof manifest.name !== 'string' ||
    !Array.isArray(manifest.resources)
  ) {
    throw new Error('Invalid marketplace manifest')
  }
  const names = new Set<string>()
  return {
    schema: 'iris-ui/marketplace@1',
    name: manifest.name,
    resources: manifest.resources.map((entry) => parseManifestEntry(entry, names)),
  }
}

async function sha256Text(text: string): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined
  const bytes = new TextEncoder().encode(text)
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))
  return `sha256-${Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function validatePayloadData(payload: RuntimeRegistryPayload): void {
  if (payload.type === 'iris:font') {
    const errors = validateFontResource(payload.data as IrisFontResource)
    if (errors.length > 0) throw new Error(`Invalid font resource\n- ${errors.join('\n- ')}`)
  } else if (payload.type === 'iris:blueprint') {
    const errors = validatePageBlueprint(payload.data as IrisPageBlueprint)
    if (errors.length > 0) throw new Error(`Invalid page blueprint\n- ${errors.join('\n- ')}`)
  } else if (payload.type === 'iris:view') {
    const errors = validateViewPreset(payload.data as IrisViewPreset)
    if (errors.length > 0) throw new Error(`Invalid view preset\n- ${errors.join('\n- ')}`)
  } else {
    if (typeof payload.data !== 'object' || payload.data === null || Array.isArray(payload.data)) {
      throw new Error('Invalid skin resource')
    }
    const errors = validateSkin(payload.data as Skin)
    if (errors.length > 0) {
      throw new Error(
        `Invalid skin resource\n- ${errors.map((error) => error.message).join('\n- ')}`,
      )
    }
  }
}

function resolveUrl(base: string, reference: string): string {
  const resolved = new URL(reference, base)
  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
    throw new Error(`Marketplace resources cannot use ${resolved.protocol}`)
  }
  if (base.startsWith('https://') && resolved.protocol !== 'https:') {
    throw new Error('HTTPS marketplaces cannot downgrade resources to HTTP')
  }
  return resolved.toString()
}

export function createRuntimeMarketplace(config: RuntimeMarketplaceConfig): RuntimeMarketplace {
  const fetcher = config.fetch ?? globalThis.fetch
  const storage = config.storage ?? memoryMarketplaceStorage()
  const teardowns = new Map<string, () => void>()
  const store = createStore<RuntimeMarketplaceState>({
    status: 'idle',
    entries: [],
    installed: [],
  })

  const persist = async (): Promise<void> => storage.save(store.getState().installed)

  const applyPayload = async (
    payload: RuntimeRegistryPayload,
    installedAt = new Date().toISOString(),
  ): Promise<InstalledRuntimeResource> => {
    validatePayloadData(payload)
    const previous = store.getState().installed.find((item) => item.name === payload.name)
    const previousTeardown = teardowns.get(payload.name)
    previousTeardown?.()
    teardowns.delete(payload.name)
    let teardown: void | (() => void)
    try {
      teardown = await config.installers?.[payload.type]?.(payload)
    } catch (error) {
      if (previous && previousTeardown) {
        try {
          const restored = await config.installers?.[previous.type]?.(previous.payload)
          if (restored) teardowns.set(previous.name, restored)
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            `Unable to install or restore marketplace resource "${payload.name}"`,
          )
        }
      }
      throw error
    }
    if (teardown) teardowns.set(payload.name, teardown)
    const resource: InstalledRuntimeResource = {
      name: payload.name,
      type: payload.type,
      version: payload.version,
      installedAt,
      payload,
    }
    store.setState((state) => ({
      ...state,
      installed: [...state.installed.filter((item) => item.name !== payload.name), resource],
    }))
    return resource
  }

  const marketplace: RuntimeMarketplace = {
    store,
    getState: store.getState,
    subscribe: store.subscribe,

    async loadCatalog() {
      if (!fetcher) throw new Error('No fetch implementation is available')
      store.setState((state) => ({ ...state, status: 'loading', error: undefined }))
      try {
        const response = await fetcher(config.manifestUrl)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const manifest = parseManifest((await response.json()) as unknown)
        store.setState((state) => ({
          ...state,
          status: 'ready',
          entries: manifest.resources,
          error: undefined,
        }))
        return manifest.resources
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        store.setState((state) => ({ ...state, status: 'error', error: message }))
        throw error
      }
    },

    list: () => store.getState().entries,

    search(query) {
      const normalized = query.trim().toLowerCase()
      if (!normalized) return marketplace.list()
      return marketplace
        .list()
        .filter((entry) =>
          [entry.name, entry.description ?? '', ...(entry.tags ?? [])]
            .join(' ')
            .toLowerCase()
            .includes(normalized),
        )
    },

    async install(name) {
      if (!fetcher) throw new Error('No fetch implementation is available')
      if (marketplace.list().length === 0) await marketplace.loadCatalog()
      const entry = marketplace.list().find((candidate) => candidate.name === name)
      if (!entry) throw new Error(`Marketplace has no resource named "${name}"`)
      const response = await fetcher(resolveUrl(config.manifestUrl, entry.url))
      if (!response.ok) throw new Error(`Unable to fetch ${name}: HTTP ${response.status}`)
      const text = await response.text()
      if (entry.integrity) {
        const actual = await sha256Text(text)
        if (!actual || actual !== entry.integrity)
          throw new Error(`Integrity check failed for ${name}`)
      }
      const payload = parseRuntimeRegistryPayload(JSON.parse(text) as unknown)
      if (
        payload.name !== entry.name ||
        payload.type !== entry.type ||
        payload.version !== entry.version
      ) {
        throw new Error(`Marketplace payload identity mismatch for ${name}`)
      }
      const resource = await applyPayload(payload)
      await persist()
      return resource
    },

    async installPayload(rawPayload) {
      const payload = parseRuntimeRegistryPayload(rawPayload)
      const resource = await applyPayload(payload)
      await persist()
      return resource
    },

    async uninstall(name) {
      const installed = store.getState().installed
      if (!installed.some((item) => item.name === name)) return false
      teardowns.get(name)?.()
      teardowns.delete(name)
      store.setState((state) => ({
        ...state,
        installed: state.installed.filter((item) => item.name !== name),
      }))
      await persist()
      return true
    },

    async hydrate() {
      const resources = await storage.load()
      for (const resource of resources) {
        await applyPayload(resource.payload, resource.installedAt)
      }
    },

    get: (name) => store.getState().installed.find((item) => item.name === name),

    destroy() {
      for (const teardown of [...teardowns.values()].reverse()) teardown()
      teardowns.clear()
    },
  }
  return marketplace
}
