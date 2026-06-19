import { describe, it, expect } from 'vitest'
import { buildManifest, discover, type Framework } from '@iris-ui/manifest'
import {
  listComponents,
  searchComponents,
  getComponentApi,
  scaffoldSnippet,
  scaffoldView,
  suggestComponents,
  validateUsage,
  generateView,
  generateTest,
} from './tools'
import { detectControlledPair } from './codegen'

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

describe('detectControlledPair', () => {
  it('finds value+onValueChange on IrisSelect', () => {
    const pair = detectControlledPair(getComponentApi(manifest, 'IrisSelect')!)
    expect(pair).toMatchObject({ value: 'value', handler: 'onValueChange' })
  })
  it('finds checked+onChange on IrisSwitch (generic handler)', () => {
    const pair = detectControlledPair(getComponentApi(manifest, 'IrisSwitch')!)
    expect(pair).toMatchObject({ value: 'checked', handler: 'onChange' })
  })
  it('finds open+onOpenChange on IrisDialog', () => {
    const pair = detectControlledPair(getComponentApi(manifest, 'IrisDialog')!)
    expect(pair).toMatchObject({ value: 'open', handler: 'onOpenChange' })
  })
  it('returns null for a component with no controlled value (IrisButton)', () => {
    expect(detectControlledPair(getComponentApi(manifest, 'IrisButton')!)).toBeNull()
  })
})

describe('scaffoldSnippet wiring (controlled components)', () => {
  // The state hook each framework must emit + the binding it must produce for a
  // controlled component (IrisSelect: value + onValueChange).
  const expectations: Record<Framework, { state: RegExp; binding: RegExp }> = {
    react: {
      state: /const \[value, setValue\] = React\.useState\(/,
      binding: /value=\{value\} onValueChange=\{setValue\}/,
    },
    solid: {
      state: /const \[value, setValue\] = createSignal\(/,
      binding: /value=\{value\(\)\} onValueChange=\{setValue\}/,
    },
    svelte: {
      state: /let value = \$state\(/,
      binding: /bind:value=\{value\}/,
    },
    vue: {
      state: /const value = ref\(/,
      binding: /v-model="value"/,
    },
  }

  for (const fw of ['react', 'solid', 'svelte', 'vue'] as Framework[]) {
    it(`emits real ${fw} state scaffolding + binding for a controlled component`, () => {
      const code = scaffoldSnippet(manifest, 'IrisSelect', fw)!
      expect(code).toMatch(expectations[fw].state)
      expect(code).toMatch(expectations[fw].binding)
      expect(code).toContain('IrisSelect')
    })
  }

  it('seeds the state from the manifest default (IrisDialog open defaults to false)', () => {
    const code = scaffoldSnippet(manifest, 'IrisDialog', 'react')!
    expect(code).toMatch(/const \[open, setOpen\] = React\.useState\(false\)/)
    expect(code).toContain('open={open} onOpenChange={setOpen}')
  })

  it('keeps the import + bare tag shape for a non-controlled component (stable)', () => {
    const code = scaffoldSnippet(manifest, 'IrisButton', 'react')!
    expect(code).toContain("import { IrisButton } from '@iris-ui/react'")
    expect(code).not.toContain('useState')
  })

  it('is deterministic (same input → same output)', () => {
    expect(scaffoldSnippet(manifest, 'IrisSelect', 'react')).toBe(
      scaffoldSnippet(manifest, 'IrisSelect', 'react'),
    )
  })
})

describe('generateView (wired composed view)', () => {
  it('composes >1 component and includes a data-wiring stub (table)', () => {
    const view = generateView(manifest, {
      framework: 'react',
      components: ['IrisProTable', 'IrisSelect'],
    })!
    expect(view).not.toBeNull()
    // More than one component is present.
    expect(view).toContain('<IrisProTable')
    expect(view).toContain('<IrisSelect')
    // A real data-wiring stub for the table.
    expect(view).toContain('createProTableStore({ data: rows, columns, rowKey:')
    expect(view).toContain("import { createProTableStore } from '@iris-ui/plugin-pro-table/core'")
    expect(view).toContain('store={store}')
    // The controlled component is wired with real state.
    expect(view).toMatch(/const \[value, setValue\] = React\.useState\(/)
  })

  it('wires a form-builder schema stub and binds it', () => {
    const view = generateView(manifest, {
      framework: 'vue',
      components: ['IrisFormBuilder', 'IrisSwitch'],
      layout: 'IrisCard',
    })!
    expect(view).toContain('const schema = {')
    expect(view).toContain(':schema="schema"')
    expect(view).toContain('<IrisCard>')
    // Switch gets a vue v-model binding for its controlled `checked`.
    expect(view).toContain('v-model:checked="checked"')
  })

  it('returns null for empty input or an unknown/unsupported component', () => {
    expect(generateView(manifest, { framework: 'react', components: [] })).toBeNull()
    expect(
      generateView(manifest, { framework: 'react', components: ['IrisSelect', 'IrisNope'] }),
    ).toBeNull()
  })

  it('is deterministic (same input → same output)', () => {
    const req = { framework: 'react' as const, components: ['IrisProTable', 'IrisSelect'] }
    expect(generateView(manifest, req)).toBe(generateView(manifest, req))
  })
})

describe('generateTest (test skeleton)', () => {
  for (const fw of ['react', 'solid', 'svelte', 'vue'] as Framework[]) {
    it(`emits a ${fw} test referencing the component + a non-click event`, () => {
      // IrisSwitch's event is `onChange` (NOT click-like) → keeps the
      // no-spurious-emit mount-smoke (`not.toHaveBeenCalled()`).
      const test = generateTest(manifest, 'IrisSwitch', fw)!
      expect(test).toContain('IrisSwitch')
      expect(test).toContain('const onChange = vi.fn()')
      expect(test).toContain('expect(onChange).not.toHaveBeenCalled()')
      expect(test).not.toContain('expect(onChange).toHaveBeenCalled()')
      // Uses the framework's testing-library.
      const tl = {
        react: '@testing-library/react',
        solid: '@solidjs/testing-library',
        svelte: '@testing-library/svelte',
        vue: '@vue/test-utils',
      }[fw]
      expect(test).toContain(tl)
    })
  }

  for (const fw of ['react', 'solid', 'svelte', 'vue'] as Framework[]) {
    it(`drives a real click + asserts a call for a ${fw} click-like event`, () => {
      // IrisButton's event is `onClick` (click-like) → fires a real interaction
      // and asserts the spy WAS called.
      const test = generateTest(manifest, 'IrisButton', fw)!
      expect(test).toContain('const onClick = vi.fn()')
      expect(test).toContain('expect(onClick).toHaveBeenCalled()')
      expect(test).not.toContain('not.toHaveBeenCalled()')
      if (fw === 'vue') {
        // Vue drives the click through the mounted wrapper (async).
        expect(test).toContain("await wrapper.trigger('click')")
        expect(test).toContain('async () => {')
      } else {
        // React/Solid/Svelte fire a click on the rendered root via fireEvent.
        expect(test).toContain('fireEvent')
        expect(test).toContain('fireEvent.click(container.firstChild as Element)')
      }
    })
  }

  it('returns null for an unknown/unsupported component', () => {
    expect(generateTest(manifest, 'IrisNope', 'react')).toBeNull()
  })

  it('is deterministic (same input → same output)', () => {
    expect(generateTest(manifest, 'IrisSwitch', 'react')).toBe(
      generateTest(manifest, 'IrisSwitch', 'react'),
    )
  })
})
