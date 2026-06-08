import { describe, it, expect } from 'vitest'
import { buildManifest, discover } from '@iris-ui/manifest'
import { listComponents, searchComponents, getComponentApi, scaffoldSnippet } from './tools'

const manifest = buildManifest(discover())

describe('listComponents', () => {
  it('returns every component with summary fields', () => {
    const all = listComponents(manifest)
    expect(all.length).toBe(manifest.components.length)
    const button = all.find((c) => c.name === 'IrisButton')
    expect(button?.frameworks.length).toBeGreaterThanOrEqual(1)
  })
})

describe('searchComponents', () => {
  it('matches by name (case-insensitive)', () => {
    const hits = searchComponents(manifest, 'select')
    expect(hits.some((c) => c.name === 'IrisSelect')).toBe(true)
  })
  it('matches by group', () => {
    expect(searchComponents(manifest, 'plugin').some((c) => c.plugin)).toBe(true)
  })
  it('empty query returns nothing', () => {
    expect(searchComponents(manifest, '  ')).toEqual([])
  })
})

describe('getComponentApi', () => {
  it('returns the typed contract with props', () => {
    const api = getComponentApi(manifest, 'IrisButton')
    expect(api?.props?.some((p) => p.name === 'variant')).toBe(true)
    expect(api?.importFrom.react).toBe('@iris-ui/react')
  })
  it('returns null for an unknown component', () => {
    expect(getComponentApi(manifest, 'IrisNope')).toBeNull()
  })
})

describe('scaffoldSnippet', () => {
  it('emits an import + usage for a supported framework', () => {
    const snippet = scaffoldSnippet(manifest, 'IrisButton', 'react')
    expect(snippet).toContain("import { IrisButton } from '@iris-ui/react'")
    expect(snippet).toContain('<IrisButton')
  })
  it('notes plugin activation for plugin components', () => {
    const snippet = scaffoldSnippet(manifest, 'IrisProTable', 'react')
    expect(snippet).toContain('@iris-ui/plugin-pro-table')
    expect(snippet).toContain('IrisProvider')
  })
  it('uses Vue attribute syntax for vue', () => {
    const snippet = scaffoldSnippet(manifest, 'IrisButton', 'vue')
    expect(snippet).toContain("from '@iris-ui/vue'")
  })
  it('returns null for an unknown component or unsupported framework', () => {
    expect(scaffoldSnippet(manifest, 'IrisNope', 'react')).toBeNull()
  })
})
