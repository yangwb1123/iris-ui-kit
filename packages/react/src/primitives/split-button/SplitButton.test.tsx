import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
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
