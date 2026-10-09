import { describe, expect, it } from 'vitest'
import {
  DIALOG_LEGACY_MAX_WIDTH,
  DIALOG_MAX_HEIGHT,
  DIALOG_SIZE_WIDTHS,
  DIALOG_VIEWPORT_CLAMP,
  normalizeLayoutLength,
  resolveGrowableControlHeight,
  resolveDialogLayout,
  resolveFormFieldLayout,
  hyphenateLayoutStyle,
  resolveToastBoxLayout,
} from './control-layout'

describe('toast box layout', () => {
  it('accounts for padding and preserves a shrinkable 280px floor without a host reset', () => {
    expect(resolveToastBoxLayout()).toEqual({
      viewport: { boxSizing: 'border-box' },
      toast: { boxSizing: 'border-box', minWidth: 'min(280px, 100%)' },
    })
    expect(hyphenateLayoutStyle(resolveToastBoxLayout().toast)).toEqual({
      'box-sizing': 'border-box',
      'min-width': 'min(280px, 100%)',
    })
  })
})

describe('growable control height', () => {
  it('retains the default floor without a fixed cap on enlarged text', () => {
    expect(resolveGrowableControlHeight(22)).toEqual({
      height: 'auto',
      minHeight: '22px',
      lineHeight: 'normal',
    })
    expect(hyphenateLayoutStyle(resolveGrowableControlHeight(22))).toEqual({
      height: 'auto',
      'min-height': '22px',
      'line-height': 'normal',
    })
    expect(resolveGrowableControlHeight(NaN).minHeight).toBeUndefined()
  })
})

describe('normalizeLayoutLength', () => {
  it('renders finite non-negative numbers as px', () => {
    expect(normalizeLayoutLength(0)).toBe('0px')
    expect(normalizeLayoutLength(120)).toBe('120px')
    expect(normalizeLayoutLength(12.5)).toBe('12.5px')
  })

  it('passes CSS length strings through (trimmed)', () => {
    expect(normalizeLayoutLength('20rem')).toBe('20rem')
    expect(normalizeLayoutLength('  50%  ')).toBe('50%')
    expect(normalizeLayoutLength('calc(100% - 8px)')).toBe('calc(100% - 8px)')
  })

  it('rejects invalid numeric dimensions', () => {
    expect(normalizeLayoutLength(Number.NaN)).toBeUndefined()
    expect(normalizeLayoutLength(Number.POSITIVE_INFINITY)).toBeUndefined()
    expect(normalizeLayoutLength(Number.NEGATIVE_INFINITY)).toBeUndefined()
    expect(normalizeLayoutLength(-1)).toBeUndefined()
    expect(normalizeLayoutLength(-0.5)).toBeUndefined()
  })

  it('rejects blank and non-length values', () => {
    expect(normalizeLayoutLength('')).toBeUndefined()
    expect(normalizeLayoutLength('   ')).toBeUndefined()
    expect(normalizeLayoutLength(undefined)).toBeUndefined()
    expect(normalizeLayoutLength(null)).toBeUndefined()
    expect(normalizeLayoutLength(true)).toBeUndefined()
    expect(normalizeLayoutLength({})).toBeUndefined()
  })
})

