import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisSlot from './IrisSlot.svelte'

describe('IrisSlot', () => {
  it('renders a span wrapper by default', () => {
    const { container } = render(IrisSlot)
    expect(container.querySelector('[data-iris-slot]')).toBeTruthy()
  })
})
