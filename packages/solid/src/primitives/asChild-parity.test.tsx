import { render, fireEvent } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { IrisDialog } from './dialog/IrisDialog'
import { IrisDialogContent, IrisDialogClose } from './dialog/IrisDialogContent'
import { IrisDialogTrigger } from './dialog/IrisDialogTrigger'
import { IrisDrawer } from './drawer/IrisDrawer'
import { IrisDrawerContent, IrisDrawerClose } from './drawer/IrisDrawerContent'
import { IrisDrawerTrigger } from './drawer/IrisDrawerTrigger'
import { IrisMenu } from './menu/IrisMenu'
import { IrisMenuContent } from './menu/IrisMenuContent'
import { IrisMenuItem } from './menu/IrisMenuItem'
import { IrisMenuTrigger } from './menu/IrisMenuTrigger'
import { IrisPopover } from './popover/IrisPopover'
import { IrisPopoverContent } from './popover/IrisPopoverContent'
import { IrisPopoverTrigger } from './popover/IrisPopoverTrigger'
import { IrisTabs, IrisTabsContent, IrisTabsList, IrisTabsTrigger } from './tabs/IrisTabs'

/**
 * `asChild` lets a consumer attach a primitive's contract to its own element
 * instead of a generated wrapper. React and Vue have shipped this on their
 * triggers since the project began; the Solid adapter had no `asChild` path at
 * all, so `<IrisButton asChild>` worked while
 * `<IrisDialogTrigger asChild>` silently ignored the prop.
 *
 * The contract pinned here: no wrapper element is emitted, the child's own
 * element type and attributes survive, parent class merges ahead of the
 * child's, the primitive's ARIA relationship lands on the child, and the
 * behaviour still fires.
 */
