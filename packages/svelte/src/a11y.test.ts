import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/svelte'
import axe from 'axe-core'

// Standalone (no slotted children needed) components render directly.
import { IrisAlert, IrisAvatar, IrisPagination } from './index'

// Slotted / context-bound components use tiny .svelte harness fixtures, since a
// `.ts` test cannot author Svelte snippets inline. Each fixture renders the
// component(s) with the children/props they need for a real accessible name.
import ButtonA11yHarness from './primitives/button/ButtonA11yHarness.svelte'
import BadgeHarness from './primitives/badge/BadgeHarness.svelte'
import FormFieldHarness from './primitives/form-field/FormFieldHarness.svelte'
import AccordionHarness from './primitives/accordion/AccordionHarness.svelte'
import RadioHarness from './primitives/radio/RadioHarness.svelte'
import SwitchA11yHarness from './primitives/switch/SwitchA11yHarness.svelte'
import CheckboxA11yHarness from './primitives/checkbox/CheckboxA11yHarness.svelte'
import BreadcrumbHarness from './primitives/breadcrumb/BreadcrumbHarness.svelte'
import TabsHarness from './primitives/tabs/TabsHarness.svelte'

afterEach(cleanup)

/**
 * Run axe over a node restricted to WCAG 2.0/2.1 A & AA rules. `color-contrast`
 * is disabled because it needs real layout/paint that jsdom does not provide;
 * best-practice/page-scoped rules (region, landmarks) are excluded by the WCAG
 * tag filter so component fragments aren't flagged for lacking a <main>.
 *
 * Mirrors packages/react/src/a11y.test.tsx so the four framework adapters share
 * one a11y gate shape.
 */
async function axeViolations(node: Element): Promise<string[]> {
  const results = await axe.run(node, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  })
  return results.violations.map((v) => `${v.id}: ${v.help}`)
}

describe('@iris-ui-kit/svelte a11y (axe-core)', () => {
  it('IrisButton has no violations', async () => {
    const { container } = render(ButtonA11yHarness)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisBadge has no violations', async () => {
    const { container } = render(BadgeHarness)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisAlert has no violations', async () => {
    const { container } = render(IrisAlert, { props: { title: 'Heads up' } })
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisAvatar has no violations', async () => {
    const { container } = render(IrisAvatar, { props: { name: 'Ada Lovelace' } })
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisFormField + IrisInput is properly labeled', async () => {
    const { container } = render(FormFieldHarness, {
      props: { label: 'Email', hint: 'We never share it.' },
    })
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisAccordion has no violations', async () => {
    const { container } = render(AccordionHarness)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisPagination has no violations', async () => {
    const { container } = render(IrisPagination, {
      props: { total: 50, value: 2, showFirstLast: true },
    })
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisRadioGroup + IrisRadio has no violations', async () => {
    const { container } = render(RadioHarness)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisSwitch has no violations', async () => {
    const { container } = render(SwitchA11yHarness)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisCheckbox has no violations', async () => {
    const { container } = render(CheckboxA11yHarness)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisBreadcrumb has no violations', async () => {
    const { container } = render(BreadcrumbHarness)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisTabs has no violations', async () => {
    const { container } = render(TabsHarness)
    expect(await axeViolations(container)).toEqual([])
  })
})
