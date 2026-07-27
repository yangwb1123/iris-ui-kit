import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runAdd, runDiff, runInit, runRegistryAdd, runUpdate, sha256 } from './registry'

describe('registry commands', () => {
  let cwd: string

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'iris-registry-'))
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    rmSync(cwd, { recursive: true, force: true })
  })

  function fixture(): void {
    mkdirSync(join(cwd, 'catalog', 'items', 'react'), { recursive: true })
    writeFileSync(
      join(cwd, 'catalog', 'registry.json'),
      JSON.stringify({
        schema: 'iris-ui/registry@1',
        name: 'test',
        items: [
          {
            name: 'shell',
            type: 'iris:template',
            version: '1.0.0',
            url: './items/shell.json',
            frameworks: ['react'],
          },
        ],
      }),
    )
    const source = 'export const shell = true\n'
    writeFileSync(join(cwd, 'catalog', 'items', 'react', 'Shell.tsx'), source)
    writeFileSync(
      join(cwd, 'catalog', 'items', 'shell.json'),
      JSON.stringify({
        schema: 'iris-ui/registry-item@1',
        name: 'shell',
        type: 'iris:template',
        version: '1.0.0',
        frameworks: ['react', 'vue'],
        dependencies: { '@iris-ui-kit/react': '^0.1.0' },
        files: [
          {
            source: './react/Shell.tsx',
            target: 'templates/shell/Shell.tsx',
            frameworks: ['react'],
            integrity: sha256(source),
          },
          {
            source: './vue/Missing.vue',
            target: 'templates/shell/Shell.vue',
            frameworks: ['vue'],
          },
        ],
      }),
    )
  }

  it('initializes config + lock and registers a catalog', () => {
    expect(runInit({ cwd, framework: 'react' })).toBe(0)
    expect(runRegistryAdd('local', './catalog/registry.json', { cwd })).toBe(0)
    expect(JSON.parse(readFileSync(join(cwd, 'iris.json'), 'utf8')).registries.local).toBe(
      './catalog/registry.json',
    )
  })

  it('installs source, dependencies and lock metadata', async () => {
    fixture()
    writeFileSync(join(cwd, 'package.json'), '{"name":"consumer","dependencies":{}}\n')
    runInit({ cwd, framework: 'react' })
    runRegistryAdd('local', './catalog/registry.json', { cwd })
    expect(await runAdd(['shell'], { cwd, registry: 'local' })).toBe(0)
    expect(readFileSync(join(cwd, 'src/templates/shell/Shell.tsx'), 'utf8')).toContain(
      'shell = true',
    )
    expect(JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).dependencies).toEqual({
      '@iris-ui-kit/react': '^0.1.0',
    })
    expect(JSON.parse(readFileSync(join(cwd, 'iris.lock.json'), 'utf8')).items.shell.version).toBe(
      '1.0.0',
    )
  })

  it('diff is read-only and installer blocks unmanaged conflicts', async () => {
    fixture()
    runInit({ cwd, framework: 'react' })
    runRegistryAdd('local', './catalog/registry.json', { cwd })
    mkdirSync(join(cwd, 'src/templates/shell'), { recursive: true })
    writeFileSync(join(cwd, 'src/templates/shell/Shell.tsx'), 'local edits\n')
    expect(await runAdd(['shell'], { cwd, registry: 'local' })).toBe(1)
    expect(await runDiff(['shell'], { cwd, registry: 'local' })).toBe(0)
    expect(readFileSync(join(cwd, 'src/templates/shell/Shell.tsx'), 'utf8')).toBe('local edits\n')
  })

  it('updates from the locked registry without overwriting local edits', async () => {
    fixture()
    runInit({ cwd, framework: 'react' })
    runRegistryAdd('local', './catalog/registry.json', { cwd })
    expect(await runAdd(['shell'], { cwd, registry: 'local' })).toBe(0)
    expect(await runUpdate([], { cwd })).toBe(0)

    const installed = join(cwd, 'src/templates/shell/Shell.tsx')
    writeFileSync(installed, 'local edits\n')
    expect(await runUpdate([], { cwd })).toBe(1)
    expect(readFileSync(installed, 'utf8')).toBe('local edits\n')
    expect(await runUpdate([], { cwd, force: true })).toBe(0)
    expect(readFileSync(installed, 'utf8')).toContain('shell = true')
  })

  it('rejects a catalog whose item identity does not match', async () => {
    fixture()
    const catalogPath = join(cwd, 'catalog', 'registry.json')
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as {
      items: Array<{ version: string }>
    }
    catalog.items[0]!.version = '2.0.0'
    writeFileSync(catalogPath, JSON.stringify(catalog))
    runInit({ cwd, framework: 'react' })
    runRegistryAdd('local', './catalog/registry.json', { cwd })
    expect(await runAdd(['shell'], { cwd, registry: 'local' })).toBe(1)
  })

  it('rejects stale catalog-item integrity before parsing source', async () => {
    fixture()
    const catalogPath = join(cwd, 'catalog', 'registry.json')
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as {
      items: Array<{ integrity?: string }>
    }
    catalog.items[0]!.integrity = sha256('tampered')
    writeFileSync(catalogPath, JSON.stringify(catalog))
    runInit({ cwd, framework: 'react' })
    runRegistryAdd('local', './catalog/registry.json', { cwd })
    expect(await runAdd(['shell'], { cwd, registry: 'local' })).toBe(1)
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining('Integrity check failed for registry item'),
    )
  })

  it('requires integrity for every item referenced by a remote catalog', async () => {
    const catalog = JSON.stringify({
      schema: 'iris-ui/registry@1',
      name: 'remote',
      items: [
        {
          name: 'shell',
          type: 'iris:template',
          version: '1.0.0',
          url: './shell.json',
          frameworks: ['react'],
        },
      ],
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(catalog)),
    )
    runInit({ cwd, framework: 'react' })
    runRegistryAdd('remote', 'https://registry.example.test/registry.json', { cwd })
    expect(await runAdd(['shell'], { cwd, registry: 'remote' })).toBe(1)
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining('must declare integrity'),
    )
  })

  it('records enough source metadata to update a direct item path', async () => {
    fixture()
    runInit({ cwd, framework: 'react' })
    const itemPath = join(cwd, 'catalog', 'items', 'shell.json')
    expect(await runAdd([itemPath], { cwd })).toBe(0)
    const lock = JSON.parse(readFileSync(join(cwd, 'iris.lock.json'), 'utf8')) as {
      items: { shell: { registry: string; source: string } }
    }
    expect(lock.items.shell.registry).toBe('direct')
    expect(lock.items.shell.source).toBe(itemPath)
    expect(await runUpdate([], { cwd })).toBe(0)
  })

  it('never follows symbolic links while writing registry output', async () => {
    fixture()
    runInit({ cwd, framework: 'react' })
    runRegistryAdd('local', './catalog/registry.json', { cwd })
    const outside = join(cwd, 'outside')
    mkdirSync(join(cwd, 'src'), { recursive: true })
    mkdirSync(outside)
    symlinkSync(outside, join(cwd, 'src', 'templates'), 'dir')
    expect(await runAdd(['shell'], { cwd, registry: 'local' })).toBe(1)
    expect(existsSync(join(outside, 'shell', 'Shell.tsx'))).toBe(false)
  })
})
