import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisFloatButton } from './FloatButton'

afterEach(() => cleanup())

const main = (c: HTMLElement) => c.querySelector('[data-iris-float-button]') as HTMLElement
const actionsEl = (c: HTMLElement) => c.querySelector('[data-iris-float-button-actions]')

describe('@iris-ui-kit/react IrisFloatButton', () => {
  it('renders a FAB with content and label', () => {
    const { container } = render(<IrisFloatButton ariaLabel="Add">+</IrisFloatButton>)
    expect(main(container).getAttribute('aria-label')).toBe('Add')
    expect(main(container).textContent).toBe('+')
  })

  it('plain click fires onClick (no actions)', () => {
    const onClick = vi.fn()
    const { container } = render(<IrisFloatButton ariaLabel="Add" onClick={onClick} />)
    fireEvent.click(main(container))
    expect(onClick).toHaveBeenCalled()
  })

  it('with actions, click toggles the speed-dial menu', () => {
    const { container } = render(
      <IrisFloatButton
        actions={[
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B' },
        ]}
      />,
    )
    expect(main(container).getAttribute('aria-haspopup')).toBe('menu')
    expect(main(container).getAttribute('aria-expanded')).toBe('false')
    expect(actionsEl(container)).toBeNull()
    fireEvent.click(main(container))
    expect(container.querySelectorAll('[data-iris-float-button-action]').length).toBe(2)
    expect(main(container).getAttribute('aria-expanded')).toBe('true')
  })

  it('selecting an action runs it and closes', () => {
    const onA = vi.fn()
    const { container } = render(
      <IrisFloatButton actions={[{ key: 'a', label: 'A', onClick: onA }]} />,
    )
    fireEvent.click(main(container))
    fireEvent.click(container.querySelector('[data-iris-float-button-action]')!)
    expect(onA).toHaveBeenCalled()
    expect(actionsEl(container)).toBeNull()
  })

  it('Escape closes the speed-dial', () => {
    const { container } = render(<IrisFloatButton actions={[{ key: 'a', label: 'A' }]} />)
    fireEvent.click(main(container))
    expect(actionsEl(container)).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(actionsEl(container)).toBeNull()
  })

  it('uses a localized default label for the speed-dial trigger', () => {
    const { container } = render(<IrisFloatButton actions={[{ key: 'a', label: 'A' }]} />)
    expect(main(container).getAttribute('aria-label')).toBe('Actions')
  })
})
