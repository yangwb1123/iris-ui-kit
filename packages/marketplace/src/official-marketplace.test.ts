import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRuntimeRegistryPayload } from '@iris-ui-kit/registry'
import { validatePageBlueprint, validateViewPreset } from './blueprint'
import { createRuntimeMarketplace } from './marketplace'
import type { IrisPageBlueprint, IrisViewPreset } from './types'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const directory = resolve(root, 'registry/marketplace')
const read = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as unknown
const sha256 = (value: string): string =>
  `sha256-${createHash('sha256').update(value).digest('hex')}`

describe('official runtime marketplace', () => {
  it('contains only the four declarative runtime resource types', () => {
    const manifest = read('manifest.json') as {
      resources: Array<{ type: string; url: string; integrity: string }>
    }
    expect(manifest.resources.length).toBeGreaterThan(0)
    for (const entry of manifest.resources) {
      expect(['iris:skin', 'iris:font', 'iris:blueprint', 'iris:view']).toContain(entry.type)
      const resourceName = entry.url.replace('./', '')
      const source = readFileSync(resolve(directory, resourceName), 'utf8')
      expect(entry.integrity).toBe(sha256(source))
      expect(parseRuntimeRegistryPayload(JSON.parse(source) as unknown).type).toBe(entry.type)
    }
  })

  it('ships valid blueprint and view examples', () => {
    const blueprint = parseRuntimeRegistryPayload(read('operations-overview.blueprint.json'))
    const view = parseRuntimeRegistryPayload(read('dense-orders.view.json'))
    expect(validatePageBlueprint(blueprint.data as IrisPageBlueprint)).toEqual([])
    expect(validateViewPreset(view.data as IrisViewPreset)).toEqual([])
  })

  it('installs the official skin through the runtime validation boundary', async () => {
    const marketplace = createRuntimeMarketplace({
      manifestUrl: 'https://example.test/manifest.json',
    })
    await marketplace.installPayload(parseRuntimeRegistryPayload(read('ocean.skin.json')))
    expect(marketplace.get('ocean')?.type).toBe('iris:skin')
    marketplace.destroy()
  })
})
