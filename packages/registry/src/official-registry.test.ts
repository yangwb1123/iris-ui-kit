import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createInstallPlan,
  createProjectConfig,
  filesForFramework,
  parseRegistryCatalog,
  parseRegistryItem,
  type IrisFramework,
} from './index'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const itemPath = resolve(root, 'registry/items/admin-layout.json')
const item = parseRegistryItem(JSON.parse(readFileSync(itemPath, 'utf8')) as unknown)

describe('official source registry', () => {
  it('publishes a valid catalog pointing at admin-layout', () => {
    const catalog = parseRegistryCatalog(
      JSON.parse(readFileSync(resolve(root, 'registry/registry.json'), 'utf8')) as unknown,
    )
    expect(catalog.items.map((entry) => entry.name)).toContain('admin-layout')
  })

  it.each(['react', 'vue', 'solid', 'svelte'] as IrisFramework[])(
    'resolves the complete %s source variant',
    (framework) => {
      const sources = Object.fromEntries(
        filesForFramework(item, framework)
          .filter((file) => file.source)
          .map((file) => [
            file.source!,
            readFileSync(resolve(dirname(itemPath), file.source!), 'utf8'),
          ]),
      )
      const plan = createInstallPlan(item, createProjectConfig(framework), sources)
      expect(plan.files).toHaveLength(3)
      expect(plan.files.some((file) => file.target.includes('AdminLayout'))).toBe(true)
      expect(plan.dependencies[`@iris-ui-kit/${framework}`]).toBeDefined()
    },
  )
})
