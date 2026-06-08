import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import IrisCascader from './IrisCascader.svelte'

const options = [
  {
    label: 'Animals',
    value: 'animals',
    children: [
      { label: 'Dog', value: 'dog' },
      { label: 'Cat', value: 'cat' },
    ],
  },
  { label: 'Plants', value: 'plants', children: [{ label: 'Rose', value: 'rose' }] },
]

describe('IrisCascader', () => {
  it('renders a trigger button', () => {
    const { container } = render(IrisCascader, { props: { options } })
    expect(container.querySelector('[data-iris-cascader-trigger]')).toBeTruthy()
  })

  it('opens dropdown on click', async () => {
    const { container } = render(IrisCascader, { props: { options } })
    const trigger = container.querySelector('[data-iris-cascader-trigger]')!
    await fireEvent.click(trigger)
    flushSync()
    expect(container.querySelector('[data-iris-cascader-dropdown]')).toBeTruthy()
  })

  it('expands children on parent click', async () => {
    let changed: string[] | null = null
    const { container } = render(IrisCascader, {
      props: {
        options,
        onValueChange: (p: string[]) => {
          changed = p
        },
      },
    })
    const trigger = container.querySelector('[data-iris-cascader-trigger]')!
    await fireEvent.click(trigger)
    flushSync()
    const items = container.querySelectorAll('[data-iris-cascader-item]')
    await fireEvent.click(items[0]!) // click 'Animals' — has children
    flushSync()
    // Should show second column but not emit value yet
    const cols = container.querySelectorAll('[role="listbox"]')
    expect(cols.length).toBe(2)
    expect(changed).toBeFalsy()
  })
})
