import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisSlot } from './IrisSlot'

afterEach(cleanup)

describe('IrisSlot', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisSlot>
        <span>child</span>
      </IrisSlot>
    ))
    expect(container.querySelector('[data-iris-slot]')).not.toBeNull()
  })

  it('renders children', () => {
    const { getByText } = render(() => (
      <IrisSlot>
        <span>hello</span>
      </IrisSlot>
    ))
    expect(getByText('hello')).not.toBeNull()
  })
})