describe('resolveFormFieldLayout', () => {
  it('defaults to the untouched vertical field', () => {
    const layout = resolveFormFieldLayout({})
    expect(layout.placement).toBe('top')
    expect(layout.grouped).toBe(false)
    expect(layout.root).toEqual({
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    })
    expect(layout.label).toEqual({})
  })

  it('falls back to top for an unknown placement', () => {
    const layout = resolveFormFieldLayout({
      labelPlacement: 'sideways' as unknown as 'top',
    })
    expect(layout.placement).toBe('top')
    expect(layout.root.flexDirection).toBe('column')
  })

  it('makes start placement a shrinkable row that groups the control area', () => {
    const layout = resolveFormFieldLayout({ labelPlacement: 'start' })
    expect(layout.placement).toBe('start')
    expect(layout.grouped).toBe(true)
    expect(layout.root).toEqual({
      display: 'flex',
      flexDirection: 'row',
      gap: 'var(--iris-gap-md, 8px)',
      boxSizing: 'border-box',
      minWidth: '0',
      alignItems: 'flex-start',
    })
    // The label wraps and shrinks instead of pushing the control out.
    expect(layout.label).toEqual({
      flex: '0 1 auto',
      minWidth: '0',
      flexWrap: 'wrap',
      overflowWrap: 'anywhere',
    })
    // The control grows from a zero basis and can shrink to nothing.
    expect(layout.control).toEqual({
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      boxSizing: 'border-box',
      minWidth: '0',
      maxWidth: '100%',
      flex: '1 1 0',
    })
  })

  it('applies labelWidth as a shrinkable fixed label column', () => {
    const layout = resolveFormFieldLayout({ labelPlacement: 'start', labelWidth: 140 })
    expect(layout.label.width).toBe('140px')
    expect(layout.label.flex).toBe('0 1 auto')
    expect(layout.label.maxWidth).toBe('100%')
    expect(layout.label.minWidth).toBe('0')
  })

  it('keeps a horizontal control from overflowing a narrow field', () => {
    const layout = resolveFormFieldLayout({ labelPlacement: 'start', controlWidth: '20rem' })
    expect(layout.control.width).toBe('20rem')
    expect(layout.control.flex).toBe('0 1 auto')
    expect(layout.control.minWidth).toBe('0')
    expect(layout.control.maxWidth).toBe('100%')
  })

  it('fullWidth stretches the field and groups the control area', () => {
    const layout = resolveFormFieldLayout({ fullWidth: true })
    expect(layout.grouped).toBe(true)
    expect(layout.root.width).toBe('100%')
    expect(layout.root.boxSizing).toBe('border-box')
    expect(layout.control.flex).toBe('1 1 0')
    expect(layout.control.maxWidth).toBe('100%')
  })

  it('vertical controlWidth constrains the field column itself', () => {
    const layout = resolveFormFieldLayout({ controlWidth: 320 })
    expect(layout.placement).toBe('top')
    expect(layout.grouped).toBe(true)
    expect(layout.root.width).toBe('320px')
    expect(layout.root.maxWidth).toBe('100%')
    expect(layout.root.flexDirection).toBe('column')
    expect(layout.control.width).toBe('320px')
  })

  it('fullWidth wins over a vertical controlWidth', () => {
    const layout = resolveFormFieldLayout({ fullWidth: true, controlWidth: 320 })
    expect(layout.root.width).toBe('100%')
    expect(layout.control.width).toBe('320px')
  })

  it('wraps unbroken top labels when the field has a width contract', () => {
    const label = resolveFormFieldLayout({ controlWidth: '12rem' }).label
    expect(label.minWidth).toBe('0')
    expect(label.maxWidth).toBe('100%')
    expect(label.overflowWrap).toBe('anywhere')
    expect(resolveFormFieldLayout({}).label).toEqual({})
  })

  it('rejects invalid widths instead of emitting broken CSS', () => {
    const layout = resolveFormFieldLayout({
      labelPlacement: 'start',
      labelWidth: Number.NaN,
      controlWidth: -10,
    })
    expect(layout.label.width).toBeUndefined()
    expect(layout.control.width).toBeUndefined()
    // horizontal layout keeps its zero-basis growth
    expect(layout.control.flex).toBe('1 1 0')
    expect(layout.placement).toBe('start')
  })

  it('a rejected vertical control width leaves the default field untouched', () => {
    const layout = resolveFormFieldLayout({ controlWidth: Number.NaN })
    expect(layout.grouped).toBe(false)
    expect(layout.root).toEqual({ display: 'flex', flexDirection: 'column', gap: '4px' })
  })
})

describe('hyphenateLayoutStyle', () => {
  it('converts camelCase keys to CSS property names', () => {
    expect(hyphenateLayoutStyle({ flexDirection: 'row', minWidth: '0' })).toEqual({
      'flex-direction': 'row',
      'min-width': '0',
    })
  })

  it('drops undefined values and keeps custom properties verbatim', () => {
    expect(hyphenateLayoutStyle({ width: undefined, '--iris-x': '1px' })).toEqual({
      '--iris-x': '1px',
    })
  })

  it('turns a core layout into the style record Solid can assign', () => {
    const layout = resolveFormFieldLayout({ labelPlacement: 'start' })
    const solid = hyphenateLayoutStyle(layout.control)
    expect(solid['flex-direction']).toBe('column')
    expect(solid['box-sizing']).toBe('border-box')
    expect(solid['min-width']).toBe('0')
    expect(solid['max-width']).toBe('100%')
  })
})

