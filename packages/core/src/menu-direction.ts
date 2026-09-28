/** Physical and keyboard direction derived from the writing direction. */
export type MenuDirection = 'ltr' | 'rtl'

export interface MenuSubDirection {
  placement: 'left-start' | 'right-start'
  openKey: 'ArrowLeft' | 'ArrowRight'
  closeKey: 'ArrowLeft' | 'ArrowRight'
  arrow: 'left' | 'right'
}

/**
 * Derive the physical submenu placement, keyboard keys, and indicator direction
 * from the writing direction. Kept pure so every framework adapter shares the
 * same RTL behavior.
 */
export function getMenuSubDirection(dir: MenuDirection): MenuSubDirection {
  if (dir === 'rtl') {
    return {
      placement: 'left-start',
      openKey: 'ArrowLeft',
      closeKey: 'ArrowRight',
      arrow: 'left',
    }
  }
  return {
    placement: 'right-start',
    openKey: 'ArrowRight',
    closeKey: 'ArrowLeft',
    arrow: 'right',
  }
}
