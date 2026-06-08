import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import IrisPasswordInput from './IrisPasswordInput.svelte'

describe('IrisPasswordInput', () => {
  it('renders password input by default', () => {
    const { container } = render(IrisPasswordInput)
    expect(container.querySelector('input')!.type).toBe('password')
  })

  it('shows toggle button by default', () => {
    const { container } = render(IrisPasswordInput)
    expect(container.querySelector('[data-iris-password-input-toggle]')).not.toBeNull()
  })

  it('toggles to text type when toggle clicked', async () => {
    const { container } = render(IrisPasswordInput)
    const toggle = container.querySelector('[data-iris-password-input-toggle]') as HTMLButtonElement
    await fireEvent.click(toggle)
    flushSync()
    expect(container.querySelector('input')!.type).toBe('text')
  })

  it('hides toggle when showToggle=false', () => {
    const { container } = render(IrisPasswordInput, { props: { showToggle: false } })
    expect(container.querySelector('[data-iris-password-input-toggle]')).toBeNull()
  })
})
