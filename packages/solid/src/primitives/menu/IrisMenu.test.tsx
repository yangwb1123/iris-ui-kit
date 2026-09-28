import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { createThemeStore } from '@iris-ui-kit/theme'
import { darkTheme, lightTheme } from '@iris-ui-kit/tokens'
import { ThemeProvider } from '../../theme'
import { IrisMenu } from './IrisMenu'
import { IrisMenuTrigger } from './IrisMenuTrigger'
import { IrisMenuContent } from './IrisMenuContent'
import { IrisMenuItem } from './IrisMenuItem'
import { IrisMenuSub } from './IrisMenuSub'

afterEach(cleanup)

function makeThemeStore() {
  return createThemeStore({ themes: { light: lightTheme, dark: darkTheme }, default: 'light' })
}

function nestedMenu() {
  return (
    <IrisMenu>
      <IrisMenuTrigger>Menu</IrisMenuTrigger>
      <IrisMenuContent portalTarget={false}>
        <IrisMenuItem>Item</IrisMenuItem>
        <IrisMenuSub label="More">
          <IrisMenuItem>Sub item</IrisMenuItem>
        </IrisMenuSub>
      </IrisMenuContent>
    </IrisMenu>
  )
}

describe('IrisMenu', () => {
  it('renders trigger without crashing', () => {
    const { getByText } = render(() => (
      <IrisMenu>
        <IrisMenuTrigger>Menu</IrisMenuTrigger>
        <IrisMenuContent portalTarget={false}>
          <IrisMenuItem>Item 1</IrisMenuItem>
        </IrisMenuContent>
      </IrisMenu>
    ))
    expect(getByText('Menu')).toBeTruthy()
  })

  it('shows menu content on trigger click', () => {
    const { getByText } = render(() => (
      <IrisMenu>
        <IrisMenuTrigger>Open Menu</IrisMenuTrigger>
        <IrisMenuContent portalTarget={false}>
          <IrisMenuItem>Item 1</IrisMenuItem>
          <IrisMenuItem>Item 2</IrisMenuItem>
        </IrisMenuContent>
      </IrisMenu>
    ))
    expect(document.querySelector('[role=menu]')).toBeNull()
    fireEvent.click(getByText('Open Menu'))
    expect(document.querySelector('[role=menu]')).not.toBeNull()
    expect(getByText('Item 1')).toBeTruthy()
    expect(getByText('Item 2')).toBeTruthy()
  })

  it('closes menu when IrisMenuItem is clicked', () => {
    const { getByText } = render(() => (
      <IrisMenu>
        <IrisMenuTrigger>Open</IrisMenuTrigger>
        <IrisMenuContent portalTarget={false}>
          <IrisMenuItem>Action</IrisMenuItem>
        </IrisMenuContent>
      </IrisMenu>
    ))
    fireEvent.click(getByText('Open'))
    expect(document.querySelector('[role=menu]')).not.toBeNull()
    fireEvent.click(getByText('Action'))
    expect(document.querySelector('[role=menu]')).toBeNull()
  })

  it('LTR keeps submenu placement, keys, and arrow direction', () => {
    const { getByText } = render(() => (
      <ThemeProvider store={makeThemeStore()} dir="ltr">
        {nestedMenu()}
      </ThemeProvider>
    ))
    fireEvent.click(getByText('Menu'))
    const trigger = document.querySelector('[data-iris-menu-sub-trigger]') as HTMLElement
    expect(trigger.getAttribute('data-iris-menu-sub-arrow')).toBe('right')

    fireEvent.keyDown(trigger, { key: 'ArrowRight' })
    const content = document.querySelector('[data-iris-menu-sub-content]') as HTMLElement
    expect(content.getAttribute('data-iris-menu-sub-placement')).toBe('right-start')

    fireEvent.keyDown(content, { key: 'ArrowLeft' })
    expect(document.querySelector('[data-iris-menu-sub-content]')).toBeNull()
  })

  it('RTL flips submenu placement, keys, and arrow direction', () => {
    const { getByText } = render(() => (
      <ThemeProvider store={makeThemeStore()} dir="rtl">
        {nestedMenu()}
      </ThemeProvider>
    ))
    fireEvent.click(getByText('Menu'))
    const trigger = document.querySelector('[data-iris-menu-sub-trigger]') as HTMLElement
    expect(trigger.getAttribute('data-iris-menu-sub-arrow')).toBe('left')

    fireEvent.keyDown(trigger, { key: 'ArrowLeft' })
    const content = document.querySelector('[data-iris-menu-sub-content]') as HTMLElement
    expect(content.getAttribute('data-iris-menu-sub-placement')).toBe('left-start')

    fireEvent.keyDown(content, { key: 'ArrowRight' })
    expect(document.querySelector('[data-iris-menu-sub-content]')).toBeNull()
  })
})
