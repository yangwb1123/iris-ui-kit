import { describe, expect, it } from 'vitest'
import {
  ADMIN_CHROME_SIZES,
  DEFAULT_ADMIN_CHROME_SIZE,
  adminChromePx,
  adminNavChrome,
  adminNavCssVars,
  adminNavIndent,
  adminTabsChrome,
  resolveAdminChromeSize,
} from './admin-density'

describe('resolveAdminChromeSize', () => {
  it('keeps the three tiers and defaults everything else to md', () => {
    expect(ADMIN_CHROME_SIZES).toEqual(['sm', 'md', 'lg'])
    expect(DEFAULT_ADMIN_CHROME_SIZE).toBe('md')
    expect(resolveAdminChromeSize('sm')).toBe('sm')
    expect(resolveAdminChromeSize('lg')).toBe('lg')
    expect(resolveAdminChromeSize('md')).toBe('md')
    // an omitted prop, an explicit null and junk all render the default tier
    expect(resolveAdminChromeSize()).toBe('md')
    expect(resolveAdminChromeSize(undefined)).toBe('md')
    expect(resolveAdminChromeSize(null)).toBe('md')
    expect(resolveAdminChromeSize('xl' as never)).toBe('md')
  })
})

describe('adminNavChrome', () => {
  it('sm: 28px rows, 4/8 padding, 8px gap, indent 8 + depth*12, sm font token', () => {
    const sm = adminNavChrome('sm')
    expect(sm.itemMinHeight).toBe(28)
    expect(sm.paddingBlock).toBe(4)
    expect(sm.paddingInline).toBe(8)
    expect(sm.itemGap).toBe(8)
    expect(sm.indentBase).toBe(8)
    expect(sm.indentStep).toBe(12)
    expect(sm.fontSize).toBe('var(--iris-font-size-sm, 13px)')
  })

  it('lg: 40px rows, 8/12 padding, 12px gap, indent 12 + depth*16, lg font token', () => {
    const lg = adminNavChrome('lg')
    expect(lg.itemMinHeight).toBe(40)
    expect(lg.paddingBlock).toBe(8)
    expect(lg.paddingInline).toBe(12)
    expect(lg.itemGap).toBe(12)
    expect(lg.indentBase).toBe(12)
    expect(lg.indentStep).toBe(16)
    expect(lg.fontSize).toBe('var(--iris-font-size-lg, 16px)')
  })

  it('md keeps the pre-`size` nav defaults (34px floor, 8/12, gap 12, indent 12 + depth*16)', () => {
    const md = adminNavChrome()
    expect(adminNavChrome('md')).toBe(md)
    expect(md.itemMinHeight).toBe(34)
    expect(md.paddingBlock).toBe(8)
    expect(md.paddingInline).toBe(12)
    expect(md.itemGap).toBe(12)
    expect(md.indentBase).toBe(12)
    expect(md.indentStep).toBe(16)
    expect(md.fontSize).toBe('var(--iris-font-size-md, 14px)')
    expect(md.iconSize).toBe(18)
    expect(md.collapsedIconSize).toBe(20)
    expect(md.arrowSize).toBe(16)
  })

  it('orders the tiers monotonically in row height', () => {
    const heights = ADMIN_CHROME_SIZES.map((size) => adminNavChrome(size).itemMinHeight ?? 0)
    expect(heights).toEqual([28, 34, 40])
  })

  it('hands out frozen geometry (a bridge cannot mutate the shared table)', () => {
    expect(Object.isFrozen(adminNavChrome('sm'))).toBe(true)
  })
})

describe('adminNavIndent', () => {
  it('indent = base + depth*step for every depth, without a 0..9 ladder', () => {
    const sm = adminNavChrome('sm')
    expect([0, 1, 2, 9, 10, 11, 42].map((depth) => adminNavIndent(sm, depth))).toEqual([
      8, 20, 32, 116, 128, 140, 512,
    ])
    const md = adminNavChrome()
    expect([0, 1, 5, 10].map((depth) => adminNavIndent(md, depth))).toEqual([12, 28, 92, 172])
    const lg = adminNavChrome('lg')
    expect([0, 1, 3].map((depth) => adminNavIndent(lg, depth))).toEqual([12, 28, 60])
  })

  it('clamps negative / fractional / non-finite depths to the top level', () => {
    const md = adminNavChrome()
    expect(adminNavIndent(md, -3)).toBe(12)
    expect(adminNavIndent(md, 1.9)).toBe(28)
    expect(adminNavIndent(md, Number.NaN)).toBe(12)
    expect(adminNavIndent(md, Number.POSITIVE_INFINITY)).toBe(12)
  })
})

