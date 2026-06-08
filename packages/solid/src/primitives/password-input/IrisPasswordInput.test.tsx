import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisPasswordInput } from './IrisPasswordInput'

afterEach(cleanup)

describe('IrisPasswordInput', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisPasswordInput />)
    expect(container.querySelector('[data-iris-password-input]')).not.toBeNull()
  })

  it('renders as password type by default', () => {
    const { container } = render(() => <IrisPasswordInput />)
    const input = container.querySelector('input')
    expect(input?.type).toBe('password')
  })

  it('toggles visibility on button click', () => {
    const { container } = render(() => <IrisPasswordInput />)
    const input = container.querySelector('input') as HTMLInputElement
    const toggle = container.querySelector('[data-iris-password-input-toggle]') as HTMLButtonElement
    expect(input.type).toBe('password')
    fireEvent.click(toggle)
    expect(input.type).toBe('text')
    fireEvent.click(toggle)
    expect(input.type).toBe('password')
  })

  it('hides toggle when showToggle=false', () => {
    const { container } = render(() => <IrisPasswordInput showToggle={false} />)
    expect(container.querySelector('[data-iris-password-input-toggle]')).toBeNull()
  })
})
