import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import PopoverAsChildHarness from './popover/PopoverAsChildHarness.svelte'
import MenuAsChildHarness from './menu/MenuAsChildHarness.svelte'
import TabsAsChildHarness from './tabs/TabsAsChildHarness.svelte'

afterEach(cleanup)

/**
 * `asChild` on the Popover / Menu / Tabs triggers.
 *
 * React and Vue have shipped this since the project began; the Svelte adapter
 * only had it on Dialog and Drawer, so `<IrisPopoverTrigger asChild>` and
 * `<IrisTabsTrigger asChild>` silently dropped the prop and rendered their own
 * wrapper `<button>`. These tests pin the same contract the Dialog/Drawer
 * harnesses already establish: no wrapper is emitted, rest props and ids
 * survive, the primitive's ARIA contract lands on the child, and clicking the
 * child still drives the primitive.
 */
describe('asChild parity (Svelte triggers)', () => {
  describe('IrisPopoverTrigger', () => {
    it('renders the child as the trigger with no wrapper button', () => {
      const { container } = render(PopoverAsChildHarness)
      // Exactly one button, and it is the IrisButton itself — the wrapper is gone.
      expect(container.querySelectorAll('button')).toHaveLength(1)
      const trigger = container.querySelector('button')!
      expect(trigger.classList.contains('iris-button')).toBe(true)
      expect(trigger.id).toBe('popover-trigger')
      expect(trigger.getAttribute('data-trigger-rest')).toBe('kept')
      expect(trigger.classList.contains('trigger-rest')).toBe(true)
    })

    it('forwards the popover ARIA contract onto the child element', () => {
      const { container } = render(PopoverAsChildHarness)
      const trigger = container.querySelector('button')!
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(trigger.getAttribute('aria-controls')).toBeTruthy()
      expect(trigger.getAttribute('data-state')).toBe('closed')
    })

    it('opens the popover when the asChild trigger is clicked', async () => {
      const { container, getByText } = render(PopoverAsChildHarness)
      const before = container.querySelector('[role="dialog"]')
      expect(before ?? null).toBeNull()

      await fireEvent.click(getByText('Open Popover'))
      expect(document.querySelector('[role="dialog"]')).not.toBeNull()
      expect(container.querySelector('button')?.getAttribute('aria-expanded')).toBe('true')
      expect(container.querySelector('button')?.getAttribute('data-state')).toBe('open')
    })
  })

  describe('IrisMenuTrigger', () => {
    it('renders the child as the trigger with no wrapper button', () => {
      const { container } = render(MenuAsChildHarness)
      expect(container.querySelectorAll('button')).toHaveLength(1)
      const trigger = container.querySelector('button')!
      expect(trigger.classList.contains('iris-button')).toBe(true)
      expect(trigger.id).toBe('menu-trigger')
      expect(trigger.getAttribute('data-trigger-rest')).toBe('kept')
    })

    it('forwards the menu-button ARIA contract onto the child element', () => {
      const { container } = render(MenuAsChildHarness)
      const trigger = container.querySelector('button')!
      expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(trigger.getAttribute('aria-controls')).toBeTruthy()
      expect(trigger.getAttribute('data-state')).toBe('closed')
    })

    it('opens the menu when the asChild trigger is clicked', async () => {
      const { container, getByText } = render(MenuAsChildHarness)
      await fireEvent.click(getByText('Open Menu'))
      expect(container.querySelector('button')?.getAttribute('aria-expanded')).toBe('true')
      expect(container.querySelector('button')?.getAttribute('data-state')).toBe('open')
    })
  })

  describe('IrisTabsTrigger', () => {
    it('renders both children as tabs with no wrapper buttons', () => {
      const { container } = render(TabsAsChildHarness)
      // No generated <button> for either trigger — the IrisButtons are the tabs.
      const buttons = container.querySelectorAll('button')
      expect(buttons).toHaveLength(2)
      for (const button of buttons) {
        // `iris-button` can only come from the asChild child element, so its
        // presence proves the wrapper branch was skipped.
        expect(button.classList.contains('iris-button')).toBe(true)
        // The parent class merges onto the child's own class.
        expect(button.classList.contains('trigger-rest')).toBe(true)
      }
    })

    it('forwards the full tab ARIA contract onto each child', () => {
      const { getByText } = render(TabsAsChildHarness)
      const one = getByText('One')
      const two = getByText('Two')
      for (const tab of [one, two]) {
        expect(tab.getAttribute('role')).toBe('tab')
        expect(tab.getAttribute('data-iris-tabs-trigger')).toBe('')
        expect(tab.getAttribute('data-value')).toBeTruthy()
      }
      expect(one.getAttribute('aria-selected')).toBe('true')
      expect(one.getAttribute('data-state')).toBe('active')
      expect(one.getAttribute('aria-controls')).toBe('iris-tabs-content-one')
      // The component owns `id` so the aria-controls relationship resolves;
      // a consumer-supplied id would break the tablist wiring.
      expect(one.id).toBe('iris-tabs-trigger-one')
      expect(one.getAttribute('tabindex')).toBe('0')

      expect(two.getAttribute('aria-selected')).toBe('false')
      expect(two.getAttribute('data-state')).toBe('inactive')
      expect(two.getAttribute('tabindex')).toBe('-1')
    })

    it('activates the tab when the asChild trigger is clicked', async () => {
      const { container, getByText } = render(TabsAsChildHarness)
      await fireEvent.click(getByText('Two'))
      const one = getByText('One')
      const two = getByText('Two')
      // The previously active tab must *release* aria-selected, not just the
      // clicked one gain it — this is what breaks if the asChild contract is
      // snapshotted instead of kept reactive.
      expect(two.getAttribute('aria-selected')).toBe('true')
      expect(two.getAttribute('data-state')).toBe('active')
      expect(two.getAttribute('tabindex')).toBe('0')
      expect(one.getAttribute('aria-selected')).toBe('false')
      expect(one.getAttribute('tabindex')).toBe('-1')
      expect(container.textContent).toContain('Second panel')
    })
  })
})
