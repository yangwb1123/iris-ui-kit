import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisTagInput from './IrisTagInput.svelte'

describe('IrisTagInput', () => {
  it('renders existing tags', () => {
    const { container } = render(IrisTagInput, { props: { value: ['alpha', 'beta'] } })
    const tags = container.querySelectorAll('[data-iris-tag-input-tag]')
    expect(tags.length).toBe(2)
  })

  it('calls onchange when Enter adds a tag', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisTagInput, { props: { value: [], onchange } })
    const input = container.querySelector('input')!
    await fireEvent.input(input, { target: { value: 'newtag' } })
    flushSync()
    await fireEvent.keyDown(input, { key: 'Enter' })
    flushSync()
    expect(onchange).toHaveBeenCalledWith(['newtag'])
  })

  it('shows remove buttons for tags', () => {
    const { container } = render(IrisTagInput, { props: { value: ['x'] } })
    expect(container.querySelector('[data-iris-tag-input-remove]')).not.toBeNull()
  })
})
