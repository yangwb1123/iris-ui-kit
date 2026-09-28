import { describe, expect, it } from 'vitest'
import { getMenuSubDirection } from './menu-direction'

describe('getMenuSubDirection', () => {
  it('keeps LTR submenu placement, keys, and arrow direction', () => {
    expect(getMenuSubDirection('ltr')).toEqual({
      placement: 'right-start',
      openKey: 'ArrowRight',
      closeKey: 'ArrowLeft',
      arrow: 'right',
    })
  })

  it('flips submenu placement, keys, and arrow direction for RTL', () => {
    expect(getMenuSubDirection('rtl')).toEqual({
      placement: 'left-start',
      openKey: 'ArrowLeft',
      closeKey: 'ArrowRight',
      arrow: 'left',
    })
  })
})
