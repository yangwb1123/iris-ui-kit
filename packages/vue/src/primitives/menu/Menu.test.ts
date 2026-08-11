import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisMenu } from './Menu'
import { IrisMenuTrigger } from './MenuTrigger'
import { IrisMenuContent } from './MenuContent'
import { IrisMenuItem, IrisMenuSeparator } from './MenuItem'
import { IrisMenuSub } from './MenuSub'

enableAutoUnmount(afterEach)

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const FlatHarness = defineComponent({
  setup() {
    return () =>
      h(
        IrisMenu,
        { defaultOpen: true },
        {
          default: () => [
            h(IrisMenuTrigger, null, () => 'File'),
            h(IrisMenuContent, { teleport: false }, () => [
              h(IrisMenuItem, null, () => 'New'),
              h(IrisMenuItem, null, () => 'Open'),
              h(IrisMenuSeparator),
              h(IrisMenuItem, { disabled: true }, () => 'Recents'),
            ]),
          ],
        },
      )
  },
})

const NestedHarness = defineComponent({
  setup() {
    const log: string[] = []
    return {
      log,
      render: () =>
        h(
          IrisMenu,
          { defaultOpen: true },
          {
            default: () => [
              h(IrisMenuTrigger, null, () => 'File'),
              h(IrisMenuContent, { teleport: false }, () => [
                h(IrisMenuItem, { onSelect: () => log.push('new') }, () => 'New'),
                h(IrisMenuSub, { label: 'Open Recent', teleport: false }, () => [
                  h(IrisMenuItem, { onSelect: () => log.push('a.txt') }, () => 'a.txt'),
                  h(IrisMenuItem, { onSelect: () => log.push('b.txt') }, () => 'b.txt'),
                ]),
              ]),
            ],
          },
        ),
    }
  },
  render() {
    return this.render()
  },
})

/** Root + submenu both teleported to body (the default) — the B1 repro. */
const TeleportHarness = defineComponent({
  setup() {
    const log: string[] = []
    return {
      log,
      render: () =>
        h(
          IrisMenu,
          { defaultOpen: true },
          {
            default: () => [
              h(IrisMenuTrigger, null, () => 'File'),
              h(IrisMenuContent, null, () => [
                h(IrisMenuItem, { onSelect: () => log.push('new') }, () => 'New'),
                h(IrisMenuSub, { label: 'Open Recent' }, () => [
                  h(IrisMenuItem, { onSelect: () => log.push('a.txt') }, () => 'a.txt'),
                ]),
              ]),
            ],
          },
        ),
    }
  },
  render() {
    return this.render()
  },
})

