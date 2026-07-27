import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IrisFramework } from '@iris-ui-kit/registry'
import { runAdd, runInit, runRegistryAdd } from './registry'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const catalog = resolve(root, 'registry/registry.json')

describe('official admin-layout installation', () => {
  const directories: string[] = []

  afterEach(() => {
    vi.restoreAllMocks()
    directories
      .splice(0)
      .forEach((directory) => rmSync(directory, { recursive: true, force: true }))
  })

  it.each(['react', 'vue', 'solid', 'svelte'] as IrisFramework[])(
    'installs the %s source variant through the public CLI flow',
    async (framework) => {
      vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
      vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
      const cwd = mkdtempSync(join(tmpdir(), `iris-${framework}-`))
      directories.push(cwd)
      expect(runInit({ cwd, framework })).toBe(0)
      expect(runRegistryAdd('local', catalog, { cwd })).toBe(0)
      expect(await runAdd(['admin-layout'], { cwd, registry: 'local' })).toBe(0)
      const extension = framework === 'vue' ? 'vue' : framework === 'svelte' ? 'svelte' : 'tsx'
      expect(existsSync(resolve(cwd, `src/templates/admin-layout/AdminLayout.${extension}`))).toBe(
        true,
      )
      expect(existsSync(resolve(cwd, 'src/templates/admin-layout/preferences.ts'))).toBe(true)
    },
  )
})
