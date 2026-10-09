import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createTabsNav, type NavNode } from '@iris-ui-kit/core'
import { IrisNavMenu } from './NavMenu'
import { IrisAdminTabs } from './AdminTabs'

/**
 * Bounded chrome geometry (`size="sm" | "md" | "lg"`) — the numbers live in
 * core, these tests pin the *bridged* result: real px on the DOM, an indent
 * that survives arbitrary depth, a default that matches the pre-`size` look,
 * and a size that can change at runtime.
 */

afterEach(cleanup)

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

const navItems = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLElement>('[data-iris-nav-item]'))

const css = (el: HTMLElement, prop: string): string => el.style.getPropertyValue(prop)

const tabsEls = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('[data-iris-tab]'))

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

const deepRow = (c: HTMLElement, depth: number): HTMLElement =>
  navItems(c).find((el) => el.getAttribute('data-depth') === String(depth))!

describe('IrisNavMenu size (react)', () => {
  it('sm rows are 28px tall with 4/8 padding, an 8px gap and the sm font token', () => {
    const { container } = render(<IrisNavMenu items={items} size="sm" />)
    const row = navItems(container)[0]!
    expect(css(row, 'box-sizing')).toBe('border-box')
    expect(css(row, 'min-height')).toBe('28px')
    expect(css(row, 'padding-block')).toBe('4px')
    expect(css(row, 'padding-inline')).toBe('8px')
    expect(css(row, 'gap')).toBe('8px')
    expect(css(row, 'font-size')).toBe('var(--iris-font-size-sm, 13px)')
  })

  it('lg rows are 40px tall with 8/12 padding, a 12px gap and the lg font token', () => {
    const { container } = render(<IrisNavMenu items={items} size="lg" />)
    const row = navItems(container)[0]!
    expect(css(row, 'min-height')).toBe('40px')
    expect(css(row, 'padding-block')).toBe('8px')
    expect(css(row, 'padding-inline')).toBe('12px')
    expect(css(row, 'gap')).toBe('12px')
    expect(css(row, 'font-size')).toBe('var(--iris-font-size-lg, 16px)')
  })

  it('indents every depth (8 + depth*12 at sm, 12 + depth*16 at lg) without a 0..9 cap', () => {
    for (const [size, base, step] of [
      ['sm', 8, 12],
      ['lg', 12, 16],
    ] as const) {
      const { container, unmount } = render(
        <IrisNavMenu items={deepItems} defaultExpandedKeys={deepBranches} size={size} />,
      )
      expect(navItems(container)).toHaveLength(DEEP_LEVELS)
      // depth 10/11 sit past the old 0..9 CSS ladder — they must still indent
      for (const depth of [0, 1, 9, 10, 11]) {
        expect(css(deepRow(container, depth), 'padding-inline-start')).toBe(
          `${base + depth * step}px`,
        )
      }
      unmount()
    }
  })

  it('horizontal top-level rows carry no nested indent; vertical rows fill the width', () => {
    const horizontal = render(
      <IrisNavMenu
        items={items}
        orientation="horizontal"
        defaultExpandedKeys={['sys']}
        size="sm"
      />,
    )
    const top = navItems(horizontal.container)[0]!
    expect(css(top, 'width')).toBe('auto')
    expect(css(top, 'padding-inline-start')).toBe('8px')
    horizontal.unmount()

    const vertical = render(<IrisNavMenu items={items} size="sm" />)
    expect(css(navItems(vertical.container)[0]!, 'width')).toBe('100%')
  })

  it('defaults to md: the pre-`size` geometry and no size marker', () => {
    const { container } = render(<IrisNavMenu items={items} defaultExpandedKeys={['sys']} />)
    const root = container.querySelector('[data-iris-nav-menu]')!
    expect(root.getAttribute('data-iris-size')).toBeNull()
    const top = navItems(container)[0]!
    expect(css(top, 'min-height')).toBe('34px')
    expect(css(top, 'padding-block')).toBe('8px')
    expect(css(top, 'padding-inline')).toBe('12px')
    expect(css(top, 'gap')).toBe('12px')
    expect(css(top, 'font-size')).toBe('var(--iris-font-size-md, 14px)')
    expect(css(top, 'padding-inline-start')).toBe('12px')
    expect(css(navItems(container)[3]!, 'padding-inline-start')).toBe('28px') // depth 1
    // an explicit md is the same geometry
    const explicit = render(<IrisNavMenu items={items} size="md" />)
    const explicitTop = navItems(explicit.container)[0]!
    for (const prop of ['min-height', 'padding-block', 'padding-inline', 'gap', 'font-size']) {
      expect(css(explicitTop, prop)).toBe(css(top, prop))
    }
  })

  it('a size change re-renders the geometry in place', () => {
    const { container, rerender } = render(<IrisNavMenu items={items} size="sm" />)
    const root = container.querySelector('[data-iris-nav-menu]')!
    expect(root.getAttribute('data-iris-size')).toBe('sm')
    expect(css(navItems(container)[0]!, 'min-height')).toBe('28px')
    rerender(<IrisNavMenu items={items} size="lg" />)
    expect(root.getAttribute('data-iris-size')).toBe('lg')
    expect(css(navItems(container)[0]!, 'min-height')).toBe('40px')
    rerender(<IrisNavMenu items={items} size="sm" />)
    expect(css(navItems(container)[0]!, 'min-height')).toBe('28px')
  })

  it('collapsed rail stays centered, flat and icon-sized per tier', () => {
    const sm = render(<IrisNavMenu items={items} collapsed size="sm" />)
    const smRail = navItems(sm.container)[0]!
    expect(css(smRail, 'justify-content')).toBe('center')
    expect(css(smRail, 'padding')).toBe('8px')
    expect(css(smRail, 'padding-inline-start')).toBe('')
    expect(smRail.querySelector('svg')?.getAttribute('width')).toBe('16')
    sm.unmount()

    const lg = render(<IrisNavMenu items={items} collapsed size="lg" />)
    const lgRail = navItems(lg.container)[0]!
    expect(css(lgRail, 'padding')).toBe('16px')
    expect(lgRail.querySelector('svg')?.getAttribute('width')).toBe('24')
    lg.unmount()

    const md = render(<IrisNavMenu items={items} collapsed />)
    expect(css(navItems(md.container)[0]!, 'padding')).toBe('12px')
  })

  it('keeps logical (RTL-safe) padding and a shrinkable, ellipsising label', () => {
    const { container } = render(<IrisNavMenu items={items} size="lg" />)
    const row = navItems(container)[0]!
    // logical only — nothing physical to flip in RTL
    expect(css(row, 'padding-left')).toBe('')
    expect(css(row, 'padding-right')).toBe('')
    expect(css(row, 'padding-inline-start')).not.toBe('')
    const label = row.querySelector('span')!
    expect(css(label, 'overflow')).toBe('hidden')
    expect(css(label, 'text-overflow')).toBe('ellipsis')
    expect(css(label, 'min-width')).toBe('0')
  })

  it('sizing does not disturb selection, expansion, disabled rows or roving keys', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <IrisNavMenu
        items={[...items, { key: 'off', title: 'Off', disabled: true }]}
        onSelect={onSelect}
        size="sm"
      />,
    )
    fireEvent.click(navItems(container)[1]!) // branch → expand
    expect(container.querySelector('[data-iris-nav-children]')).not.toBeNull()
    fireEvent.click(navItems(container)[2]!) // leaf
    expect(onSelect).toHaveBeenCalledWith('users', items[1]!.children![0])
    fireEvent.click(navItems(container).at(-1)!) // disabled row
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(navItems(container).at(-1)!.disabled).toBe(true)
  })
})

