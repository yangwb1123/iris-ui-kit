import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisSegmented from './IrisSegmented.svelte'

describe('IrisSegmented', () => {
  it('renders options', () => {
    const { container } = render(IrisSegmented, {
      props: { options: ['One', 'Two', 'Three'] },
    })
    const items = container.querySelectorAll('[data-iris-segmented-item]')
    expect(items.length).toBe(3)
  })

  it('calls onchange when an option is clicked', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisSegmented, {
      props: { options: ['One', 'Two'], onchange },
    })
    const btns = container.querySelectorAll('[data-iris-segmented-item]')
    await fireEvent.click(btns[1])
    flushSync()
    expect(onchange).toHaveBeenCalledWith('Two')
  })

  it('marks selected item with data-selected', () => {
    const { container } = render(IrisSegmented, {
      props: { options: ['One', 'Two'], value: 'Two' },
    })
    const items = container.querySelectorAll('[data-iris-segmented-item]')
    expect(items[1].getAttribute('data-selected')).toBe('true')
    expect(items[0].getAttribute('data-selected')).toBeNull()
  })
})
