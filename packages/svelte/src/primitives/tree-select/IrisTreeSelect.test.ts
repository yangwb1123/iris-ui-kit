import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisTreeSelect from './IrisTreeSelect.svelte'

const nodes = [
  { id: 'a', label: 'Alpha' },
  {
    id: 'b',
    label: 'Beta',
    children: [
      { id: 'b1', label: 'Beta 1' },
      { id: 'b2', label: 'Beta 2' },
    ],
  },
  { id: 'c', label: 'Charlie' },
]

function triggerEl(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-tree-select-trigger]') as HTMLElement
}
function panelEl(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-tree-select-panel]')
}
function treeItems(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[role="treeitem"]'))
}

describe('IrisTreeSelect (svelte)', () => {
  it('renders trigger button', () => {
    const { container } = render(IrisTreeSelect, { props: { nodes } })
    expect(triggerEl(container)).toBeTruthy()
  })

  it('opens panel on trigger click', async () => {
    const { container } = render(IrisTreeSelect, { props: { nodes } })
    await fireEvent.click(triggerEl(container))
    flushSync()
    expect(panelEl(container)).toBeTruthy()
    expect(container.querySelector('[data-iris-tree]')).toBeTruthy()
  })

  it('ArrowDown opens the panel and Escape closes it', async () => {
    const { container } = render(IrisTreeSelect, { props: { nodes } })
    const trigger = triggerEl(container)
    await fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    flushSync()
    expect(panelEl(container)).toBeTruthy()
    await fireEvent.keyDown(trigger, { key: 'Escape' })
    flushSync()
    expect(panelEl(container)).toBeFalsy()
  })

  it('shows placeholder text when no value selected', () => {
    const { container } = render(IrisTreeSelect, {
      props: { nodes, placeholder: 'Choose…' },
    })
    expect(triggerEl(container).textContent).toMatch(/Choose/)
  })

  describe('ARIA attributes', () => {
    it('has aria-expanded and aria-haspopup on trigger', () => {
      const { container } = render(IrisTreeSelect, { props: { nodes } })
      const btn = triggerEl(container)
      expect(btn.getAttribute('aria-expanded')).toBe('false')
      expect(btn.getAttribute('aria-haspopup')).toBe('tree')
    })

    it('updates aria-expanded when opened', async () => {
      const { container } = render(IrisTreeSelect, { props: { nodes } })
      const btn = triggerEl(container)
      await fireEvent.click(btn)
      flushSync()
      expect(btn.getAttribute('aria-expanded')).toBe('true')
    })

    it('has aria-invalid when invalid', () => {
      const { container } = render(IrisTreeSelect, { props: { nodes, invalid: true } })
      expect(triggerEl(container).getAttribute('aria-invalid')).toBe('true')
    })

    it('sets data-state open/closed', async () => {
      const { container } = render(IrisTreeSelect, { props: { nodes } })
      const btn = triggerEl(container)
      expect(btn.getAttribute('data-state')).toBe('closed')
      await fireEvent.click(btn)
      flushSync()
      expect(btn.getAttribute('data-state')).toBe('open')
    })
  })

  describe('controlled mode', () => {
    it('displays selected node label', () => {
      const { container } = render(IrisTreeSelect, {
        props: { nodes, value: ['a'] },
      })
      expect(triggerEl(container).textContent).toContain('Alpha')
    })

    it('displays multiple selected labels', () => {
      const { container } = render(IrisTreeSelect, {
        props: { nodes, value: ['a', 'c'], selectionMode: 'multi' },
      })
      const text = triggerEl(container).textContent ?? ''
      expect(text).toContain('Alpha')
      expect(text).toContain('Charlie')
    })
  })

  describe('states', () => {
    it('disables the trigger when disabled', () => {
      const { container } = render(IrisTreeSelect, {
        props: { nodes, disabled: true },
      })
      const btn = triggerEl(container)
      expect(btn.hasAttribute('disabled')).toBe(true)
    })

    it('does not open panel when disabled and clicked', async () => {
      const { container } = render(IrisTreeSelect, {
        props: { nodes, disabled: true },
      })
      await fireEvent.click(triggerEl(container))
      flushSync()
      expect(panelEl(container)).toBeFalsy()
    })
  })

  describe('selection', () => {
    it('selects a leaf node and closes the panel (single mode)', async () => {
      const onValueChange = vi.fn()
      const { container } = render(IrisTreeSelect, {
        props: { nodes, onValueChange },
      })
      await fireEvent.click(triggerEl(container))
      flushSync()
      const items = treeItems(container)
      const alpha = items.find((el) => el.textContent?.includes('Alpha'))
      expect(alpha).toBeTruthy()
      if (alpha) {
        await fireEvent.click(alpha)
        flushSync()
        expect(onValueChange).toHaveBeenCalledWith(['a'])
        expect(panelEl(container)).toBeFalsy()
      }
    })

    it('keeps panel open after selection in multi mode', async () => {
      const onValueChange = vi.fn()
      const { container } = render(IrisTreeSelect, {
        props: { nodes, selectionMode: 'multi', onValueChange },
      })
      await fireEvent.click(triggerEl(container))
      flushSync()
      const items = treeItems(container)
      const alpha = items.find((el) => el.textContent?.includes('Alpha'))
      if (alpha) {
        await fireEvent.click(alpha)
        flushSync()
        expect(onValueChange).toHaveBeenCalled()
        expect(panelEl(container)).toBeTruthy() // stays open in multi mode
      }
    })
  })

  describe('tree expansion', () => {
    it('expands a parent node to show children', async () => {
      const { container } = render(IrisTreeSelect, {
        props: { nodes, selectionMode: 'multi' },
      })
      await fireEvent.click(triggerEl(container))
      flushSync()
      // Initially children not visible — no treeitem with Beta 1 text
      const hasBeta1Initially = Array.from(treeItems(container)).some((el) =>
        el.textContent?.includes('Beta 1'),
      )
      expect(hasBeta1Initially).toBe(false)
      // Click the expand button inside the parent Beta node
      const items = treeItems(container)
      const beta = items.find((el) => el.textContent?.includes('Beta'))
      expect(beta).toBeTruthy()
      if (beta) {
        const expandBtn = beta.querySelector('button')
        expect(expandBtn).toBeTruthy()
        if (expandBtn) {
          await fireEvent.click(expandBtn)
          flushSync()
          // Children should now be visible
          const allItems = treeItems(container)
          const beta1 = allItems.find((el) => el.textContent?.includes('Beta 1'))
          expect(beta1).toBeTruthy()
          expect(beta1?.textContent).toContain('Beta 1')
        }
      }
    })
  })

  describe('edge cases', () => {
    it('handles empty nodes gracefully', () => {
      const { container } = render(IrisTreeSelect, { props: { nodes: [] } })
      expect(triggerEl(container)).toBeTruthy()
    })

    it('renders without crashing with no nodes prop', () => {
      const { container } = render(IrisTreeSelect, {})
      expect(triggerEl(container)).toBeTruthy()
    })
  })
})