describe('IrisAdminTabs size (react)', () => {
  const nav = (): ReturnType<typeof createTabsNav> => {
    const tabs = createTabsNav()
    tabs.open({ key: 'a', title: 'A' })
    return tabs
  }

  it('sm: 32px bar (gap 4, padding 4/8) and 28px chips (padding 4/8, gap 4)', () => {
    const { container } = render(<IrisAdminTabs nav={nav()} size="sm" />)
    const bar = container.querySelector('[data-iris-admin-tabs]') as HTMLElement
    expect(css(bar, 'box-sizing')).toBe('border-box')
    expect(css(bar, 'min-height')).toBe('32px')
    expect(css(bar, 'gap')).toBe('4px')
    expect(css(bar, 'padding-block')).toBe('4px')
    expect(css(bar, 'padding-inline')).toBe('8px')
    const chip = tabsEls(container)[0]!
    expect(css(chip, 'box-sizing')).toBe('border-box')
    expect(css(chip, 'min-height')).toBe('28px')
    expect(css(chip, 'padding-block')).toBe('4px')
    expect(css(chip, 'padding-inline-start')).toBe('8px')
    expect(css(chip, 'padding-inline-end')).toBe('8px')
    expect(css(chip, 'gap')).toBe('4px')
    expect(css(container.querySelector('[data-iris-tab-close]')!, 'width')).toBe('14px')
    const actions =
      container.querySelector('[data-iris-tab-actions]') ??
      container.querySelector('button[aria-haspopup="menu"]')!
    expect(css(actions, 'width')).toBe('28px')
  })

  it('lg: 48px bar (gap 8, padding 8/16) and 40px chips (padding 8/12, gap 8)', () => {
    const { container } = render(<IrisAdminTabs nav={nav()} size="lg" />)
    const bar = container.querySelector('[data-iris-admin-tabs]') as HTMLElement
    expect(css(bar, 'min-height')).toBe('48px')
    expect(css(bar, 'gap')).toBe('8px')
    expect(css(bar, 'padding-block')).toBe('8px')
    expect(css(bar, 'padding-inline')).toBe('16px')
    const chip = tabsEls(container)[0]!
    expect(css(chip, 'min-height')).toBe('40px')
    expect(css(chip, 'padding-block')).toBe('8px')
    expect(css(chip, 'padding-inline-start')).toBe('12px')
    expect(css(chip, 'padding-inline-end')).toBe('12px')
    expect(css(chip, 'gap')).toBe('8px')
    expect(css(container.querySelector('[data-iris-tab-close]')!, 'width')).toBe('16px')
    const actions = container.querySelector('button[aria-haspopup="menu"]')!
    expect(css(actions, 'width')).toBe('40px')
    expect(css(actions, 'box-sizing')).toBe('border-box')
  })

  it('defaults to md: content-driven heights, 6/12 bar padding, 6/12/8 chip padding', () => {
    const { container } = render(<IrisAdminTabs nav={nav()} />)
    const bar = container.querySelector('[data-iris-admin-tabs]') as HTMLElement
    expect(bar.getAttribute('data-iris-size')).toBeNull()
    expect(css(bar, 'min-height')).toBe('')
    expect(css(bar, 'gap')).toBe('8px')
    expect(css(bar, 'padding-block')).toBe('6px')
    expect(css(bar, 'padding-inline')).toBe('12px')
    const chip = tabsEls(container)[0]!
    expect(css(chip, 'min-height')).toBe('')
    expect(css(chip, 'padding-block')).toBe('6px')
    expect(css(chip, 'padding-inline-start')).toBe('12px')
    expect(css(chip, 'padding-inline-end')).toBe('8px')
    expect(css(chip, 'gap')).toBe('4px')
    expect(css(container.querySelector('[data-iris-tab-close]')!, 'width')).toBe('16px')
    expect(css(container.querySelector('button[aria-haspopup="menu"]')!, 'width')).toBe('28px')
  })

  it('a size change re-renders the geometry in place', () => {
    const { container, rerender } = render(<IrisAdminTabs nav={nav()} size="sm" />)
    const bar = container.querySelector('[data-iris-admin-tabs]') as HTMLElement
    expect(bar.getAttribute('data-iris-size')).toBe('sm')
    rerender(<IrisAdminTabs nav={nav()} size="lg" />)
    expect(bar.getAttribute('data-iris-size')).toBe('lg')
    expect(css(bar, 'min-height')).toBe('48px')
    expect(css(tabsEls(container)[0]!, 'min-height')).toBe('40px')
  })

  it('keeps activation / close semantics at every size', () => {
    const tabs = nav()
    tabs.open({ key: 'b', title: 'B' })
    const onClose = vi.fn()
    const { container } = render(<IrisAdminTabs nav={tabs} onClose={onClose} size="lg" />)
    fireEvent.click(container.querySelectorAll('[data-iris-tab-close]')[1]!)
    expect(tabs.getState().tabs.map((t) => t.key)).toEqual(['a'])
    expect(onClose).toHaveBeenCalledWith('b')
  })
})
