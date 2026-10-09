import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTabsNav, type NavNode } from '@iris-ui-kit/core'
import { IrisNavMenu } from './NavMenu'
import { IrisAdminTabs } from './AdminTabs'
import { __NAV_MENU_STYLE_ID, __resetNavMenuStyles } from './styles'

/**
 * Bounded chrome geometry (`size="sm" | "md" | "lg"`) — the numbers live in
 * core; this adapter bridges them as CSS custom properties into the injected
 * nav stylesheet (plus one inline indent) and inline styles on the tab bar, so
 * these tests pin the *bridged* result on the real DOM + sheet.
 */

const items: NavNode[] = [
  { key: 'dash', title: 'Dashboard', icon: 'menu' },
  {
    key: 'sys',
    title: 'System',
    icon: 'folder',
    children: [
      { key: 'users', title: 'Users' },
      { key: 'roles', title: 'Roles', badge: 3 },
    ],
  },
]

/** The singleton stylesheet the component installs (reset first so the module
 *  re-installs it, then read the text the rules actually shipped). */
const sheet = (w: { unmount(): void }): string => {
  w.unmount()
  __resetNavMenuStyles()
  const probe = mount(IrisNavMenu, { props: { items } })
  const css = document.getElementById(__NAV_MENU_STYLE_ID)?.textContent ?? ''
  probe.unmount()
  return css
}

const rows = (w: ReturnType<typeof mount>): HTMLElement[] =>
  Array.from(w.element.querySelectorAll<HTMLElement>('[data-iris-nav-item]'))

const styleOf = (w: ReturnType<typeof mount>, prop: string): string =>
  (w.element as HTMLElement).style.getPropertyValue(prop)

const varOf = (w: ReturnType<typeof mount>, name: string): string =>
  (w.element as HTMLElement).style.getPropertyValue(name)

const inlineOf = (el: HTMLElement, prop: string): string => el.style.getPropertyValue(prop)

const tabsEls = (w: ReturnType<typeof mount>): HTMLElement[] =>
  Array.from(w.element.querySelectorAll<HTMLElement>('[data-iris-tab]'))

/** A 12-level chain + every branch key, to prove the indent is unbounded. */
const DEEP_LEVELS = 12
const deepItems: NavNode[] = (() => {
  const build = (depth: number): NavNode[] => [
    depth >= DEEP_LEVELS - 1
      ? { key: `d${depth}`, title: `Level ${depth}` }
      : { key: `d${depth}`, title: `Level ${depth}`, children: build(depth + 1) },
  ]
  return build(0)
})()
const deepBranches = Array.from({ length: DEEP_LEVELS - 1 }, (_, i) => `d${i}`)

const deepRow = (w: ReturnType<typeof mount>, depth: number): HTMLElement =>
  rows(w).find((el) => el.getAttribute('data-depth') === String(depth))!

