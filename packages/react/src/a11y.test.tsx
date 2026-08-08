import { afterEach, describe, expect, it } from 'vitest'
import * as React from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
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

afterEach(cleanup)

/**
 * Run axe over a node restricted to WCAG 2.0/2.1 A & AA rules. `color-contrast`
 * is disabled because it needs real layout/paint that jsdom does not provide;
 * best-practice/page-scoped rules (region, landmarks) are excluded by using the
 * WCAG tag filter so component fragments aren't flagged for lacking a <main>.
 */
async function axeViolations(node: Element): Promise<string[]> {
  const results = await axe.run(node, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  })
  return results.violations.map((v) => `${v.id}: ${v.help}`)
}

describe('@iris-ui-kit/react a11y (axe-core)', () => {
  it('IrisButton has no violations', async () => {
    const { container } = render(<IrisButton>Save</IrisButton>)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisBadge has no violations', async () => {
    const { container } = render(<IrisBadge>New</IrisBadge>)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisAlert has no violations', async () => {
    const { container } = render(<IrisAlert>Heads up</IrisAlert>)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisFormField + IrisInput is properly labeled', async () => {
    const { container } = render(
      <IrisFormField label="Email" hint="We never share it.">
        <IrisInput value="" onChange={() => {}} />
      </IrisFormField>,
    )
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisAccordion has no violations', async () => {
    const { container } = render(
      <IrisAccordion>
        <IrisAccordionItem value="a" title="A">
          Panel A
        </IrisAccordionItem>
        <IrisAccordionItem value="b" title="B">
          Panel B
        </IrisAccordionItem>
      </IrisAccordion>,
    )
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisPagination has no violations', async () => {
    const { container } = render(<IrisPagination total={50} value={2} showFirstLast />)
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisRadioGroup has no violations', async () => {
    const { container } = render(
      <IrisRadioGroup value="x" onChange={() => {}}>
        <IrisRadio value="x">Option X</IrisRadio>
        <IrisRadio value="y">Option Y</IrisRadio>
      </IrisRadioGroup>,
    )
    expect(await axeViolations(container)).toEqual([])
  })

  it('IrisTabs has no violations', async () => {
    const { container } = render(
      <IrisTabs defaultValue="a">
        <IrisTabsList>
          <IrisTabsTrigger value="a">A</IrisTabsTrigger>
          <IrisTabsTrigger value="b">B</IrisTabsTrigger>
        </IrisTabsList>
        <IrisTabsContent value="a">Panel A</IrisTabsContent>
        <IrisTabsContent value="b">Panel B</IrisTabsContent>
      </IrisTabs>,
    )
    expect(await axeViolations(container)).toEqual([])
  })

  it('open IrisDialog has no violations (portaled content)', async () => {
    render(
      <IrisDialog defaultOpen>
        <IrisDialogTrigger>Open</IrisDialogTrigger>
        <IrisDialogContent>
          <IrisDialogTitle>Title</IrisDialogTitle>
          <IrisDialogDescription>A short description.</IrisDialogDescription>
          <IrisDialogClose>Close</IrisDialogClose>
        </IrisDialogContent>
      </IrisDialog>,
    )
    // Content is portaled to document.body, so scan the whole document.
    expect(await axeViolations(document.body)).toEqual([])
  })

  // Floating / overlay surfaces — the regression-prone set. Each is opened so
  // axe scans the live portaled content (role wiring, aria-expanded, labelling).

  it('open IrisPopover has no violations', async () => {
    render(
      <IrisPopover defaultOpen>
        <IrisPopoverTrigger>Toggle</IrisPopoverTrigger>
        <IrisPopoverContent aria-label="Details">Popover body</IrisPopoverContent>
      </IrisPopover>,
    )
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('open IrisMenu has no violations', async () => {
    render(
      <IrisMenu defaultOpen>
        <IrisMenuTrigger>Actions</IrisMenuTrigger>
        <IrisMenuContent>
          <IrisMenuItem>Rename</IrisMenuItem>
          <IrisMenuItem>Delete</IrisMenuItem>
        </IrisMenuContent>
      </IrisMenu>,
    )
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('open IrisDropdown has no violations', async () => {
    render(
      <IrisDropdown defaultOpen>
        <IrisDropdownTrigger>Open</IrisDropdownTrigger>
        <IrisDropdownMenu>
          <IrisDropdownItem>One</IrisDropdownItem>
          <IrisDropdownItem>Two</IrisDropdownItem>
        </IrisDropdownMenu>
      </IrisDropdown>,
    )
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('open IrisDrawer has no violations', async () => {
    render(
      <IrisDrawer defaultOpen>
        <IrisDrawerTrigger>Open</IrisDrawerTrigger>
        <IrisDrawerContent>
          <IrisDrawerTitle>Settings</IrisDrawerTitle>
          <p>Drawer body</p>
          <IrisDrawerClose>Close</IrisDrawerClose>
        </IrisDrawerContent>
      </IrisDrawer>,
    )
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('open IrisSelect listbox has no violations', async () => {
    render(
      <IrisFormField label="Choose">
        <IrisSelect
          items={[
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Bravo' },
          ]}
        />
      </IrisFormField>,
    )
    await act(async () => {
      fireEvent.click(document.querySelector('[data-iris-select-trigger]')!)
    })
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('keyboard-opened IrisSelect has no violations; Escape closes and restores trigger focus', async () => {
    render(
      <IrisFormField label="Choose">
        <IrisSelect
          items={[
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Bravo' },
          ]}
        />
      </IrisFormField>,
    )
    const trigger = document.querySelector('[data-iris-select-trigger]') as HTMLButtonElement
    await act(async () => {
      trigger.focus()
      fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // closed-trigger open path
    })
    expect(await axeViolations(document.body)).toEqual([])
    await act(async () => {
      fireEvent.keyDown(trigger, { key: 'Escape' })
    })
    expect(document.querySelector('[role=listbox]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('open IrisCombobox has no violations', async () => {
    const { container } = render(
      <IrisFormField label="Fruit">
        <IrisCombobox
          options={[
            { label: 'Apple', value: 'apple' },
            { label: 'Banana', value: 'banana' },
          ]}
        />
      </IrisFormField>,
    )
    await act(async () => {
      fireEvent.focus(container.querySelector('input')!)
    })
    expect(await axeViolations(document.body)).toEqual([])
  })

  it('visible IrisTooltip has no violations', async () => {
    const { container } = render(
      <IrisTooltip content="More info" openDelay={0}>
        <button type="button">Help</button>
      </IrisTooltip>,
    )
    await act(async () => {
      fireEvent.focus(container.querySelector('button')!)
    })
    expect(await axeViolations(document.body)).toEqual([])
  })
})
