import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, type VNode } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import axe from 'axe-core'
import {
  IrisAccordion,
  IrisAccordionItem,
  IrisAlert,
  IrisBadge,
  IrisButton,
  IrisDialog,
  IrisDialogClose,
  IrisDialogContent,
  IrisDialogDescription,
  IrisDialogTitle,
  IrisDialogTrigger,
  IrisFormField,
  IrisInput,
  IrisPagination,
  IrisRadio,
  IrisRadioGroup,
  IrisTabs,
  IrisTabsContent,
  IrisTabsList,
  IrisTabsTrigger,
} from './index'

/** WCAG A/AA scan, minus color-contrast (needs real layout jsdom lacks). */
async function axeViolations(node: Element): Promise<string[]> {
  const results = await axe.run(node, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  })
  return results.violations.map((v) => `${v.id}: ${v.help}`)
}

const wrappers: VueWrapper[] = []
function mountIt(factory: () => VNode): HTMLElement {
  const wrapper = mount(defineComponent({ setup: () => factory }), { attachTo: document.body })
  wrappers.push(wrapper)
  return wrapper.element as HTMLElement
}

afterEach(() => {
  for (const wrapper of wrappers) wrapper.unmount()
  wrappers.length = 0
})

describe('@iris-ui/vue a11y (axe-core)', () => {
  it('IrisButton has no violations', async () => {
    const el = mountIt(() => h(IrisButton, null, { default: () => 'Save' }))
    expect(await axeViolations(el)).toEqual([])
  })

  it('IrisBadge has no violations', async () => {
    const el = mountIt(() => h(IrisBadge, null, { default: () => 'New' }))
    expect(await axeViolations(el)).toEqual([])
  })

  it('IrisAlert has no violations', async () => {
    const el = mountIt(() => h(IrisAlert, null, { default: () => 'Heads up' }))
    expect(await axeViolations(el)).toEqual([])
  })

  it('IrisFormField + IrisInput is properly labeled', async () => {
    const el = mountIt(() =>
      h(
        IrisFormField,
        { label: 'Email', hint: 'We never share it.' },
        {
          default: () => h(IrisInput, { modelValue: '' }),
        },
      ),
    )
    expect(await axeViolations(el)).toEqual([])
  })

  it('IrisAccordion has no violations', async () => {
    const el = mountIt(() =>
      h(IrisAccordion, null, {
        default: () => [
          h(IrisAccordionItem, { value: 'a', title: 'A' }, { default: () => 'Panel A' }),
          h(IrisAccordionItem, { value: 'b', title: 'B' }, { default: () => 'Panel B' }),
        ],
      }),
    )
    expect(await axeViolations(el)).toEqual([])
  })

  it('IrisPagination has no violations', async () => {
    const el = mountIt(() => h(IrisPagination, { modelValue: 2, total: 50, showFirstLast: true }))
    expect(await axeViolations(el)).toEqual([])
  })

  it('IrisRadioGroup has no violations', async () => {
    const el = mountIt(() =>
      h(
        IrisRadioGroup,
        { modelValue: 'x' },
        {
          default: () => [
            h(IrisRadio, { value: 'x' }, { default: () => 'Option X' }),
            h(IrisRadio, { value: 'y' }, { default: () => 'Option Y' }),
          ],
        },
      ),
    )
    expect(await axeViolations(el)).toEqual([])
  })

  it('IrisTabs has no violations', async () => {
    const el = mountIt(() =>
      h(
        IrisTabs,
        { defaultValue: 'a' },
        {
          default: () => [
            h(IrisTabsList, null, {
              default: () => [
                h(IrisTabsTrigger, { value: 'a' }, { default: () => 'A' }),
                h(IrisTabsTrigger, { value: 'b' }, { default: () => 'B' }),
              ],
            }),
            h(IrisTabsContent, { value: 'a' }, { default: () => 'Panel A' }),
            h(IrisTabsContent, { value: 'b' }, { default: () => 'Panel B' }),
          ],
        },
      ),
    )
    expect(await axeViolations(el)).toEqual([])
  })

  it('open IrisDialog has no violations (teleported content)', async () => {
    mountIt(() =>
      h(
        IrisDialog,
        { defaultOpen: true },
        {
          default: () => [
            h(IrisDialogTrigger, null, { default: () => 'Open' }),
            h(IrisDialogContent, null, {
              default: () => [
                h(IrisDialogTitle, null, { default: () => 'Title' }),
                h(IrisDialogDescription, null, { default: () => 'A short description.' }),
                h(IrisDialogClose, null, { default: () => 'Close' }),
              ],
            }),
          ],
        },
      ),
    )
    // Content is teleported to document.body, so scan the whole document.
    expect(await axeViolations(document.body)).toEqual([])
  })
})
