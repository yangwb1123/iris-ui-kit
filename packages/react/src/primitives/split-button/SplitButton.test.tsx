import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { darkTheme } from '@iris-ui-kit/tokens'
import { applyTheme } from '@iris-ui-kit/theme'
import { IrisSplitButton } from './SplitButton'

afterEach(() => cleanup())

const main = (c: HTMLElement) => c.querySelector('[data-iris-split-button-main]') as HTMLElement
const trigger = (c: HTMLElement) => c.querySelector('[data-iris-split-button-trigger]')
const menu = (c: HTMLElement) => c.querySelector('[data-iris-split-button-menu]')

describe('@iris-ui-kit/react IrisSplitButton', () => {
  it('renders the primary action; click fires onClick', () => {
    const onClick = vi.fn()
    const { container } = render(<IrisSplitButton onClick={onClick}>Save</IrisSplitButton>)
    expect(main(container).textContent).toBe('Save')
    fireEvent.click(main(container))
    expect(onClick).toHaveBeenCalled()
  })

  it('uses dark-theme foreground and divider tokens for the primary variant', () => {
    const applied = applyTheme(darkTheme)
    try {
      const { container } = render(
        <IrisSplitButton actions={[{ key: 'a', label: 'A' }]}>Save</IrisSplitButton>,
      )
      const mainStyle = main(container).getAttribute('style') ?? ''
      const triggerStyle = trigger(container)?.getAttribute('style') ?? ''
      expect(mainStyle).toContain('--iris-primary-foreground')
      expect(mainStyle).not.toContain('#fff')
      expect(triggerStyle).toContain('--iris-border')
      expect(triggerStyle).not.toContain('rgba(255,255,255,0.3)')
      expect(document.documentElement.style.getPropertyValue('--iris-primary-foreground')).toBe(
        darkTheme.colors['iris.primary.foreground'],
      )
    } finally {
      applied.revert()
    }
  })

  it('renders a caret when actions are provided; click toggles the menu', () => {
    const { container } = render(
      <IrisSplitButton actions={[{ key: 'a', label: 'A' }]}>Save</IrisSplitButton>,
    )
    expect(trigger(container)?.getAttribute('aria-haspopup')).toBe('menu')
    expect(menu(container)).toBeNull()
    fireEvent.click(trigger(container) as HTMLElement)
    expect(menu(container)).not.toBeNull()
    expect(trigger(container)?.getAttribute('aria-expanded')).toBe('true')
  })

  it('renders no caret without actions', () => {
    const { container } = render(<IrisSplitButton>Save</IrisSplitButton>)
    expect(trigger(container)).toBeNull()
  })

  it('selecting an action runs it and closes', () => {
    const onA = vi.fn()
    const { container } = render(
      <IrisSplitButton actions={[{ key: 'a', label: 'A', onClick: onA }]}>Save</IrisSplitButton>,
    )
    fireEvent.click(trigger(container) as HTMLElement)
    fireEvent.click(container.querySelector('[data-iris-split-button-item]')!)
    expect(onA).toHaveBeenCalled()
    expect(menu(container)).toBeNull()
  })

  it('Escape closes the menu', () => {
    const { container } = render(
      <IrisSplitButton actions={[{ key: 'a', label: 'A' }]}>Save</IrisSplitButton>,
    )
    fireEvent.click(trigger(container) as HTMLElement)
    expect(menu(container)).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(menu(container)).toBeNull()
  })

  it('disabled primary does nothing', () => {
    const onClick = vi.fn()
    const { container } = render(
      <IrisSplitButton disabled onClick={onClick}>
        Save
      </IrisSplitButton>,
    )
    fireEvent.click(main(container))
    expect(onClick).not.toHaveBeenCalled()
  })
})
