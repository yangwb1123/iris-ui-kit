import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
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

async function openDropdown(container: HTMLElement): Promise<HTMLElement> {
  const trigger = container.querySelector('[data-iris-cascader-trigger]')! as HTMLElement
  await fireEvent.click(trigger)
  flushSync()
  return trigger
}

function triggerEl(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-cascader-trigger]')! as HTMLElement
}
function dropdownEl(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-cascader-dropdown]')
}
function items(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-iris-cascader-item]'))
}

describe('IrisCascader (svelte)', () => {
  it('renders a trigger button', () => {
    const { container } = render(IrisCascader, { props: { options } })
    expect(triggerEl(container)).toBeTruthy()
  })

  it('opens dropdown on click', async () => {
    const { container } = render(IrisCascader, { props: { options } })
    expect(dropdownEl(container)).toBeFalsy()
    await openDropdown(container)
    expect(dropdownEl(container)).toBeTruthy()
  })

  it('opens on ArrowDown and closes on Escape from the trigger', async () => {
    const { container } = render(IrisCascader, { props: { options } })
    const trigger = triggerEl(container)
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    flushSync()
    expect(dropdownEl(container)).toBeTruthy()
    await fireEvent.keyDown(trigger, { key: 'Escape' })
    flushSync()
    expect(dropdownEl(container)).toBeFalsy()
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
    await openDropdown(container)
    const allItems = items(container)
    await fireEvent.click(allItems[0]!) // click 'Animals'
    flushSync()
    const cols = container.querySelectorAll('[role="listbox"]')
    expect(cols.length).toBe(2)
    expect(changed).toBeFalsy()
  })

  describe('ARIA attributes', () => {
    it('has data-state on trigger', async () => {
      const { container } = render(IrisCascader, { props: { options } })
      const trigger = triggerEl(container)
      expect(trigger.getAttribute('data-state')).toBe('closed')
      await openDropdown(container)
      expect(trigger.getAttribute('data-state')).toBe('open')
    })

    it('sets aria-expanded on trigger', async () => {
      const { container } = render(IrisCascader, { props: { options } })
      const trigger = triggerEl(container)
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      await openDropdown(container)
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
    })

    it('has aria-invalid when invalid', () => {
      const { container } = render(IrisCascader, { props: { options, invalid: true } })
      expect(triggerEl(container).getAttribute('aria-invalid')).toBe('true')
    })

    it('has data-disabled on container when disabled', () => {
      const { container } = render(IrisCascader, { props: { options, disabled: true } })
      const root = container.querySelector('[data-iris-cascader]')
      expect(root?.getAttribute('data-disabled')).toBe('')
    })
  })

  describe('selection', () => {
    it('selects a leaf node and emits onValueChange', async () => {
      const onValueChange = vi.fn()
      const { container } = render(IrisCascader, {
        props: { options, onValueChange },
      })
      await openDropdown(container)
      // Click Plants → second column, then Rose
      const plants = items(container)[1]!
      await fireEvent.click(plants)
      flushSync()
      const secondCol = container.querySelectorAll('[role="listbox"]')
      expect(secondCol.length).toBe(2)
      const rose = secondCol[1]?.querySelector('[data-iris-cascader-item]') as HTMLElement
      await fireEvent.click(rose)
      flushSync()
      expect(onValueChange).toHaveBeenCalledWith(['plants', 'rose'])
    })

    it('shows selected path on trigger', () => {
      const { container } = render(IrisCascader, {
        props: { options, value: ['animals', 'dog'] },
      })
      expect(triggerEl(container).textContent).toContain('Dog')
    })

    it('uses a controlled path updated while closed when it next opens', async () => {
      const { container, rerender } = render(IrisCascader, {
        props: { options, value: ['animals', 'dog'] },
      })
      await rerender({ options, value: ['plants', 'rose'] })
      await openDropdown(container)
      const selected = Array.from(
        container.querySelectorAll<HTMLElement>('[data-iris-cascader-item][data-state="selected"]'),
      ).map((item) => item.textContent?.trim())
      expect(selected).toEqual(expect.arrayContaining(['Plants ›', 'Rose']))
    })
  })

  describe('disabled state', () => {
    it('disables the trigger when disabled', () => {
      const { container } = render(IrisCascader, { props: { options, disabled: true } })
      expect(triggerEl(container).hasAttribute('disabled')).toBe(true)
    })

    it('does not open dropdown when disabled and clicked', async () => {
      const { container } = render(IrisCascader, { props: { options, disabled: true } })
      await fireEvent.click(triggerEl(container))
      flushSync()
      expect(dropdownEl(container)).toBeFalsy()
    })
  })

  describe('edge cases', () => {
    it('handles empty options', async () => {
      const { container } = render(IrisCascader, { props: { options: [] } })
      await openDropdown(container)
      expect(dropdownEl(container)).toBeTruthy()
    })
  })
})
