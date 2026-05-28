import { describe, expect, it } from 'vitest'
import { buildManifest } from './build'
import { renderLlmsText } from './llms'
import { discover, findRepoRoot } from './discover'
import type { RawDiscovery } from './schema'

const sample: RawDiscovery = {
  components: [
    { name: 'IrisButton', group: 'primitives', module: 'button', frameworks: ['react', 'vue'] },
    { name: 'IrisAlert', group: 'primitives', module: 'alert', frameworks: ['react'] },
    { name: 'IrisStack', group: 'layouts', frameworks: ['vue'] },
  ],
  tokens: { color: ['iris.primary'], spacing: ['iris.gap.md'], radii: ['iris.radius.sm'] },
}

describe('buildManifest', () => {
  it('sorts components and merges frameworks + importFrom', () => {
    const m = buildManifest(sample)
    expect(m.components.map((c) => c.name)).toEqual(['IrisAlert', 'IrisButton', 'IrisStack'])
    const button = m.components.find((c) => c.name === 'IrisButton')
    expect(button?.frameworks).toEqual(['react', 'vue'])
    expect(button?.importFrom).toEqual({ react: '@iris-ui/react', vue: '@iris-ui/vue' })
  })

  it('computes parity stats', () => {
    expect(buildManifest(sample).stats).toEqual({ total: 3, both: 1, reactOnly: 1, vueOnly: 1 })
  })

  it('groups components and flattens the token catalog', () => {
    const m = buildManifest(sample)
    const primitives = m.groups.find((g) => g.group === 'primitives')
    expect(primitives?.count).toBe(2)
    expect(primitives?.components).toEqual(['IrisAlert', 'IrisButton'])
    expect(m.tokens.all).toEqual(['iris.primary', 'iris.gap.md', 'iris.radius.sm'])
  })

  it('is deterministic', () => {
    expect(JSON.stringify(buildManifest(sample))).toBe(JSON.stringify(buildManifest(sample)))
  })
})

describe('renderLlmsText', () => {
  it('includes header, sections, components and tokens', () => {
    const text = renderLlmsText(buildManifest(sample))
    expect(text).toContain('# Iris UI')
    expect(text).toContain('## Architecture')
    expect(text).toContain('## Components (3 total')
    expect(text).toContain('- IrisButton [react/vue]')
    expect(text).toContain('iris.primary')
  })
})

describe('discover (real repo)', () => {
  it('locates the workspace root', () => {
    expect(() => findRepoRoot()).not.toThrow()
  })

  it('discovers the real inventory from both adapters', () => {
    const raw = discover()
    const button = raw.components.find((c) => c.name === 'IrisButton')
    expect(button?.frameworks.slice().sort()).toEqual(['react', 'vue'])
    expect(raw.components.length).toBeGreaterThan(80)
    expect(raw.tokens.color).toContain('iris.primary')
    expect(raw.tokens.spacing).toContain('iris.gap.md')
    expect(raw.tokens.radii).toContain('iris.radius.sm')
  })

  it('builds a clean manifest from the real repo', () => {
    const m = buildManifest(discover())
    expect(m.stats.total).toBe(m.components.length)
    expect(m.components.every((c) => c.frameworks.length >= 1)).toBe(true)
    // The non-component filter kept injection keys / contexts out.
    expect(m.components.some((c) => /Key$|Context$/.test(c.name))).toBe(false)
  })
})