describe('IrisNavMenu size (vue)', () => {
  it('keeps legacy stylesheet defaults with scoped geometry bound by the adapter', () => {
    const css = sheet(mount(IrisNavMenu, { props: { items } }))
    expect(css).toContain('min-height: var(--iris-nav-item-height, 34px)')
    expect(css).toContain('gap: 12px')
    expect(css).toContain('padding-block: var(--iris-nav-item-padding-block, 8px)')
    expect(css).toContain('padding-inline: var(--iris-nav-item-padding-inline, 12px)')
    expect(css).toContain('font-size: var(--iris-font-size-md, 14px)')
    expect(css).toContain('gap: var(--iris-space-xxs, 4px)')
    // the old 0..9 indent ladder is gone — the indent is one inline core value
    expect(css).not.toContain("data-depth='9'")
    expect(css).not.toContain('--iris-nav-item-padding-inline-start')
  })

  it('sm injects 28px rows, 4/8 padding, an 8px gap and the sm font token', () => {
    const w = mount(IrisNavMenu, { props: { items, size: 'sm' } })
    expect(varOf(w, '--iris-nav-item-height')).toBe('28px')
    expect(varOf(w, '--iris-nav-item-padding-block')).toBe('4px')
    expect(varOf(w, '--iris-nav-item-padding-inline')).toBe('8px')
    expect(varOf(w, '--iris-nav-item-gap')).toBe('8px')
    expect(varOf(w, '--iris-nav-indent-base')).toBe('8px')
    expect(varOf(w, '--iris-nav-indent-step')).toBe('12px')
    expect(varOf(w, '--iris-nav-item-font-size')).toBe('var(--iris-font-size-sm, 13px)')
    expect(inlineOf(rows(w)[0]!, 'gap')).toBe('8px')
    expect(inlineOf(rows(w)[0]!, 'font-size')).toBe('var(--iris-font-size-sm, 13px)')
    expect(styleOf(w, 'gap')).toBe('2px')
    expect(w.attributes('data-iris-size')).toBe('sm')
    expect(rows(w)[0]!.querySelector('svg')?.getAttribute('width')).toBe('14')
  })

  it('lg injects 40px rows, 8/12 padding, a 12px gap and the lg font token', () => {
    const w = mount(IrisNavMenu, { props: { items, size: 'lg' } })
    expect(varOf(w, '--iris-nav-item-height')).toBe('40px')
    expect(varOf(w, '--iris-nav-item-padding-block')).toBe('8px')
    expect(varOf(w, '--iris-nav-item-padding-inline')).toBe('12px')
    expect(varOf(w, '--iris-nav-item-gap')).toBe('12px')
    expect(varOf(w, '--iris-nav-indent-base')).toBe('12px')
    expect(varOf(w, '--iris-nav-indent-step')).toBe('16px')
    expect(varOf(w, '--iris-nav-item-font-size')).toBe('var(--iris-font-size-lg, 16px)')
    expect(inlineOf(rows(w)[0]!, 'gap')).toBe('12px')
    expect(inlineOf(rows(w)[0]!, 'font-size')).toBe('var(--iris-font-size-lg, 16px)')
    expect(rows(w)[0]!.querySelector('svg')?.getAttribute('width')).toBe('22')
  })

  it('indents every depth (8 + depth*12 at sm, 12 + depth*16 at lg) without a 0..9 cap', () => {
    for (const [size, base, step] of [
      ['sm', 8, 12],
      ['lg', 12, 16],
    ] as const) {
      const w = mount(IrisNavMenu, {
        props: { items: deepItems, defaultExpandedKeys: deepBranches, size },
      })
      expect(rows(w)).toHaveLength(DEEP_LEVELS)
      // depth 10/11 sit past the old 0..9 CSS ladder — they must still indent
      for (const depth of [0, 1, 9, 10, 11]) {
        expect(inlineOf(deepRow(w, depth), 'padding-inline-start')).toBe(`${base + depth * step}px`)
      }
      w.unmount()
    }
  })

  it('horizontal top-level rows carry no nested indent', () => {
    const w = mount(IrisNavMenu, {
      props: { items, orientation: 'horizontal', size: 'sm', defaultExpandedKeys: ['sys'] },
    })
    for (const row of rows(w)) {
      expect(inlineOf(row, 'padding-inline-start')).toBe('')
    }
    expect(sheet(w)).toContain(
      ':where(.iris-nav-menu--horizontal > .iris-nav-menu-group > .iris-nav-menu-item)',
    )
    // the flat padding the sheet applies is the tier's inline padding
    expect(varOf(w, '--iris-nav-item-padding-inline')).toBe('8px')
  })

  it('defaults to md: no injected overrides, so the stylesheet defaults stand', () => {
    const w = mount(IrisNavMenu, { props: { items, defaultExpandedKeys: ['sys'] } })
    expect(w.attributes('data-iris-size')).toBeUndefined()
    // nothing injected → the pre-`size` CSS defaults (34px/8/12/gap 12) apply
    for (const name of [
      '--iris-nav-item-height',
      '--iris-nav-item-gap',
      '--iris-nav-item-padding-block',
      '--iris-nav-item-padding-inline',
      '--iris-nav-item-font-size',
    ]) {
      expect(varOf(w, name)).toBe('')
    }
    const css = sheet(w)
    expect(css).toContain('min-height: var(--iris-nav-item-height, 34px)')
    expect(css).toContain('gap: 12px')
    expect(css).toContain('padding-block: var(--iris-nav-item-padding-block, 8px)')
    expect(css).toContain('padding-inline: var(--iris-nav-item-padding-inline, 12px)')
    // …and the indent still comes from core: 12 + depth*16 at md
    expect(inlineOf(rows(w)[0]!, 'padding-inline-start')).toBe('12px')
    expect(inlineOf(rows(w)[3]!, 'padding-inline-start')).toBe('28px')
    // an explicit md renders the same numbers as the (uninjected) default
    const explicit = mount(IrisNavMenu, { props: { items, size: 'md' } })
    expect(varOf(explicit, '--iris-nav-item-height')).toBe('34px')
    expect(varOf(explicit, '--iris-nav-item-gap')).toBe('12px')
    expect(varOf(explicit, '--iris-nav-item-padding-block')).toBe('8px')
    expect(varOf(explicit, '--iris-nav-item-padding-inline')).toBe('12px')
    expect(varOf(explicit, '--iris-nav-indent-base')).toBe('12px')
    expect(varOf(explicit, '--iris-nav-indent-step')).toBe('16px')
    expect(inlineOf(rows(explicit)[0]!, 'padding-inline-start')).toBe('12px')
  })

  it('a size change re-renders the geometry in place', async () => {
    const w = mount(IrisNavMenu, { props: { items, size: 'sm' } })
    const root = w.element as HTMLElement
    expect(root.getAttribute('data-iris-size')).toBe('sm')
    expect(inlineOf(root, '--iris-nav-item-height')).toBe('28px')
    await w.setProps({ size: 'lg' })
    expect(root.getAttribute('data-iris-size')).toBe('lg')
    expect(inlineOf(root, '--iris-nav-item-height')).toBe('40px')
    await w.setProps({ size: 'sm' })
    expect(inlineOf(root, '--iris-nav-item-height')).toBe('28px')
  })

  it('updates orientation and collapsed chrome classes without remounting', async () => {
    const w = mount(IrisNavMenu, { props: { items, size: 'sm' } })
    const root = w.element
    await w.setProps({ collapsed: true })
    expect(w.element).toBe(root)
    expect(w.classes()).toContain('iris-nav-menu--collapsed')
    expect(w.classes()).not.toContain('iris-nav-menu--expanded')
    await w.setProps({ collapsed: false, orientation: 'horizontal' })
    expect(w.classes()).toContain('iris-nav-menu--horizontal')
    expect(w.classes()).toContain('iris-nav-menu--expanded')
    expect(w.classes()).not.toContain('iris-nav-menu--vertical')
  })

  it('collapsed rail stays flat and centered (no inline indent)', () => {
    const w = mount(IrisNavMenu, { props: { items, collapsed: true, size: 'lg' } })
    for (const row of rows(w)) {
      expect(inlineOf(row, 'padding-inline-start')).toBe('')
    }
    expect(varOf(w, '--iris-nav-item-padding-collapsed')).toBe('16px')
    expect(inlineOf(rows(w)[0]!, 'padding-inline')).toBe('16px')
    expect(sheet(w)).toContain('padding-inline: var(--iris-nav-item-padding-inline)')
    expect(rows(w)[0]!.querySelector('svg')?.getAttribute('width')).toBe('24')
  })

  it('keeps logical (RTL-safe) padding and a shrinkable, ellipsising label', () => {
    const w = mount(IrisNavMenu, { props: { items, size: 'lg' } })
    const row = rows(w)[0]!
    expect(inlineOf(row, 'padding-left')).toBe('')
    expect(inlineOf(row, 'padding-right')).toBe('')
    expect(inlineOf(row, 'padding-inline-start')).not.toBe('')
    const label = row.querySelector('.iris-nav-menu-label') as HTMLElement
    expect(label).not.toBeNull()
    expect(sheet(w)).toContain(':where(.iris-nav-menu-label)')
    expect(sheet(w)).toContain('text-overflow: ellipsis')
  })

  it('an explicit caller style still wins over the injected tier', async () => {
    const w = mount(IrisNavMenu, {
      props: { items, size: 'sm' },
      attrs: { style: { '--iris-nav-item-height': '44px' } },
    })
    expect(inlineOf(w.element as HTMLElement, '--iris-nav-item-height')).toBe('44px')
    expect(inlineOf(w.element as HTMLElement, '--iris-nav-item-gap')).toBe('8px')
    await w.setProps({ size: 'lg' })
    // the explicit override survives the tier change
    expect(inlineOf(w.element as HTMLElement, '--iris-nav-item-height')).toBe('44px')
    expect(inlineOf(w.element as HTMLElement, '--iris-nav-item-gap')).toBe('12px')
  })

  it('sizing does not disturb selection, expansion or the flyout rail', async () => {
    const onSelect = vi.fn()
    const w = mount(IrisNavMenu, {
      props: {
        items: [...items, { key: 'off', title: 'Off', disabled: true }],
        onSelect,
        size: 'sm',
      },
    })
    await rows(w)[1]!.click()
    expect(w.find('[data-iris-nav-children]').attributes('aria-hidden')).toBeUndefined()
    await rows(w)[2]!.click()
    expect(onSelect).toHaveBeenCalledWith('users', items[1]!.children![0])
    await rows(w).at(-1)!.click()
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(rows(w).at(-1)!.disabled).toBe(true)
  })
})

