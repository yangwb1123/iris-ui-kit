import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisChip from './IrisChip.svelte'

describe('IrisChip', () => {
  it('renders a chip span', () => {
    const { container } = render(IrisChip)
    const chip = container.querySelector('[data-iris-chip]')
    expect(chip).toBeTruthy()
    expect(chip!.tagName.toLowerCase()).toBe('span')
  })

  it('renders as button when clickable', () => {
    const { container } = render(IrisChip, { props: { clickable: true } })
    const chip = container.querySelector('[data-iris-chip]')
    expect(chip!.tagName.toLowerCase()).toBe('button')
  })

  it('calls onclose when close button is clicked', async () => {
    const onclose = vi.fn()
    const { container } = render(IrisChip, { props: { closable: true, onclose } })
    const closeBtn = container.querySelector('[data-iris-chip-close]')!
    await fireEvent.click(closeBtn)
    flushSync()
    expect(onclose).toHaveBeenCalled()
  })
})
