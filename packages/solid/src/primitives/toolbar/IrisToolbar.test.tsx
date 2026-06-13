import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisToolbar } from './IrisToolbar'

afterEach(cleanup)

describe('IrisToolbar', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisToolbar />)
    expect(container.querySelector('[data-iris-toolbar]')).not.toBeNull()
  })

  it('renders with role="toolbar"', () => {
    const { container } = render(() => <IrisToolbar />)
    expect(container.querySelector('[role="toolbar"]')).not.toBeNull()
  })

  it('renders children', () => {
    const { container } = render(() => (
      <IrisToolbar>
        <button type="button">Cut</button>
        <button type="button">Copy</button>
      </IrisToolbar>
    ))
    expect(container.querySelectorAll('button').length).toBe(2)
  })

  it('applies ariaLabel', () => {
    const { container } = render(() => <IrisToolbar ariaLabel="Text formatting" />)
    expect(container.querySelector('[aria-label="Text formatting"]')).not.toBeNull()
  })

  it('ArrowRight / Home / End move roving focus across items', () => {
    const { container } = render(() => (
      <IrisToolbar>
        <button type="button">A</button>
        <button type="button">B</button>
        <button type="button">C</button>
      </IrisToolbar>
    ))
    const toolbar = container.querySelector('[role="toolbar"]')!
    const [a, b, c] = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
    a!.focus()
    fireEvent.keyDown(toolbar, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(b)
    expect(b!.tabIndex).toBe(0)
    expect(a!.tabIndex).toBe(-1)
    fireEvent.keyDown(toolbar, { key: 'End' })
    expect(document.activeElement).toBe(c)
    fireEvent.keyDown(toolbar, { key: 'Home' })
    expect(document.activeElement).toBe(a)
  })
})
