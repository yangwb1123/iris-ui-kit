import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildManifest } from './build'
import { discover, findRepoRoot } from './discover'
import { ALL_FRAMEWORKS, type Framework, type ManifestFrameworkContract } from './schema'

const root = findRepoRoot()
const manifest = buildManifest(discover(root))

function contract(name: string, framework: Framework): ManifestFrameworkContract {
  const component = manifest.components.find((entry) => entry.name === name)
  expect(component, `${name} missing`).toBeDefined()
  const value = component?.frameworkContracts?.[framework]
  expect(value, `${name} has no explicit ${framework} contract`).toBeDefined()
  expect(value?.source, `${name} ${framework} contract was not extracted`).toBe('native')
  return value!
}

describe('native contract completeness', () => {
  it('extracts a native contract for every exported component × framework', () => {
    const exported = manifest.components.flatMap((component) =>
      component.frameworks.map((framework) => ({
        component: component.name,
        framework,
        source: component.frameworkContracts?.[framework]?.source ?? 'missing',
      })),
    )
    const unavailable = exported.filter((entry) => entry.source !== 'native')

    expect(exported).toHaveLength(manifest.stats.total * ALL_FRAMEWORKS.length)
    expect(unavailable).toEqual([])
  })

  it('retains explicit alias fields and Svelte plugin-required props', () => {
    expect(contract('IrisToggleGroup', 'react').props.map((prop) => prop.name)).toEqual([
      'type',
      'value',
      'defaultValue',
      'onValueChange',
      'orientation',
      'size',
      'variant',
      'disabled',
    ])
    expect(contract('IrisDropdownTrigger', 'svelte').publicTypes).toContain(
      'IrisDropdownTriggerProps',
    )
    expect(
      contract('IrisProTable', 'svelte')
        .props.filter((prop) => !prop.optional)
        .map((prop) => prop.name),
    ).toEqual(['store'])
    expect(
      contract('IrisFormBuilder', 'svelte')
        .props.filter((prop) => !prop.optional)
        .map((prop) => prop.name),
    ).toEqual(['schema'])
  })
})

describe('four-framework public package exports', () => {
  const commonSubpaths = [
    './admin',
    './async',
    './behaviors',
    './data',
    './error-boundary',
    './floating',
    './form',
    './i18n',
    './layouts',
    './motion',
    './provider',
    './resource',
    './skeletons',
    './skins',
    './theme',
    './undo',
  ]

  for (const framework of ALL_FRAMEWORKS) {
    it(`${framework}: exposes typed root and explicit public category entries`, () => {
      const packageJson = JSON.parse(
        readFileSync(join(root, 'packages', framework, 'package.json'), 'utf8'),
      ) as {
        exports: Record<string, Record<string, string> | string>
      }
      const rootExport = packageJson.exports['.']
      expect(rootExport).toBeTypeOf('object')
      expect(rootExport).toHaveProperty('types')
      if (framework === 'svelte') {
        expect(rootExport).toHaveProperty('svelte')
        expect(rootExport).toHaveProperty('default')
      } else {
        expect(rootExport).toHaveProperty('import')
        expect(rootExport).toHaveProperty('require')
      }
      expect(packageJson.exports).not.toHaveProperty('./*')
      for (const subpath of commonSubpaths) {
        const subpathExport = packageJson.exports[subpath]
        expect(subpathExport, `${framework} ${subpath}`).toBeTypeOf('object')
        expect(subpathExport).toHaveProperty('types')
        if (framework === 'svelte') {
          expect(subpathExport).toHaveProperty('svelte')
          expect(subpathExport).toHaveProperty('default')
        } else {
          expect(subpathExport).toHaveProperty('import')
          expect(subpathExport).toHaveProperty('require')
        }
      }

      const rootBarrel = readFileSync(
        join(root, 'packages', framework, 'src', framework === 'solid' ? 'index.tsx' : 'index.ts'),
        'utf8',
      )
      expect(rootBarrel).toContain("export * from './primitives/select'")
      expect(rootBarrel).toContain("export * from './primitives/table'")
    })
  }
})

describe('critical native component contracts', () => {
  it('Select exposes each adapter’s real value/event binding and public types', () => {
    const expected: Record<Framework, { value: string; events: string[]; types: string[] }> = {
      react: {
        value: 'value',
        events: ['onValueChange'],
        types: ['IrisSelectItem', 'IrisSelectProps', 'IrisSelectSize'],
      },
      vue: {
        value: 'modelValue',
        events: ['update:modelValue', 'valueChange'],
        types: ['IrisSelectItem', 'IrisSelectProps', 'IrisSelectSize'],
      },
      solid: {
        value: 'value',
        events: ['onChange', 'onValueChange'],
        types: ['IrisSelectItem', 'IrisSelectProps', 'IrisSelectSize'],
      },
      svelte: {
        value: 'value',
        events: ['onValueChange'],
        types: ['IrisSelectItem', 'IrisSelectProps', 'IrisSelectSize'],
      },
    }

    for (const framework of ALL_FRAMEWORKS) {
      const api = contract('IrisSelect', framework)
      expect(api.props.filter((prop) => !prop.optional).map((prop) => prop.name)).toEqual(['items'])
      expect(api.props.map((prop) => prop.name)).toContain(expected[framework].value)
      expect(api.events).toEqual(expect.arrayContaining(expected[framework].events))
      expect(api.publicTypes).toEqual(expect.arrayContaining(expected[framework].types))
    }
  })

  it('Table requires columns/data and surfaces native events/public types ×4', () => {
    const expectedEvents: Record<Framework, string[]> = {
      react: ['onSelectionChange', 'onSortChange'],
      vue: ['update:selection', 'update:sort'],
      solid: ['onSelectionChange', 'onSortChange'],
      svelte: ['onUpdateSelection', 'onUpdateSort'],
    }
    const requiredTypes = [
      'IrisTableProps',
      'IrisTableColumn',
      'IrisTableSortState',
      'IrisTableVirtualOptions',
    ]

    for (const framework of ALL_FRAMEWORKS) {
      const api = contract('IrisTable', framework)
      expect(api.props.filter((prop) => !prop.optional).map((prop) => prop.name)).toEqual([
        'columns',
        'data',
      ])
      expect(api.events).toEqual(expect.arrayContaining(expectedEvents[framework]))
      expect(api.publicTypes).toEqual(expect.arrayContaining(requiredTypes))
    }
  })
})

describe('component layers and canonical token catalog', () => {
  it.each([
    ['IrisButton', 'layer-1'],
    ['IrisSelect', 'layer-2'],
    ['IrisTable', 'layer-2'],
    ['IrisStack', 'layer-3'],
    ['IrisDashboardTemplate', 'layer-4'],
    ['IrisResizable', 'behavior'],
    ['IrisProTable', 'plugin'],
  ] as const)('%s is assigned to %s', (name, layer) => {
    expect(manifest.components.find((entry) => entry.name === name)?.layer).toBe(layer)
  })

  it('includes every canonical token family without duplicates', () => {
    expect(manifest.tokens.shadows).toContain('iris.shadow.md')
    expect(manifest.tokens.zIndex).toContain('iris.z.modal')
    expect(manifest.tokens.transitions).toContain('iris.transition.ease')
    expect(new Set(manifest.tokens.all).size).toBe(manifest.tokens.all.length)
    expect(manifest.tokens.all).toEqual([
      ...manifest.tokens.color,
      ...manifest.tokens.spacing,
      ...manifest.tokens.radii,
      ...manifest.tokens.shadows,
      ...manifest.tokens.zIndex,
      ...manifest.tokens.transitions,
    ])
  })
})
