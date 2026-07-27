import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, type VNode } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import axe from 'axe-core'
import {
  IrisAccordion,
  IrisAccordionItem,
  IrisAlert,
  IrisBadge,
  IrisButton,
  IrisCombobox,
  IrisDialog,
  IrisDialogClose,
  IrisDialogContent,
  IrisDialogDescription,
  IrisDialogTitle,
  IrisDialogTrigger,
  IrisDrawer,
  IrisDrawerClose,
  IrisDrawerContent,
  IrisDrawerTitle,
  IrisDrawerTrigger,
  IrisDropdown,
  IrisDropdownItem,
  IrisDropdownMenu,
  IrisDropdownTrigger,
  IrisFormField,
  IrisInput,
  IrisMenu,
  IrisMenuContent,
  IrisMenuItem,
  IrisMenuTrigger,
  IrisPagination,
  IrisPopover,
  IrisPopoverContent,
  IrisPopoverTrigger,
  IrisRadio,
  IrisRadioGroup,
  IrisSelect,
  IrisTabs,
  IrisTabsContent,
  IrisTabsList,
  IrisTabsTrigger,
  IrisTooltip,
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
function mountW(factory: () => VNode): VueWrapper {
  const wrapper = mount(defineComponent({ setup: () => factory }), { attachTo: document.body })
  wrappers.push(wrapper)
  return wrapper
}
function mountIt(factory: () => VNode): HTMLElement {
  return mountW(factory).element as HTMLElement
}

afterEach(() => {
  for (const wrapper of wrappers) wrapper.unmount()
  wrappers.length = 0
})

describe('@iris-ui-kit/vue a11y (axe-core)', () => {
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

  // Floating / overlay surfaces — the regression-prone set. Each is opened so
  // axe scans the live teleported content (role wiring, aria-expanded, labelling).

  it('open IrisPopover has no violations', async () => {
    mountIt(() =>
      h(
        IrisPopover,
        { defaultOpen: true },
        {
          default: () => [
            h(IrisPopoverTrigger, null, { default: () => 'Toggle' }),
            h(IrisPopoverContent, { 'aria-label': 'Details' }, { default: () => 'Popover body' }),
          ],
        },
      ),
    )
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('open IrisMenu has no violations', async () => {
    mountIt(() =>
      h(
        IrisMenu,
        { defaultOpen: true },
        {
          default: () => [
            h(IrisMenuTrigger, null, { default: () => 'Actions' }),
            h(IrisMenuContent, null, {
              default: () => [
                h(IrisMenuItem, null, { default: () => 'Rename' }),
                h(IrisMenuItem, null, { default: () => 'Delete' }),
              ],
            }),
          ],
        },
      ),
    )
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('open IrisDropdown has no violations', async () => {
    mountIt(() =>
      h(
        IrisDropdown,
        { defaultOpen: true },
        {
          default: () => [
            h(IrisDropdownTrigger, null, { default: () => 'Open' }),
            h(IrisDropdownMenu, null, {
              default: () => [
                h(IrisDropdownItem, null, { default: () => 'One' }),
                h(IrisDropdownItem, null, { default: () => 'Two' }),
              ],
            }),
          ],
        },
      ),
    )
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('open IrisDrawer has no violations', async () => {
    mountIt(() =>
      h(
        IrisDrawer,
        { defaultOpen: true },
        {
          default: () => [
            h(IrisDrawerTrigger, null, { default: () => 'Open' }),
            h(IrisDrawerContent, null, {
              default: () => [
                h(IrisDrawerTitle, null, { default: () => 'Settings' }),
                h('p', null, 'Drawer body'),
                h(IrisDrawerClose, null, { default: () => 'Close' }),
              ],
            }),
          ],
        },
      ),
    )
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('open IrisSelect listbox has no violations', async () => {
    const w = mountW(() =>
      h(
        IrisFormField,
        { label: 'Choose' },
        {
          default: () =>
            h(IrisSelect, {
              items: [
                { value: 'a', label: 'Alpha' },
                { value: 'b', label: 'Bravo' },
              ],
            }),
        },
      ),
    )
    await w.find('[data-iris-select-trigger]').trigger('click')
    await nextTick()
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('open IrisCombobox has no violations', async () => {
    const w = mountW(() =>
      h(
        IrisFormField,
        { label: 'Fruit' },
        {
          default: () =>
            h(IrisCombobox, {
              options: [
                { label: 'Apple', value: 'apple' },
                { label: 'Banana', value: 'banana' },
              ],
            }),
        },
      ),
    )
    await w.find('[data-iris-combobox-input]').trigger('focus')
    await nextTick()
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('visible IrisTooltip has no violations', async () => {
    const w = mountW(() =>
      h(
        IrisTooltip,
        { content: 'More info', openDelay: 0 },
        { default: () => h('button', { type: 'button' }, 'Help') },
      ),
    )
    await w.find('button').trigger('pointerenter')
    await nextTick()
    expect(await axeViolations(document.body)).toEqual([])
  })
})