describe('resolveDialogLayout', () => {
  it('returns the legacy sizing when no width is requested', () => {
    const layout = resolveDialogLayout({})
    expect(layout).toEqual({
      size: undefined,
      width: undefined,
      maxWidth: DIALOG_LEGACY_MAX_WIDTH,
      maxHeight: DIALOG_MAX_HEIGHT,
      sized: false,
    })
  })

  it('maps every size preset to its width', () => {
    expect(resolveDialogLayout({ size: 'sm' }).width).toBe('32rem')
    expect(resolveDialogLayout({ size: 'md' }).width).toBe('40rem')
    expect(resolveDialogLayout({ size: 'lg' }).width).toBe('50rem')
    expect(resolveDialogLayout({ size: 'xl' }).width).toBe('60rem')
    expect(Object.keys(DIALOG_SIZE_WIDTHS)).toEqual(['sm', 'md', 'lg', 'xl'])
  })

  it('clamps a sized surface to the viewport minus both backdrop gutters', () => {
    expect(resolveDialogLayout({ size: 'xl' }).maxWidth).toBe(DIALOG_VIEWPORT_CLAMP)
    expect(DIALOG_VIEWPORT_CLAMP).toBe('calc(100vw - 48px)')
    expect(resolveDialogLayout({ width: 900 }).maxWidth).toBe(DIALOG_VIEWPORT_CLAMP)
  })

  it('lets an explicit width override the preset', () => {
    const layout = resolveDialogLayout({ size: 'sm', width: '70vw' })
    expect(layout.size).toBe('sm')
    expect(layout.width).toBe('70vw')
    expect(layout.sized).toBe(true)
  })

  it('converts numeric widths to px and keeps the preset as maxHeight default', () => {
    const layout = resolveDialogLayout({ width: 720 })
    expect(layout.width).toBe('720px')
    expect(layout.maxHeight).toBe('min(85vh, calc(100vh - 48px))')
  })

  it('honors a custom maxHeight without losing the viewport gutters', () => {
    expect(resolveDialogLayout({ maxHeight: 400 }).maxHeight).toBe('min(400px, calc(100vh - 48px))')
    expect(resolveDialogLayout({ maxHeight: '60vh' }).maxHeight).toBe(
      'min(60vh, calc(100vh - 48px))',
    )
  })

  it('rejects invalid dimensions and falls back to the defaults', () => {
    const layout = resolveDialogLayout({ width: Number.NaN, maxHeight: -1 })
    expect(layout.width).toBeUndefined()
    expect(layout.sized).toBe(false)
    expect(layout.maxWidth).toBe(DIALOG_LEGACY_MAX_WIDTH)
    expect(layout.maxHeight).toBe(DIALOG_MAX_HEIGHT)
  })

  it('falls back to the preset when an invalid width is passed alongside a size', () => {
    const layout = resolveDialogLayout({ size: 'lg', width: Number.POSITIVE_INFINITY })
    expect(layout.width).toBe('50rem')
    expect(layout.maxWidth).toBe(DIALOG_VIEWPORT_CLAMP)
  })

  it.each(['toString', 'constructor', '__proto__'])(
    'does not accept inherited preset %s',
    (size) => {
      const layout = resolveDialogLayout({ size: size as 'xl' })
      expect(layout.size).toBeUndefined()
      expect(layout.width).toBeUndefined()
      expect(layout.sized).toBe(false)
    },
  )

  it('ignores an unknown size preset', () => {
    const layout = resolveDialogLayout({ size: 'xxl' as unknown as 'xl' })
    expect(layout.size).toBeUndefined()
    expect(layout.width).toBeUndefined()
    expect(layout.maxWidth).toBe(DIALOG_LEGACY_MAX_WIDTH)
  })
})
