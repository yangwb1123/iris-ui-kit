import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import IrisCommandPalette from './IrisCommandPalette.svelte'

const items = [
  { id: '1', label: 'Copy', group: 'Edit' },
  { id: '2', label: 'Paste', group: 'Edit' },
  { id: '3', label: 'Open file', icon: '📄' },
]

describe('IrisCommandPalette', () => {
  it('renders nothing when closed', () => {
    const { container } = render(IrisCommandPalette, { props: { open: false, items } })
    expect(container.querySelector('[data-iris-command-palette]')).toBeFalsy()
  })

  it('renders items when open', () => {
    render(IrisCommandPalette, { props: { open: true, items } })
    // content is portalled to document.body
    expect(document.body.querySelector('[data-iris-command-palette]')).toBeTruthy()
    expect(document.body.querySelector('[data-iris-command-palette-item]')).toBeTruthy()
  })

  it('filters items on query input', async () => {
    render(IrisCommandPalette, { props: { open: true, items } })
    const input = document.body.querySelector(
      '[data-iris-command-palette-input]',
    ) as HTMLInputElement
    // Simulate typing by changing value and dispatching input
    input.value = 'cop'
    await fireEvent.input(input)
    flushSync()
    const listed = document.body.querySelectorAll('[data-iris-command-palette-item]')
    // 'Copy' matches 'cop'; 'Paste' and 'Open file' should be filtered
    expect(listed.length).toBeLessThan(items.length)
  })
})
