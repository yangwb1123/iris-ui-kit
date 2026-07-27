import { describe, expect, it } from 'vitest'
import {
  createInstallPlan,
  createProjectConfig,
  diffRegistryFiles,
  filesForFramework,
  isRuntimeRegistryType,
  isSafeRelativePath,
  isSourceRegistryType,
  parseRegistryCatalog,
  parseRegistryItem,
  parseRuntimeRegistryPayload,
  resolveRegistryTarget,
  type IrisRegistryItem,
} from './index'

const item: IrisRegistryItem = {
  schema: 'iris-ui/registry-item@1',
  name: 'admin-layout',
  type: 'iris:template',
  version: '1.0.0',
  files: [
    {
      source: './react/AdminShell.tsx',
      target: 'templates/admin-layout/AdminLayout.tsx',
      frameworks: ['react'],
    },
    {
      content: '<script />',
      target: 'templates/admin-layout/AdminLayout.svelte',
      frameworks: ['svelte'],
    },
  ],
}

describe('@iris-ui-kit/registry', () => {
  it('validates item and catalog documents', () => {
    expect(parseRegistryItem(item).name).toBe('admin-layout')
    expect(
      parseRegistryCatalog({
        schema: 'iris-ui/registry@1',
        name: 'iris',
        items: [{ name: 'admin-layout', type: 'iris:template', version: '1.0.0', url: './x' }],
      }).items,
    ).toHaveLength(1)
    expect(() => parseRegistryItem({ schema: 'wrong' })).toThrow('files')
    expect(() =>
      parseRegistryCatalog({
        schema: 'iris-ui/registry@1',
        name: 'broken',
        items: [{ name: 'missing-contract', url: './x' }],
      }),
    ).toThrow('items[0].type')
    expect(() =>
      parseRegistryItem({
        ...item,
        files: [{ ...item.files[0], integrity: 'sha256-not-a-digest' }],
      }),
    ).toThrow('integrity')
    expect(() =>
      parseRegistryCatalog({
        schema: 'iris-ui/registry@1',
        name: 'broken',
        items: [
          {
            name: 'admin-layout',
            type: 'iris:template',
            version: '1.0.0',
            url: './x',
            integrity: 'sha256-not-a-digest',
          },
        ],
      }),
    ).toThrow('items[0].integrity')
  })

  it('selects only the requested framework variant', () => {
    expect(filesForFramework(item, 'react').map((file) => file.source)).toEqual([
      './react/AdminShell.tsx',
    ])
    expect(filesForFramework(item, 'vue')).toEqual([])
  })

  it('resolves aliases while blocking traversal and absolute paths', () => {
    const config = createProjectConfig('react')
    expect(resolveRegistryTarget(config, item, item.files[0]!)).toBe(
      'src/templates/admin-layout/AdminLayout.tsx',
    )
    expect(isSafeRelativePath('../secret')).toBe(false)
    expect(isSafeRelativePath('/tmp/secret')).toBe(false)
  })

  it('creates deterministic install plans and diffs', () => {
    const plan = createInstallPlan(item, createProjectConfig('react'), {
      './react/AdminShell.tsx': 'export const shell = true\n',
    })
    expect(plan.files[0]!.target).toBe('src/templates/admin-layout/AdminLayout.tsx')
    expect(
      diffRegistryFiles(plan, {
        'src/templates/admin-layout/AdminLayout.tsx': 'old',
      }),
    ).toEqual([{ target: 'src/templates/admin-layout/AdminLayout.tsx', status: 'update' }])
    expect(() =>
      createInstallPlan(
        { ...item, files: [item.files[0]!, { ...item.files[0] }] },
        createProjectConfig('react'),
        { './react/AdminShell.tsx': 'same' },
      ),
    ).toThrow('same target')
  })

  it('keeps executable source items out of the runtime allow-list', () => {
    expect(isSourceRegistryType('iris:template')).toBe(true)
    expect(isRuntimeRegistryType('iris:template')).toBe(false)
    expect(isRuntimeRegistryType('iris:font')).toBe(true)
    expect(
      parseRuntimeRegistryPayload({
        name: 'inter',
        type: 'iris:font',
        version: '1.0.0',
        data: { family: 'Inter' },
      }).name,
    ).toBe('inter')
    expect(() =>
      parseRuntimeRegistryPayload({
        name: 'unsafe',
        type: 'iris:template',
        version: '1.0.0',
        data: 'code',
      }),
    ).toThrow('Invalid runtime')
  })
})