describe('IrisAdminTabs size (vue)', () => {
  const nav = (): ReturnType<typeof createTabsNav> => {
    const tabs = createTabsNav()
    tabs.open({ key: 'a', title: 'A' })
    return tabs
  }

  it('sm: 32px bar (gap 4, padding 4/8) and 28px chips (padding 4/8, gap 4)', () => {
    const w = mount(IrisAdminTabs, { props: { nav: nav(), size: 'sm' } })
    expect(styleOf(w, 'box-sizing')).toBe('border-box')
    expect(styleOf(w, 'min-height')).toBe('32px')
    expect(styleOf(w, 'gap')).toBe('4px')
    expect(styleOf(w, 'padding-block')).toBe('4px')
    expect(styleOf(w, 'padding-inline')).toBe('8px')
    const chip = tabsEls(w)[0]!
    expect(inlineOf(chip, 'box-sizing')).toBe('border-box')
    expect(inlineOf(chip, 'min-height')).toBe('28px')
    expect(inlineOf(chip, 'padding-block')).toBe('4px')
    expect(inlineOf(chip, 'padding-inline-start')).toBe('8px')
    expect(inlineOf(chip, 'padding-inline-end')).toBe('8px')
    expect(inlineOf(chip, 'gap')).toBe('4px')
    expect(inlineOf(w.element.querySelector('[data-iris-tab-close]') as HTMLElement, 'width')).toBe(
      '14px',
    )
    expect(
      inlineOf(w.element.querySelector('[data-iris-tab-actions]') as HTMLElement, 'width'),
    ).toBe('28px')
  })

  it('lg: 48px bar (gap 8, padding 8/16) and 40px chips (padding 8/12, gap 8)', () => {
    const w = mount(IrisAdminTabs, { props: { nav: nav(), size: 'lg' } })
    expect(styleOf(w, 'min-height')).toBe('48px')
    expect(styleOf(w, 'gap')).toBe('8px')
    expect(styleOf(w, 'padding-block')).toBe('8px')
    expect(styleOf(w, 'padding-inline')).toBe('16px')
    const chip = tabsEls(w)[0]!
    expect(inlineOf(chip, 'min-height')).toBe('40px')
    expect(inlineOf(chip, 'padding-block')).toBe('8px')
    expect(inlineOf(chip, 'padding-inline-start')).toBe('12px')
    expect(inlineOf(chip, 'padding-inline-end')).toBe('12px')
    expect(inlineOf(chip, 'gap')).toBe('8px')
    expect(inlineOf(w.element.querySelector('[data-iris-tab-close]') as HTMLElement, 'width')).toBe(
      '16px',
    )
    const actions = w.element.querySelector('[data-iris-tab-actions]') as HTMLElement
    expect(inlineOf(actions, 'width')).toBe('40px')
    expect(inlineOf(actions, 'box-sizing')).toBe('border-box')
  })

  it('defaults to md: content-driven heights, 6/12 bar padding, 6/12/8 chip padding', () => {
    const w = mount(IrisAdminTabs, { props: { nav: nav() } })
    expect(w.attributes('data-iris-size')).toBeUndefined()
    expect(styleOf(w, 'min-height')).toBe('')
    expect(styleOf(w, 'gap')).toBe('8px')
    expect(styleOf(w, 'padding-block')).toBe('6px')
    expect(styleOf(w, 'padding-inline')).toBe('12px')
    const chip = tabsEls(w)[0]!
    expect(inlineOf(chip, 'min-height')).toBe('')
    expect(inlineOf(chip, 'padding-block')).toBe('6px')
    expect(inlineOf(chip, 'padding-inline-start')).toBe('12px')
    expect(inlineOf(chip, 'padding-inline-end')).toBe('8px')
    expect(inlineOf(chip, 'gap')).toBe('4px')
    expect(inlineOf(w.element.querySelector('[data-iris-tab-close]') as HTMLElement, 'width')).toBe(
      '16px',
    )
    expect(
      inlineOf(w.element.querySelector('[data-iris-tab-actions]') as HTMLElement, 'width'),
    ).toBe('28px')
  })

  it('a size change re-renders the geometry in place', async () => {
    const w = mount(IrisAdminTabs, { props: { nav: nav(), size: 'sm' } })
    const bar = w.element as HTMLElement
    expect(bar.getAttribute('data-iris-size')).toBe('sm')
    await w.setProps({ size: 'lg' })
    expect(bar.getAttribute('data-iris-size')).toBe('lg')
    expect(inlineOf(bar, 'min-height')).toBe('48px')
    expect(inlineOf(tabsEls(w)[0]!, 'min-height')).toBe('40px')
  })

  it('an explicit caller style still wins over the tier geometry', async () => {
    const w = mount(IrisAdminTabs, {
      props: { nav: nav(), size: 'sm' },
      attrs: { style: { minHeight: '60px', gap: '20px' } },
    })
    expect(styleOf(w, 'min-height')).toBe('60px')
    expect(styleOf(w, 'gap')).toBe('20px')
    await w.setProps({ size: 'lg' })
    expect(styleOf(w, 'min-height')).toBe('60px')
    expect(inlineOf(tabsEls(w)[0]!, 'min-height')).toBe('40px')
  })

  it('keeps activation / close semantics at every size', async () => {
    const tabs = nav()
    tabs.open({ key: 'b', title: 'B' })
    const onClose = vi.fn()
    const w = mount(IrisAdminTabs, { props: { nav: tabs, onClose, size: 'lg' } })
    await w.findAll('[data-iris-tab-close]')[1]!.trigger('click')
    expect(tabs.getState().tabs.map((t) => t.key)).toEqual(['a'])
    expect(onClose).toHaveBeenCalledWith('b')
  })
})
