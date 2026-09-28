import { describe, expect, it } from 'vitest'
import type { Framework, ManifestComponent } from './schema'
import { ALL_FRAMEWORKS } from './schema'
import {
  NEAR_IDENTICAL_THRESHOLD,
  computeComponentParity,
  computeParitySummary,
  formatParityLine,
} from './parity'

function contract(names: string[]) {
  return {
    source: 'native' as const,
    props: names.map((name) => ({ name, type: 'string', optional: true })),
    events: [],
    slots: [],
    publicTypes: [],
  }
}

function component(
  name: string,
  perFramework: Partial<Record<Framework, string[]>>,
  intrinsic: Framework[] = [],
): ManifestComponent {
  return {
    name,
    group: 'primitives',
    layer: 'layer-1',
    frameworks: [...ALL_FRAMEWORKS],
    importFrom: {},
    frameworkContracts: Object.fromEntries(
      ALL_FRAMEWORKS.map((framework) => [
        framework,
        intrinsic.includes(framework)
          ? {
              ...contract([]),
              propsSource: 'intrinsic-spread' as const,
              intrinsicAttributes: 'React.HTMLAttributes<HTMLDivElement>',
            }
          : contract(perFramework[framework] ?? []),
      ]),
    ) as ManifestComponent['frameworkContracts'],
  }
}

describe('computeComponentParity', () => {
  it('reports ratio 1 and empty exclusive sets when all frameworks match', () => {
    const row = computeComponentParity(
      component('IrisSame', {
        react: ['value', 'onValueChange'],
        vue: ['value', 'onValueChange'],
        solid: ['value', 'onValueChange'],
        svelte: ['value', 'onValueChange'],
      }),
    )
    expect(row.ratio).toBe(1)
    expect(row.common).toEqual(['onValueChange', 'value'])
    expect(row.shared).toEqual([])
    for (const framework of ALL_FRAMEWORKS) expect(row.uniqueTo[framework]).toEqual([])
    expect(row.asymmetry).toBe(1)
  })

  it('separates names missing everywhere (common) from names missing somewhere (shared)', () => {
    const row = computeComponentParity(
      component('IrisMixed', {
        react: ['value', 'onlyReact', 'reactAndVue'],
        vue: ['value', 'reactAndVue'],
        solid: ['value'],
        svelte: ['value'],
      }),
    )
    expect(row.common).toEqual(['value'])
    // Declared by 2 of 4 frameworks → shared, not exclusive.
    expect(row.shared).toEqual(['reactAndVue'])
    expect(row.uniqueTo.react).toEqual(['onlyReact'])
    expect(row.union).toEqual(['onlyReact', 'reactAndVue', 'value'])
    expect(row.ratio).toBe(0.33)
  })

  it('counts a zero-overlap component as ratio 0 without dividing by zero', () => {
    const row = computeComponentParity(
      component('IrisDisjoint', {
        react: ['asChild'],
        vue: ['teleport'],
        solid: ['portalTarget'],
        svelte: ['onclick'],
      }),
    )
    expect(row.ratio).toBe(0)
    expect(row.union).toEqual(['asChild', 'onclick', 'portalTarget', 'teleport'])
    expect(row.uniqueTo.react).toEqual(['asChild'])
    expect(row.uniqueTo.svelte).toEqual(['onclick'])
  })

  it('derives surfaceAsymmetry from the widest prop-count gap, rounded to 2dp', () => {
    // 10 vs 4 → 2.5. Naming idiom cannot explain this; capability is missing.
    const row = computeComponentParity(
      component('IrisGap', {
        react: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
        vue: ['a', 'b', 'c', 'd'],
        solid: ['a', 'b', 'c', 'd'],
        svelte: ['a', 'b', 'c', 'd'],
      }),
    )
    expect(row.asymmetry).toBe(2.5)
  })

  it('treats an empty union as fully aligned rather than 0/0', () => {
    const row = computeComponentParity(
      component('IrisEmpty', {
        react: [],
        vue: [],
        solid: [],
        svelte: [],
      }),
    )
    expect(row.ratio).toBe(1)
    expect(row.asymmetry).toBe(1)
  })

  it('counts a framework with no props as maximally asymmetric, not Infinity', () => {
    const row = computeComponentParity(
      component('IrisOneSided', { react: ['a', 'b'], vue: [], solid: [], svelte: [] }),
    )
    expect(Number.isFinite(row.asymmetry)).toBe(true)
    expect(row.asymmetry).toBe(2)
  })
})

