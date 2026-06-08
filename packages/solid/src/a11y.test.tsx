import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import axe from 'axe-core'
import {
  IrisAccordion,
  IrisAccordionItem,
  IrisAlert,
  IrisAvatar,
  IrisBadge,
  IrisBreadcrumb,
  IrisBreadcrumbItem,
  IrisButton,
  IrisCheckbox,
  IrisFormField,
  IrisInput,
  IrisPagination,
  IrisRadio,
  IrisRadioGroup,
  IrisSwitch,
  IrisTabs,
  IrisTabsContent,
  IrisTabsList,
  IrisTabsTrigger,
} from './index'

afterEach(cleanup)

/**
 * Run axe over a node restricted to WCAG 2.0/2.1 A & AA rules. `color-contrast`
 * is disabled because it needs real layout/paint that jsdom does not provide;
 * best-practice/page-scoped rules (region, landmarks) are excluded by using the
 * WCAG tag filter so component fragments aren't flagged for lacking a <main>.
 * Mirrors packages/react/src/a11y.test.tsx so the two adapters share a gate.
 */
async function axeViolations(node: Element): Promise<string[]> {
  const results = await axe.run(node, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  })
  return results.violations.map((v) => `${v.id}: ${v.help}`)
}

describe('@iris-ui/solid a11y (axe-core)', () => {
  it('IrisButton has no violations', async () => {
    const { container } = render(() => <IrisButton>Save</IrisButton>)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisBadge has no violations', async () => {
    const { container } = render(() => <IrisBadge>New</IrisBadge>)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisAlert has no violations', async () => {
    const { container } = render(() => <IrisAlert>Heads up</IrisAlert>)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisAvatar (fallback initials) has no violations', async () => {
    const { container } = render(() => <IrisAvatar name="Ada Lovelace" />)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisFormField + IrisInput is properly labeled', async () => {
    const { container } = render(() => (
      <IrisFormField label="Email" hint="We never share it.">
        <IrisInput value="" onInput={() => {}} />
      </IrisFormField>
    ))
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisFormField + IrisSwitch is properly labeled', async () => {
    const { container } = render(() => (
      <IrisFormField label="Notifications">
        <IrisSwitch />
      </IrisFormField>
    ))
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisCheckbox (with label children) has no violations', async () => {
    const { container } = render(() => <IrisCheckbox>Accept terms</IrisCheckbox>)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisAccordion has no violations', async () => {
    const { container } = render(() => (
      <IrisAccordion>
        <IrisAccordionItem value="a" title="A">
          Panel A
        </IrisAccordionItem>
        <IrisAccordionItem value="b" title="B">
          Panel B
        </IrisAccordionItem>
      </IrisAccordion>
    ))
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisPagination has no violations', async () => {
    const { container } = render(() => <IrisPagination total={50} page={2} pageSize={10} />)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisRadioGroup has no violations', async () => {
    const { container } = render(() => (
      <IrisRadioGroup value="x">
        <IrisRadio value="x">Option X</IrisRadio>
        <IrisRadio value="y">Option Y</IrisRadio>
      </IrisRadioGroup>
    ))
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisBreadcrumb has no violations', async () => {
    const { container } = render(() => (
      <IrisBreadcrumb>
        <IrisBreadcrumbItem href="/">Home</IrisBreadcrumbItem>
        <IrisBreadcrumbItem href="/team">Team</IrisBreadcrumbItem>
        <IrisBreadcrumbItem current>Settings</IrisBreadcrumbItem>
      </IrisBreadcrumb>
    ))
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisTabs has no violations', async () => {
    const { container } = render(() => (
      <IrisTabs defaultValue="a">
        <IrisTabsList>
          <IrisTabsTrigger value="a">A</IrisTabsTrigger>
          <IrisTabsTrigger value="b">B</IrisTabsTrigger>
        </IrisTabsList>
        <IrisTabsContent value="a">Panel A</IrisTabsContent>
        <IrisTabsContent value="b">Panel B</IrisTabsContent>
      </IrisTabs>
    ))
    expect(await axeViolations(container)).toEqual([])
  })
})
