import { describe, it, expect } from 'vitest'
import { buildManifest, discover } from '@iris-ui/manifest'
import {
  listComponents,
  searchComponents,
  getComponentApi,
  scaffoldSnippet,
  scaffoldView,
  suggestComponents,
  validateUsage,
} from './tools'

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

describe('scaffoldView', () => {
  it('composes several components with deduped, grouped imports + a wrapper', () => {
    const view = scaffoldView(manifest, {
      framework: 'react',
      components: ['IrisButton', 'IrisInput'],
    })
    expect(view).not.toBeNull()
    // Both come from @iris-ui/react → a single import statement listing both.
    expect(view).toContain("import { IrisButton, IrisInput } from '@iris-ui/react'")
    expect(view).toContain('<div className="iris-view">')
    expect(view).toContain('<IrisButton')
    expect(view).toContain('<IrisInput')
  })

  it('wraps children in a layout component when given', () => {
    const view = scaffoldView(manifest, {
      framework: 'react',
      components: ['IrisButton'],
      layout: 'IrisCard',
    })
    expect(view).toContain('<IrisCard>')
    expect(view).toContain('</IrisCard>')
    expect(view).toContain('<IrisButton')
  })

  it('uses Vue class binding for the default wrapper', () => {
    const view = scaffoldView(manifest, { framework: 'vue', components: ['IrisButton'] })
    expect(view).toContain('<div class="iris-view">')
  })

  it('returns null for empty input or an unknown/unsupported component', () => {
    expect(scaffoldView(manifest, { framework: 'react', components: [] })).toBeNull()
    expect(
      scaffoldView(manifest, { framework: 'react', components: ['IrisButton', 'IrisNope'] }),
    ).toBeNull()
  })
})

describe('suggestComponents', () => {
  it('ranks components by a free-text requirement', () => {
    const out = suggestComponents(manifest, 'a button to submit a form')
    expect(out.length).toBeGreaterThan(0)
    expect(out.some((s) => s.name === 'IrisButton')).toBe(true)
    // scores are non-increasing (ranked best-first)
    for (let i = 1; i < out.length; i += 1)
      expect(out[i - 1]!.score).toBeGreaterThanOrEqual(out[i]!.score)
  })

  it('respects the limit and returns nothing for a term-less query', () => {
    expect(suggestComponents(manifest, 'table data grid', 2).length).toBeLessThanOrEqual(2)
    expect(suggestComponents(manifest, '   !! ')).toEqual([])
  })
})

describe('validateUsage', () => {
  it('passes a correct usage (empty issues)', () => {
    expect(
      validateUsage(manifest, {
        name: 'IrisButton',
        framework: 'react',
        props: { variant: 'solid', size: 'md' },
      }),
    ).toEqual([])
  })

  it('flags an invalid enum value against the manifest', () => {
    const issues = validateUsage(manifest, { name: 'IrisButton', props: { variant: 'huge' } })
    expect(issues.some((i) => i.severity === 'error' && /Invalid value/.test(i.message))).toBe(true)
  })

  it('flags unknown component, unknown prop, and unsupported framework', () => {
    expect(validateUsage(manifest, { name: 'IrisNope' })[0]?.severity).toBe('error')
    expect(
      validateUsage(manifest, { name: 'IrisButton', props: { notAProp: 'x' } }).some((i) =>
        /Unknown prop/.test(i.message),
      ),
    ).toBe(true)
  })
})
