import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import IrisTransfer from './IrisTransfer.svelte'

const options = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
]

describe('IrisTransfer', () => {
  it('renders source and target panes', () => {
    const { container } = render(IrisTransfer, { props: { options } })
    expect(container.querySelector('[data-iris-transfer-source]')).toBeTruthy()
    expect(container.querySelector('[data-iris-transfer-target]')).toBeTruthy()
  })

  it('shows all items in source when no value', () => {
    const { container } = render(IrisTransfer, { props: { options, value: [] } })
    const labels = container.querySelectorAll('[data-iris-transfer-source] label')
    expect(labels.length).toBe(options.length)
  })

  it('shows selected items in target pane', () => {
    const { container } = render(IrisTransfer, { props: { options, value: ['apple'] } })
    const targetLabels = container.querySelectorAll('[data-iris-transfer-target] label')
    expect(targetLabels.length).toBe(1)
  })

  it('moves items to target on button click', async () => {
    let changed: string[] | null = null
    const { container } = render(IrisTransfer, {
      props: {
        options,
        value: [],
        onValueChange: (v: string[]) => {
          changed = v
        },
      },
    })
    const checkboxes = container.querySelectorAll(
      '[data-iris-transfer-source] input[type="checkbox"]',
    )
    // skip the "select all" checkbox at index 0
    await fireEvent.click(checkboxes[1]!)
    flushSync()
    const moveBtn = container.querySelector('[data-iris-transfer-move-right]')!
    await fireEvent.click(moveBtn)
    flushSync()
    expect(changed).toBeTruthy()
    expect((changed as string[]).length).toBeGreaterThan(0)
  })
})
