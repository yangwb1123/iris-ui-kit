import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import IrisTransfer from './IrisTransfer.svelte'

const options = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
]

function sourceLabels(container: HTMLElement): NodeListOf<HTMLElement> {
  return container.querySelectorAll('[data-iris-transfer-source] label')
}
function targetLabels(container: HTMLElement): NodeListOf<HTMLElement> {
  return container.querySelectorAll('[data-iris-transfer-target] label')
}
function moveRightBtn(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-transfer-move-right]')
}
function moveLeftBtn(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-transfer-move-left]')
}
function sourceCheckboxes(container: HTMLElement): NodeListOf<HTMLInputElement> {
  return container.querySelectorAll('[data-iris-transfer-source] input[type="checkbox"]')
}

describe('IrisTransfer (svelte)', () => {
  it('renders source and target panes', () => {
    const { container } = render(IrisTransfer, { props: { options } })
    expect(container.querySelector('[data-iris-transfer-source]')).toBeTruthy()
    expect(container.querySelector('[data-iris-transfer-target]')).toBeTruthy()
  })

  it('shows all items in source when no value', () => {
    const { container } = render(IrisTransfer, { props: { options, value: [] } })
    expect(sourceLabels(container).length).toBe(options.length)
  })

  it('shows selected items in target pane', () => {
    const { container } = render(IrisTransfer, { props: { options, value: ['apple'] } })
    expect(targetLabels(container).length).toBe(1)
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
    const checkboxes = sourceCheckboxes(container)
    await fireEvent.click(checkboxes[1]!) // skip select-all
    flushSync()
    await fireEvent.click(moveRightBtn(container)!)
    flushSync()
    expect(changed).toBeTruthy()
    expect((changed as string[]).length).toBeGreaterThan(0)
  })

  it('search filters source pane items', async () => {
    const { container } = render(IrisTransfer, {
      props: { options, value: [], searchable: true },
    })
    const search = container.querySelector('[data-iris-transfer-search]') as HTMLInputElement
    if (search) {
      await fireEvent.input(search, { target: { value: 'App' } })
      flushSync()
      expect(sourceLabels(container).length).toBeLessThan(options.length)
    }
  })

  it('empty source renders no items', () => {
    const { container } = render(IrisTransfer, { props: { options: [], value: [] } })
    expect(sourceLabels(container).length).toBe(0)
  })

  describe('controlled mode', () => {
    it('moves items to target when value provided', () => {
      const { container } = render(IrisTransfer, {
        props: { options, value: ['apple', 'banana'] },
      })
      expect(sourceLabels(container).length).toBe(1) // only Cherry
      expect(targetLabels(container).length).toBe(2) // Apple, Banana
    })
  })

  describe('move operations', () => {
    it('moves multiple items to target', async () => {
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
      const checkboxes = sourceCheckboxes(container)
      await fireEvent.click(checkboxes[1]!) // Apple
      await fireEvent.click(checkboxes[2]!) // Banana
      flushSync()
      await fireEvent.click(moveRightBtn(container)!)
      flushSync()
      expect(changed).toContain('apple')
      expect(changed).toContain('banana')
    })

    it('moves items back from target to source', async () => {
      let changed: string[] | null = null
      const { container } = render(IrisTransfer, {
        props: {
          options,
          value: ['apple', 'banana'],
          onValueChange: (v: string[]) => {
            changed = v
          },
        },
      })
      const targetCheckboxes = container.querySelectorAll(
        '[data-iris-transfer-target] input[type="checkbox"]',
      )
      await fireEvent.click(targetCheckboxes[1]!) // select Apple in target
      flushSync()
      await fireEvent.click(moveLeftBtn(container)!)
      flushSync()
      expect(changed).toBeTruthy()
      // Apple removed from target, only Banana remains
      expect(changed).not.toContain('apple')
    })
  })

  describe('states', () => {
    it('disables move buttons when disabled', () => {
      const { container } = render(IrisTransfer, { props: { options, disabled: true } })
      expect(moveRightBtn(container)?.hasAttribute('disabled')).toBe(true)
      expect(moveLeftBtn(container)?.hasAttribute('disabled')).toBe(true)
    })

    it('has data-disabled on container', () => {
      const { container } = render(IrisTransfer, { props: { options, disabled: true } })
      const root = container.querySelector('[data-iris-transfer]')
      expect(root?.getAttribute('data-disabled')).toBe('')
    })
  })
})