describe('adminTabsChrome', () => {
  it.each(ADMIN_CHROME_SIZES)(
    '%s keeps overflow in its scroll region, not its parent grid',
    (size) => {
      const chrome = adminTabsChrome(size)
      expect(chrome.barMinWidth).toBe(0)
      expect(chrome.scrollMinWidth).toBe(0)
    },
  )
  it('sm: 32px bar (gap 4, padding 4/8) + 28px chips (padding 4/8, gap 4, close 14, actions 28)', () => {
    const sm = adminTabsChrome('sm')
    expect(sm.barMinHeight).toBe(32)
    expect(sm.barGap).toBe(4)
    expect(sm.barPaddingBlock).toBe(4)
    expect(sm.barPaddingInline).toBe(8)
    expect(sm.chipMinHeight).toBe(28)
    expect(sm.chipPaddingBlock).toBe(4)
    expect(sm.chipPaddingInlineStart).toBe(8)
    expect(sm.chipPaddingInlineEnd).toBe(8)
    expect(sm.chipGap).toBe(4)
    expect(sm.closeSize).toBe(14)
    expect(sm.actionsSize).toBe(28)
  })

  it('lg: 48px bar (gap 8, padding 8/16) + 40px chips (padding 8/12, gap 8, close 16, actions 40)', () => {
    const lg = adminTabsChrome('lg')
    expect(lg.barMinHeight).toBe(48)
    expect(lg.barGap).toBe(8)
    expect(lg.barPaddingBlock).toBe(8)
    expect(lg.barPaddingInline).toBe(16)
    expect(lg.chipMinHeight).toBe(40)
    expect(lg.chipPaddingBlock).toBe(8)
    expect(lg.chipPaddingInlineStart).toBe(12)
    expect(lg.chipPaddingInlineEnd).toBe(12)
    expect(lg.chipGap).toBe(8)
    expect(lg.closeSize).toBe(16)
    expect(lg.actionsSize).toBe(40)
  })

  it('md keeps the pre-`size` tab defaults and stays content-driven', () => {
    const md = adminTabsChrome()
    expect(adminTabsChrome('md')).toBe(md)
    expect(md.barMinHeight).toBeNull()
    expect(md.chipMinHeight).toBeNull()
    expect(md.barGap).toBe(8)
    expect(md.barPaddingInline).toBe(12)
    expect(md.chipPaddingBlock).toBe(6)
    expect(md.chipPaddingInlineStart).toBe(12)
    expect(md.chipPaddingInlineEnd).toBe(8)
    expect(md.chipGap).toBe(4)
    expect(md.labelFontSize).toBe('var(--iris-font-size-sm, 13px)')
    expect(md.closeSize).toBe(16)
    expect(md.actionsSize).toBe(28)
    expect(Object.isFrozen(md)).toBe(true)
  })
})

describe('adminChromePx', () => {
  it('formats px lengths and maps a null min-height to "no declaration"', () => {
    expect(adminChromePx(28)).toBe('28px')
    expect(adminChromePx(0)).toBe('0px')
    expect(adminChromePx(null)).toBeUndefined()
  })
})

describe('adminNavCssVars', () => {
  it('mirrors the inline geometry as stylesheet custom properties', () => {
    expect(adminNavCssVars('sm')).toEqual({
      '--iris-nav-item-height': '28px',
      '--iris-nav-item-gap': '8px',
      '--iris-nav-item-padding-block': '4px',
      '--iris-nav-item-padding-inline': '8px',
      '--iris-nav-item-padding-collapsed': '8px',
      '--iris-nav-indent-base': '8px',
      '--iris-nav-indent-step': '12px',
      '--iris-nav-item-font-size': 'var(--iris-font-size-sm, 13px)',
      '--iris-nav-menu-gap': '2px',
    })
    expect(adminNavCssVars('lg')['--iris-nav-item-height']).toBe('40px')
    expect(adminNavCssVars()['--iris-nav-item-font-size']).toBe('var(--iris-font-size-md, 14px)')
  })

  it('agrees with the inline numbers the other adapters bridge', () => {
    const lg = adminNavChrome('lg')
    const vars = adminNavCssVars('lg')
    expect(vars['--iris-nav-item-padding-inline']).toBe(`${lg.paddingInline}px`)
    expect(vars['--iris-nav-indent-base']).toBe(`${lg.indentBase}px`)
    expect(vars['--iris-nav-indent-step']).toBe(`${lg.indentStep}px`)
  })
})
