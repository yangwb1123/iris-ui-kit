import { describe, it, expect } from 'vitest'
import { buildManifest, discover, type Framework } from '@iris-ui-kit/manifest'
import {
  listComponents,
  searchComponents,
  getComponentApi,
  getFrameworkComponentApi,
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
    expect(api?.importFrom.react).toBe('@iris-ui-kit/react')
  })
  it('returns null for an unknown component', () => {
    expect(getComponentApi(manifest, 'IrisNope')).toBeNull()
  })
  it('selects the native contract for the requested adapter', () => {
    const vue = getFrameworkComponentApi(manifest, 'IrisSelect', 'vue')
    expect(vue?.contract.props.map((prop) => prop.name)).toContain('modelValue')
    expect(vue?.contract.events).toContain('update:modelValue')
    expect(vue?.contract.props.map((prop) => prop.name)).not.toContain('renderTrigger')

    const solid = getFrameworkComponentApi(manifest, 'IrisSelect', 'solid')
    expect(solid?.contract.props.map((prop) => prop.name)).toContain('onChange')
  })
})

describe('scaffoldSnippet', () => {
  it('emits an import + usage for a supported framework', () => {
    const snippet = scaffoldSnippet(manifest, 'IrisButton', 'react')
    expect(snippet).toContain("import { IrisButton } from '@iris-ui-kit/react'")
    expect(snippet).toContain('<IrisButton')
  })
  it('notes plugin activation for plugin components', () => {
    const snippet = scaffoldSnippet(manifest, 'IrisProTable', 'react')
    expect(snippet).toContain('@iris-ui-kit/plugin-pro-table')
    expect(snippet).toContain('IrisProvider')
  })
  it.each([
    ['IrisProTable', 'store'],
    ['IrisFormBuilder', 'schema'],
  ])('includes the required Svelte %s.%s prop', (component, prop) => {
    const snippet = scaffoldSnippet(manifest, component, 'svelte')!
    expect(snippet).toContain(`<${component} ${prop}={/*`)
  })
  it('uses Vue attribute syntax for vue', () => {
    const snippet = scaffoldSnippet(manifest, 'IrisButton', 'vue')
    expect(snippet).toContain("from '@iris-ui-kit/vue'")
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
    // Both come from @iris-ui-kit/react → a single import statement listing both.
    expect(view).toContain("import { IrisButton, IrisInput } from '@iris-ui-kit/react'")
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

  it('validates against the selected framework contract, not React props', () => {
    const vue = validateUsage(manifest, {
      name: 'IrisSelect',
      framework: 'vue',
      props: { items: 'items', modelValue: 'a', renderTrigger: 'trigger' },
    })
    expect(vue.some((issue) => /Unknown prop "renderTrigger"/.test(issue.message))).toBe(true)
    expect(vue.some((issue) => /Unknown prop "modelValue"/.test(issue.message))).toBe(false)

    const react = validateUsage(manifest, {
      name: 'IrisSelect',
      framework: 'react',
      props: { items: 'items', value: 'a', modelValue: 'a' },
    })
    expect(react.some((issue) => /Unknown prop "modelValue"/.test(issue.message))).toBe(true)
  })
})

describe('detectControlledPair', () => {
  it('finds value+onValueChange on IrisSelect', () => {
    const pair = detectControlledPair(getComponentApi(manifest, 'IrisSelect')!, 'react')
    expect(pair).toMatchObject({ value: 'value', handler: 'onValueChange' })
  })
  it('finds Vue modelValue+update:modelValue on IrisSelect', () => {
    const pair = detectControlledPair(getComponentApi(manifest, 'IrisSelect')!, 'vue')
    expect(pair).toMatchObject({ value: 'modelValue', handler: 'update:modelValue' })
  })
  it('finds Solid value+onValueChange from its native compatibility contract', () => {
    const pair = detectControlledPair(getComponentApi(manifest, 'IrisSelect')!, 'solid')
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
      binding: /value=\{value\} onValueChange=\{\(next\) => value = next\}/,
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
    expect(code).toContain("import { IrisButton } from '@iris-ui-kit/react'")
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
    expect(view).toContain(
      "import { createProTableStore } from '@iris-ui-kit/plugin-pro-table/core'",
    )
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
    // Vue's native contract is modelValue/update:modelValue → plain v-model.
    expect(view).toContain('v-model="value"')
  })

  it('wires both Svelte plugin data contracts with runnable store/schema stubs', () => {
    const view = generateView(manifest, {
      framework: 'svelte',
      components: ['IrisProTable', 'IrisFormBuilder'],
    })!
    expect(view).toContain(
      "import { createProTableStore } from '@iris-ui-kit/plugin-pro-table/core'",
    )
    expect(view).toContain('const store = createProTableStore(')
    expect(view).toContain('<IrisProTable store={store}>')
    expect(view).toContain('const schema = {')
    expect(view).toContain('<IrisFormBuilder schema={schema}>')
  })

  it('wires native IrisTable with columns/data rather than a ProTable store', () => {
    const view = generateView(manifest, { framework: 'vue', components: ['IrisTable'] })!
    expect(view).toContain('const rows = [')
    expect(view).toContain('const columns = [')
    expect(view).toContain(':columns="columns" :data="rows"')
    expect(view).not.toContain('createProTableStore')
    expect(view).not.toContain('store=')
  })

  it('wires a Tree nodes stub bound to the manifest `nodes` prop', () => {
    const view = generateView(manifest, { framework: 'react', components: ['IrisTree'] })!
    // A deterministic IrisTreeNode[] stub (id + label) bound to `nodes`.
    expect(view).toContain('const nodes = [')
    expect(view).toContain("id: 'root'")
    expect(view).toContain("label: 'Root'")
    expect(view).toContain('nodes={nodes}')
    // Tree is selectable → its `selected` controlled pair still gets real state,
    // not a placeholder fill.
    expect(view).not.toContain('/* IrisTreeNode[] */')
  })

  it('uses the Vue `:nodes` binding for a Tree stub', () => {
    const view = generateView(manifest, { framework: 'vue', components: ['IrisTree'] })!
    expect(view).toContain('const nodes = [')
    expect(view).toContain(':nodes="nodes"')
  })

  it('wires a Select items stub bound to the manifest `items` prop (+ value state)', () => {
    const view = generateView(manifest, { framework: 'react', components: ['IrisSelect'] })!
    // A deterministic IrisSelectItem[] stub (value + label) bound to `items` —
    // NOT the old placeholder fill for the required `items` prop.
    expect(view).toContain('const items = [')
    expect(view).toContain("{ value: 'a', label: 'Option A' }")
    expect(view).toContain('items={items}')
    expect(view).not.toContain('/* IrisSelectItem')
    // The controlled `value` pair is still wired with real state.
    expect(view).toMatch(/const \[value, setValue\] = React\.useState\(/)
    expect(view).toContain('value={value} onValueChange={setValue}')
  })

  it('seeds a Calendar `value` with a concrete Date through the idiomatic binding', () => {
    const react = generateView(manifest, { framework: 'react', components: ['IrisCalendar'] })!
    // Calendar's value is a controlled pair: seeded with a fixed Date, bound the
    // normal way (no duplicate / no @valueChange hand-binding).
    expect(react).toMatch(/const \[value, setValue\] = React\.useState\(new Date\('2026-01-01'\)\)/)
    expect(react).toContain('value={value} onValueChange={setValue}')

    const vue = generateView(manifest, { framework: 'vue', components: ['IrisCalendar'] })!
    expect(vue).toContain("const value = ref(new Date('2026-01-01'))")
    expect(vue).toContain('v-model="value"')
  })

  it('disambiguates colliding state locals when composing two value-controlled components', () => {
    // Select and Calendar both control `value` → the second gets `value2` so the
    // generated view compiles (no re-declared const).
    const view = generateView(manifest, {
      framework: 'react',
      components: ['IrisSelect', 'IrisCalendar'],
    })!
    expect(view).toContain('const [value, setValue] = React.useState(')
    expect(view).toContain('const [value2, setValue2] = React.useState(')
    expect(view).toContain('value={value} onValueChange={setValue}')
    expect(view).toContain('value={value2} onValueChange={setValue2}')
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
    const data = { framework: 'vue' as const, components: ['IrisTree', 'IrisCalendar'] }
    expect(generateView(manifest, data)).toBe(generateView(manifest, data))
  })
})

describe('generateTest (test skeleton)', () => {
  const switchEvent: Record<Framework, string> = {
    react: 'onChange',
    solid: 'onChange',
    svelte: 'onChange',
    vue: 'eventSpy',
  }
  for (const fw of ['react', 'solid', 'svelte', 'vue'] as Framework[]) {
    it(`emits a ${fw} test referencing the component + a non-click event`, () => {
      // Event names come from each adapter's native contract. Vue's
      // update:modelValue uses a safe local identifier (`eventSpy`).
      const test = generateTest(manifest, 'IrisSwitch', fw)!
      expect(test).toContain('IrisSwitch')
      expect(test).toContain(`const ${switchEvent[fw]} = vi.fn()`)
      expect(test).toContain(`expect(${switchEvent[fw]}).not.toHaveBeenCalled()`)
      expect(test).not.toContain(`expect(${switchEvent[fw]}).toHaveBeenCalled()`)
      if (fw === 'vue') expect(test).toContain("'onUpdate:modelValue': eventSpy")
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

  const buttonEvent: Record<Framework, string> = {
    react: 'onClick',
    solid: 'onClick',
    svelte: 'onclick',
    vue: 'click',
  }
  for (const fw of ['react', 'solid', 'svelte', 'vue'] as Framework[]) {
    it(`drives a real click + asserts a call for a ${fw} click-like event`, () => {
      // React/Solid, Svelte and Vue intentionally spell this listener
      // differently; codegen must honor the selected adapter's contract.
      const test = generateTest(manifest, 'IrisButton', fw)!
      expect(test).toContain(`const ${buttonEvent[fw]} = vi.fn()`)
      expect(test).toContain(`expect(${buttonEvent[fw]}).toHaveBeenCalled()`)
      expect(test).not.toContain(`expect(${buttonEvent[fw]}).not.toHaveBeenCalled()`)
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

  it.each([
    ['IrisProTable', 'store'],
    ['IrisFormBuilder', 'schema'],
  ])('includes required Svelte %s.%s setup in generated tests', (component, prop) => {
    const test = generateTest(manifest, component, 'svelte')!
    expect(test).toContain(`render(${component}, { props: { ${prop}: undefined /*`)
  })

  it('returns null for an unknown/unsupported component', () => {
    expect(generateTest(manifest, 'IrisNope', 'react')).toBeNull()
  })

  it('is deterministic (same input → same output)', () => {
    expect(generateTest(manifest, 'IrisSwitch', 'react')).toBe(
      generateTest(manifest, 'IrisSwitch', 'react'),
    )
  })
})
