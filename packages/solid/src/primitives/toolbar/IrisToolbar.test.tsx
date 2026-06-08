import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
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
})