describe('asChild parity (Solid triggers)', () => {
  describe('IrisPopoverTrigger', () => {
    it('renders no wrapper and merges the trigger contract onto the child', () => {
      const { getByText, container } = render(() => (
        <IrisPopover>
          <IrisPopoverTrigger asChild class="parent" id="anchor">
            <a href="/docs" class="child">
              Open docs
            </a>
          </IrisPopoverTrigger>
          <IrisPopoverContent portalTarget={false}>Body</IrisPopoverContent>
        </IrisPopover>
      ))

      const trigger = getByText('Open docs') as HTMLAnchorElement
      expect(container.querySelector('button')).toBeNull()
      expect(trigger.tagName).toBe('A')
      expect(trigger.getAttribute('href')).toBe('/docs')
      expect(trigger.id).toBe('anchor')
      expect(trigger.className).toBe('parent child')
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(trigger.getAttribute('data-state')).toBe('closed')
    })

    it('still toggles the popover when the merged child is clicked', async () => {
      const { getByText } = render(() => (
        <IrisPopover>
          <IrisPopoverTrigger asChild>
            <a href="/docs">Open docs</a>
          </IrisPopoverTrigger>
          <IrisPopoverContent portalTarget={false}>Body</IrisPopoverContent>
        </IrisPopover>
      ))

      const trigger = getByText('Open docs')
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      await fireEvent.click(trigger)
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      expect(trigger.getAttribute('data-state')).toBe('open')
    })

    it("honours preventDefault from the trigger's own onClick prop", async () => {
      // Documented order (AGENTS.md): the primitive's handler runs first and a
      // preventDefault there stops the state change. The child's own handler
      // still runs afterwards via the Slot's composition.
      const triggerClick = vi.fn((event: MouseEvent) => event.preventDefault())
      const childClick = vi.fn()
      const { getByText } = render(() => (
        <IrisPopover>
          <IrisPopoverTrigger asChild onClick={triggerClick}>
            <a href="/docs" onClick={childClick}>
              Open docs
            </a>
          </IrisPopoverTrigger>
          <IrisPopoverContent portalTarget={false}>Body</IrisPopoverContent>
        </IrisPopover>
      ))

      const trigger = getByText('Open docs')
      await fireEvent.click(trigger)
      expect(triggerClick).toHaveBeenCalledTimes(1)
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
    })

    it("still runs the child's own handler alongside the primitive's", async () => {
      const childClick = vi.fn()
      const { getByText } = render(() => (
        <IrisPopover>
          <IrisPopoverTrigger asChild>
            <a href="/docs" onClick={childClick}>
              Open docs
            </a>
          </IrisPopoverTrigger>
          <IrisPopoverContent portalTarget={false}>Body</IrisPopoverContent>
        </IrisPopover>
      ))

      const trigger = getByText('Open docs')
      await fireEvent.click(trigger)
      expect(childClick).toHaveBeenCalledTimes(1)
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
    })
  })

  describe('IrisDialogTrigger', () => {
    it('renders no wrapper and opens the dialog from a custom child', async () => {
      const { getByText, container, queryByText } = render(() => (
        <IrisDialog>
          <IrisDialogTrigger asChild class="parent">
            <a href="/open" class="child">
              Open dialog
            </a>
          </IrisDialogTrigger>
          <IrisDialogContent portalTarget={false}>Body</IrisDialogContent>
        </IrisDialog>
      ))

      const trigger = getByText('Open dialog') as HTMLAnchorElement
      expect(container.querySelector('button')).toBeNull()
      expect(trigger.tagName).toBe('A')
      expect(trigger.className).toBe('parent child')
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
      expect(queryByText('Body')).toBeNull()

      await fireEvent.click(trigger)
      expect(queryByText('Body')).not.toBeNull()
    })
  })

  describe('IrisDialogClose', () => {
    it('renders no wrapper and closes the dialog from a custom child', async () => {
      // `defaultOpen` (not `open`) so the dialog is uncontrolled and can close.
      const { getByText, container, queryByText } = render(() => (
        <IrisDialog defaultOpen>
          <IrisDialogContent portalTarget={false}>
            <IrisDialogClose asChild class="parent">
              <a href="/x" class="child">
                Dismiss
              </a>
            </IrisDialogClose>
            Body
          </IrisDialogContent>
        </IrisDialog>
      ))

      const close = getByText('Dismiss') as HTMLAnchorElement
      expect(container.querySelector('button')).toBeNull()
      expect(close.tagName).toBe('A')
      expect(close.className).toBe('parent child')
      expect(queryByText('Body')).not.toBeNull()

      await fireEvent.click(close)
      expect(queryByText('Body')).toBeNull()
    })
  })

  describe('IrisDrawerTrigger / IrisDrawerClose', () => {
    it('renders no wrapper on the trigger and keeps the dialog ARIA hint', () => {
      const { getByText, container } = render(() => (
        <IrisDrawer>
          <IrisDrawerTrigger asChild class="parent">
            <a href="/drawer" class="child">
              Open drawer
            </a>
          </IrisDrawerTrigger>
          <IrisDrawerContent portalTarget={false}>Drawer body</IrisDrawerContent>
        </IrisDrawer>
      ))

      const trigger = getByText('Open drawer') as HTMLAnchorElement
      expect(container.querySelector('button')).toBeNull()
      expect(trigger.className).toBe('parent child')
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    })

    it('renders no wrapper on the close control and keeps its marker', () => {
      const { getByText, container } = render(() => (
        <IrisDrawer defaultOpen>
          <IrisDrawerContent portalTarget={false}>
            <IrisDrawerClose asChild class="parent">
              <a href="/x" class="child">
                Dismiss
              </a>
            </IrisDrawerClose>
          </IrisDrawerContent>
        </IrisDrawer>
      ))

      const close = getByText('Dismiss') as HTMLAnchorElement
      expect(container.querySelector('button')).toBeNull()
      expect(close.className).toBe('parent child')
      expect(close.getAttribute('data-iris-drawer-close')).toBe('')
    })
  })

  describe('IrisMenuTrigger', () => {
    it('renders no wrapper and carries the menu-button ARIA contract', () => {
      const { getByText, container } = render(() => (
        <IrisMenu>
          <IrisMenuTrigger asChild class="parent">
            <a href="/menu" class="child">
              Open menu
            </a>
          </IrisMenuTrigger>
          <IrisMenuContent portalTarget={false}>
            <IrisMenuItem>Copy</IrisMenuItem>
          </IrisMenuContent>
        </IrisMenu>
      ))

      const trigger = getByText('Open menu') as HTMLAnchorElement
      expect(container.querySelector('button')).toBeNull()
      expect(trigger.tagName).toBe('A')
      expect(trigger.className).toBe('parent child')
      expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(trigger.getAttribute('data-state')).toBe('closed')
    })
  })

  describe('IrisTabsTrigger', () => {
    it('renders no wrapper and keeps the full tab ARIA contract on the child', () => {
      const { getByText, container } = render(() => (
        <IrisTabs defaultValue="one">
          <IrisTabsList>
            <IrisTabsTrigger value="one" asChild class="parent">
              <a href="/one" class="child">
                One
              </a>
            </IrisTabsTrigger>
            <IrisTabsTrigger value="two">Two</IrisTabsTrigger>
          </IrisTabsList>
          <IrisTabsContent value="one">First panel</IrisTabsContent>
        </IrisTabs>
      ))

      const trigger = getByText('One') as HTMLAnchorElement
      expect(trigger.tagName).toBe('A')
      // Only the asChild trigger is wrapper-free; the default one keeps its
      // own <button>.
      expect(container.querySelectorAll('button')).toHaveLength(1)
      expect(trigger.className).toBe('parent child')
      expect(trigger.getAttribute('role')).toBe('tab')
      expect(trigger.getAttribute('aria-selected')).toBe('true')
      expect(trigger.getAttribute('data-state')).toBe('active')
      expect(trigger.getAttribute('tabindex')).toBe('0')
      expect(trigger.getAttribute('aria-controls')).toBe('iris-tabs-content-one')
    })

    it('activates the tab reactively when the merged child is clicked', async () => {
      const { getByText } = render(() => (
        <IrisTabs defaultValue="one">
          <IrisTabsList>
            <IrisTabsTrigger value="one" asChild>
              <a href="/one">One</a>
            </IrisTabsTrigger>
            <IrisTabsTrigger value="two" asChild>
              <a href="/two">Two</a>
            </IrisTabsTrigger>
          </IrisTabsList>
          <IrisTabsContent value="one">First panel</IrisTabsContent>
          <IrisTabsContent value="two">Second panel</IrisTabsContent>
        </IrisTabs>
      ))

      const one = getByText('One')
      const two = getByText('Two')
      expect(two.getAttribute('aria-selected')).toBe('false')
      await fireEvent.click(two)

      // Reactivity through IrisSlot: the previous trigger must *release*
      // aria-selected, not just the clicked one gain it. This is what breaks if
      // the asChild contract is built by reading its getters eagerly.
      expect(two.getAttribute('aria-selected')).toBe('true')
      expect(two.getAttribute('data-state')).toBe('active')
      expect(two.getAttribute('tabindex')).toBe('0')
      expect(one.getAttribute('aria-selected')).toBe('false')
      expect(one.getAttribute('tabindex')).toBe('-1')
    })

    it('emits onChange without switching when the root is controlled', async () => {
      const onChange = vi.fn()
      const { getByText } = render(() => (
        <IrisTabs value="one" onChange={onChange}>
          <IrisTabsList>
            <IrisTabsTrigger value="two" asChild>
              <a href="/two">Two</a>
            </IrisTabsTrigger>
          </IrisTabsList>
          <IrisTabsContent value="one">First panel</IrisTabsContent>
        </IrisTabs>
      ))

      const two = getByText('Two')
      await fireEvent.click(two)
      expect(onChange).toHaveBeenCalledWith('two')
      // Controlled root keeps its own value; the trigger must not self-select.
      expect(two.getAttribute('aria-selected')).toBe('false')
    })
  })

  it('leaves the default (non-asChild) rendering unchanged', () => {
    const { container } = render(() => (
      <IrisPopover>
        <IrisPopoverTrigger>Default</IrisPopoverTrigger>
        <IrisPopoverContent portalTarget={false}>Body</IrisPopoverContent>
      </IrisPopover>
    ))
    const button = container.querySelector('button')
    expect(button).not.toBeNull()
    expect(button?.getAttribute('aria-haspopup')).toBe('dialog')
    expect(button?.getAttribute('data-state')).toBe('closed')
  })
})
