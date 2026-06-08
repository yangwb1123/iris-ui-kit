import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisFloatButton } from './IrisFloatButton'

afterEach(cleanup)

describe('IrisFloatButton', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisFloatButton />)
    expect(container.querySelector('[data-iris-float-button-root]')).not.toBeNull()
  })

  it('renders main button', () => {
    const { container } = render(() => <IrisFloatButton />)
    expect(container.querySelector('[data-iris-float-button]')).not.toBeNull()
  })

  it('calls onClick when no actions', () => {
    const onClick = vi.fn()
    const { container } = render(() => <IrisFloatButton onClick={onClick} />)
    const btn = container.querySelector('[data-iris-float-button]') as HTMLButtonElement
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalled()
  })

  it('shows actions menu on click when actions provided', () => {
    const actions = [{ key: 'a', icon: '★', label: 'Star' }]
    const { container } = render(() => <IrisFloatButton actions={actions} />)
    const btn = container.querySelector('[data-iris-float-button]') as HTMLButtonElement
    fireEvent.click(btn)
    expect(container.querySelector('[data-iris-float-button-actions]')).not.toBeNull()
  })
})