describe('IrisMenu (flat)', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  it('renders a menu with menuitems', async () => {
    const wrapper = mount(FlatHarness, { attachTo: host })
    await nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(true)
    expect(wrapper.findAll('[role="menuitem"]').length).toBe(3)
  })

  it('separator has role=separator', async () => {
    const wrapper = mount(FlatHarness, { attachTo: host })
    await nextTick()
    expect(wrapper.find('[role="separator"]').exists()).toBe(true)
  })

  it('selecting an item closes the root menu', async () => {
    const wrapper = mount(FlatHarness, { attachTo: host })
    await nextTick()
    await wrapper.findAll('[role="menuitem"]')[0]!.trigger('click')
    await nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('Escape closes the menu', async () => {
    const wrapper = mount(FlatHarness, { attachTo: host })
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('disabled item is skipped from arrow navigation (aria-disabled set)', async () => {
    const wrapper = mount(FlatHarness, { attachTo: host })
    await nextTick()
    const disabled = wrapper
      .findAll('[role="menuitem"]')
      .find((i) => i.attributes('aria-disabled') === 'true')
    expect(disabled).toBeDefined()
  })
})

describe('IrisMenu (nested with IrisMenuSub)', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  it('renders the submenu trigger inside the root menu', async () => {
    const wrapper = mount(NestedHarness, { attachTo: host })
    await nextTick()
    expect(wrapper.find('[data-iris-menu-sub-trigger]').exists()).toBe(true)
    expect(wrapper.find('[data-iris-menu-sub-trigger]').attributes('aria-haspopup')).toBe('menu')
  })

  it('submenu opens on ArrowRight from its trigger', async () => {
    const wrapper = mount(NestedHarness, { attachTo: host })
    await nextTick()
    const subTrigger = wrapper.find('[data-iris-menu-sub-trigger]')
    await subTrigger.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(document.querySelector('[data-iris-menu-sub]')).not.toBeNull()
  })

  it('submenu opens on click of its trigger', async () => {
    const wrapper = mount(NestedHarness, { attachTo: host })
    await nextTick()
    await wrapper.find('[data-iris-menu-sub-trigger]').trigger('click')
    await nextTick()
    expect(document.querySelector('[data-iris-menu-sub]')).not.toBeNull()
  })

  it('B1: pointerdown inside a teleported submenu does not dismiss the root', async () => {
    const wrapper = mount(TeleportHarness, { attachTo: host })
    await nextTick()
    const subTrigger = document.querySelector('[data-iris-menu-sub-trigger]') as HTMLElement
    subTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await nextTick()
    const sub = document.querySelector('[data-iris-menu-sub]') as HTMLElement
    expect(sub).not.toBeNull()

    const leaf = sub.querySelector('[role="menuitem"]') as HTMLElement
    // pointerdown (capture, on document) inside the teleported submenu must
    // not close the root menu before the click can reach the leaf.
    leaf.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(document.querySelector('[data-iris-menu]')).not.toBeNull()

    leaf.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(wrapper.vm.log).toContain('a.txt')
    expect(document.querySelector('[data-iris-menu]')).toBeNull()
  })

  it('B1: pointerdown on an SVG inside a teleported submenu does not dismiss the root', async () => {
    // `Element`-level exclude: SVG children of teleported items are not
    // `HTMLElement`s but must still count as inside the menu tree.
    const wrapper = mount(
      defineComponent({
        render() {
          return h(
            IrisMenu,
            { defaultOpen: true },
            {
              default: () => [
                h('button', null, 'File'),
                h(IrisMenuContent, null, () => [
                  h(IrisMenuItem, null, () => 'Save'),
                  h(IrisMenuSub, { label: 'More' }, () => [
                    h(IrisMenuItem, null, () => [
                      h('svg', { width: 10, height: 10 }, [h('path', { d: 'M0 0' })]),
                    ]),
                  ]),
                ]),
              ],
            },
          )
        },
      }),
      { attachTo: host },
    )
    await nextTick()
    const subTrigger = document.querySelector('[data-iris-menu-sub-trigger]') as HTMLElement
    subTrigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await nextTick()
    const sub = document.querySelector('[data-iris-menu-sub]') as HTMLElement
    expect(sub).not.toBeNull()

    const svg = sub.querySelector('svg') as SVGElement
    svg.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }))
    await nextTick()
    // Root content must survive — otherwise the click on the SVG item is lost.
    expect(document.querySelector('[data-iris-menu]')).not.toBeNull()
    wrapper.unmount()
  })

  it('B2: the submenu closes after the pointer leaves the trigger', async () => {
    mount(TeleportHarness, { attachTo: host })
    await nextTick()
    const subTrigger = document.querySelector('[data-iris-menu-sub-trigger]') as HTMLElement
    subTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(document.querySelector('[data-iris-menu-sub]')).not.toBeNull()

    subTrigger.dispatchEvent(new Event('pointerleave'))
    await wait(200)
    expect(document.querySelector('[data-iris-menu-sub]')).toBeNull()
  })

  it('B2: the submenu closes after the pointer leaves its content', async () => {
    mount(TeleportHarness, { attachTo: host })
    await nextTick()
    const subTrigger = document.querySelector('[data-iris-menu-sub-trigger]') as HTMLElement
    subTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await nextTick()
    const sub = document.querySelector('[data-iris-menu-sub]') as HTMLElement
    expect(sub).not.toBeNull()

    sub.dispatchEvent(new Event('pointerleave'))
    await wait(200)
    expect(document.querySelector('[data-iris-menu-sub]')).toBeNull()
  })

  it('B3: hover open does not steal focus; keyboard open focuses the first item', async () => {
    const wrapper = mount(NestedHarness, { attachTo: host })
    await nextTick()
    const subTrigger = wrapper.find('[data-iris-menu-sub-trigger]')

    // hover open — focus must stay where it is
    await subTrigger.trigger('pointerenter')
    await wait(150)
    const sub = document.querySelector('[data-iris-menu-sub]') as HTMLElement
    expect(sub).not.toBeNull()
    expect(document.activeElement?.closest('[data-iris-menu-sub]')).toBeNull()

    // close, then reopen with the keyboard — focus moves to the first item
    await subTrigger.trigger('keydown', { key: 'ArrowLeft' })
    await nextTick()
    await subTrigger.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    await wait(20)
    // re-query: the content is remounted on reopen (the old node is detached)
    const reopened = document.querySelector('[data-iris-menu-sub]') as HTMLElement
    expect(reopened.querySelector('[role="menuitem"]')).toBe(document.activeElement)
  })

  it('B4: ArrowDown on the submenu trigger opens the submenu', async () => {
    const wrapper = mount(NestedHarness, { attachTo: host })
    await nextTick()
    const subTrigger = wrapper.find('[data-iris-menu-sub-trigger]')
    await subTrigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(document.querySelector('[data-iris-menu-sub]')).not.toBeNull()
    // the root content must not have treated it as root-level navigation
    expect(document.activeElement?.closest('[data-iris-menu-sub]')).not.toBeNull()
  })

  it('B4: ArrowDown on an already-open (hover) submenu moves focus into it', async () => {
    const wrapper = mount(NestedHarness, { attachTo: host })
    await nextTick()
    const subTrigger = wrapper.find('[data-iris-menu-sub-trigger]')
    // Open by hover first — focus stays on the trigger (B3).
    await subTrigger.trigger('pointerenter')
    await wait(150)
    expect(subTrigger.attributes('data-state')).toBe('open')
    expect(document.activeElement?.closest('[data-iris-menu-sub]')).toBeNull()
    // ArrowDown on the trigger: the open-watcher won't re-fire (value
    // unchanged), so the keydown path must move focus into the content.
    await subTrigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    await wait(20)
    const sub = document.querySelector('[data-iris-menu-sub]') as HTMLElement
    expect(sub.querySelector('[role="menuitem"]')).toBe(document.activeElement)
    expect((document.activeElement as HTMLElement).textContent).toBe('a.txt')
  })

  it('B4: after keyboard-entry, a later hover reopen does not steal focus (B3)', async () => {
    const wrapper = mount(NestedHarness, { attachTo: host })
    await nextTick()
    const subTrigger = wrapper.find('[data-iris-menu-sub-trigger]')
    ;(subTrigger.element as HTMLElement).focus()

    // Keyboard entry (ArrowDown) — focus moves into the content.
    await subTrigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    await wait(20)
    expect(document.activeElement?.closest('[data-iris-menu-sub]')).not.toBeNull()

    // Close with ArrowLeft — focus returns to the trigger.
    await document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    )
    await nextTick()
    expect(document.activeElement?.getAttribute('data-iris-menu-sub-trigger')).not.toBeNull()

    // Reopen by hover: focus must stay on the trigger (B3 — pointer opens
    // never steal focus, even after a prior keyboard interaction).
    await subTrigger.trigger('pointerenter')
    await wait(150)
    expect(document.querySelector('[data-iris-menu-sub]')).not.toBeNull()
    expect(document.activeElement?.closest('[data-iris-menu-sub]')).toBeNull()
  })
})