describe('computeParitySummary', () => {
  const components = [
    component('IrisIdentical', {
      react: ['a'],
      vue: ['a'],
      solid: ['a'],
      svelte: ['a'],
    }),
    component('IrisNear', {
      react: ['a', 'b', 'c', 'd', 'e'],
      vue: ['a', 'b', 'c', 'd', 'e'],
      solid: ['a', 'b', 'c', 'd', 'e'],
      svelte: ['a', 'b', 'c', 'd'],
    }),
    component('IrisDivergent', {
      react: ['a', 'urlState', 'rangeFill', 'presence'],
      vue: ['a', 'teleport'],
      solid: ['a'],
      svelte: ['a', 'onclick'],
    }),
  ]

  it('buckets components into identical / near / divergent', () => {
    const summary = computeParitySummary(components)
    expect(summary.identical).toBe(1)
    // 4 common of a 5-name union = 0.8, exactly the threshold → near, not divergent.
    expect(summary.nearIdentical).toBe(1)
    expect(summary.divergent).toBe(1)
    expect(summary.incomparable).toBe(0)
    expect(NEAR_IDENTICAL_THRESHOLD).toBe(0.8)
  })

  it('excludes a component missing any framework contract and reports it as incomparable', () => {
    const partial: ManifestComponent = {
      ...component('IrisPartial', { react: ['a'] }),
      frameworkContracts: { react: contract(['a']) },
    }
    const summary = computeParitySummary([...components, partial])
    expect(summary.incomparable).toBe(1)
    // The three complete components still aggregate normally.
    expect(summary.identical + summary.nearIdentical + summary.divergent).toBe(3)
  })

  it('sums prop declarations and exclusive names per framework', () => {
    const summary = computeParitySummary(components)
    expect(summary.propTotals).toEqual({ react: 10, vue: 8, solid: 7, svelte: 7 })
    expect(summary.exclusivePropNames.react).toBe(3) // urlState, rangeFill, presence
    expect(summary.exclusivePropNames.vue).toBe(1) // teleport
    expect(summary.exclusivePropNames.svelte).toBe(1) // onclick
    // 'e' is declared by three of four frameworks, so it is shared, not exclusive.
    expect(summary.exclusivePropNames.solid).toBe(0)
  })

  it('reports the widest surface gap with its per-framework counts', () => {
    const summary = computeParitySummary(components)
    expect(summary.maxAsymmetry?.name).toBe('IrisDivergent')
    expect(summary.maxAsymmetry?.byFramework).toEqual({ react: 4, vue: 2, solid: 1, svelte: 2 })
  })

  it('orders `worst` ascending by ratio and breaks ties by name', () => {
    const summary = computeParitySummary([
      ...components,
      component('IrisAlsoBad', { react: ['x'], vue: ['y'], solid: ['z'], svelte: ['w'] }),
    ])
    const ratios = summary.worst.map((row) => row.ratio)
    expect([...ratios].sort((a, b) => a - b)).toEqual(ratios)
    // Fully identical components are never listed as offenders.
    expect(summary.worst.map((row) => row.name)).not.toContain('IrisIdentical')
  })

  it('is deterministic for identical input', () => {
    expect(JSON.stringify(computeParitySummary(components))).toBe(
      JSON.stringify(computeParitySummary(components)),
    )
  })

  it('carries the caveat so consumers cannot read it as a guarantee', () => {
    const summary = computeParitySummary(components)
    expect(summary.caveat).toMatch(/NOT a parity guarantee/i)
    expect(summary.caveat).toMatch(/surfaceAsymmetry/)
  })
})

describe('intrinsic attribute spread', () => {
  it('flags the frameworks whose props are a bare intrinsic reference', () => {
    const row = computeComponentParity(
      component('IrisTabsList', { react: [], solid: ['children'], svelte: ['children'] }, [
        'react',
      ]),
    )
    expect(row.intrinsic).toEqual(['react'])
    // The empty list is still enumerated, so the row stays inspectable.
    expect(row.byFramework.react).toBe(0)
    expect(row.byFramework.solid).toBe(1)
  })

  it('excludes an intrinsic-spread component from the buckets and counts it separately', () => {
    // react forwards the whole attribute set, so react=0 vs solid=1 is an
    // extraction gap, not a capability gap.
    const summary = computeParitySummary([
      component('IrisTabsList', { react: [], vue: [], solid: ['children'], svelte: ['children'] }, [
        'react',
      ]),
      component('IrisPlain', { react: ['a'], vue: ['a'], solid: ['a'], svelte: ['a'] }),
    ])
    expect(summary.intrinsicSpread).toBe(1)
    expect(summary.divergent).toBe(0)
    expect(summary.identical).toBe(1)
    expect(summary.meanRatio).toBe(1)
    expect(summary.worst.map((row) => row.name)).not.toContain('IrisTabsList')
  })

  it('reclassifies a false "identical" where every framework had 0 extractable props', () => {
    const summary = computeParitySummary([
      component('IrisMenuSeparator', { react: [], vue: [], solid: [], svelte: [] }, [
        'react',
        'solid',
      ]),
    ])
    // ratio 1 across four empty lists looks identical but proves nothing.
    expect(summary.identical).toBe(0)
    expect(summary.intrinsicSpread).toBe(1)
  })

  it('mentions intrinsic-spread in the formatted line', () => {
    const line = formatParityLine(
      computeParitySummary([
        component('IrisTabsList', { react: [], vue: [], solid: [], svelte: [] }, ['react']),
      ]),
    )
    expect(line).toContain('1 intrinsic-spread')
  })
})

describe('formatParityLine', () => {
  it('summarises buckets and names the worst offender', () => {
    const summary = computeParitySummary([
      component('IrisTable', { react: ['a', 'b'], vue: ['a'], solid: ['a'], svelte: ['a'] }),
    ])
    const line = formatParityLine(summary)
    expect(line).toContain('0 identical')
    expect(line).toContain('1 divergent')
    expect(line).toContain('worst IrisTable')
  })
})
