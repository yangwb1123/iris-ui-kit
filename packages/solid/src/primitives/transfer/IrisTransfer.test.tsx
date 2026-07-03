import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisTransfer } from './IrisTransfer'

afterEach(cleanup)

const options = [
  { label: 'Item A', value: 'a' },
  { label: 'Item B', value: 'b' },
  { label: 'Item C', value: 'c' },
  { label: 'Item D', value: 'd' },
]

function sourcePanel(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-transfer-panel="source"]') as HTMLElement
}
function targetPanel(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-transfer-panel="target"]') as HTMLElement
}
function moveRightBtn(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('[data-iris-transfer-move-right]') as HTMLButtonElement
}

describe('IrisTransfer', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisTransfer options={options} />)
    expect(container.querySelector('[data-iris-transfer]')).not.toBeNull()
  })

  it('renders source and target panels', () => {
    const { container } = render(() => <IrisTransfer options={options} />)
    expect(sourcePanel(container)).not.toBeNull()
    expect(targetPanel(container)).not.toBeNull()
  })

  it('shows source items', () => {
    const { getByText } = render(() => <IrisTransfer options={options} />)
    expect(getByText('Item A')).not.toBeNull()
    expect(getByText('Item B')).not.toBeNull()
  })

  it('moves item to target when checked and arrow clicked', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisTransfer options={options} onChange={onChange} />)
    const itemA = container.querySelector('[data-iris-transfer-item="source-a"]') as HTMLElement
    fireEvent.click(itemA)
    fireEvent.click(moveRightBtn(container))
    expect(onChange).toHaveBeenCalledWith(['a'])
  })

  it('move buttons have an accessible name (aria-label)', () => {
    const { container } = render(() => <IrisTransfer options={options} />)
    const moveRight = container.querySelector('[data-iris-transfer-move-right]')!
    const moveLeft = container.querySelector('[data-iris-transfer-move-left]')!
    expect(moveRight.getAttribute('aria-label')).toBeTruthy()
    expect(moveLeft.getAttribute('aria-label')).toBeTruthy()
  })

  it('select-all checkbox checks every eligible item in the pane', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisTransfer options={options} onChange={onChange} />)
    const panel = sourcePanel(container)
    const selectAll = panel.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(selectAll).not.toBeNull()
    fireEvent.click(selectAll)
    const opts = panel.querySelectorAll('[role="option"]')
    opts.forEach((o) => expect(o.getAttribute('aria-selected')).toBe('true'))
  })

  describe('controlled mode', () => {
    it('shows target items in the target panel', () => {
      const { container } = render(() => <IrisTransfer options={options} value={['a', 'c']} />)
      // Source panel should NOT have items a and c
      const sourceOpts = sourcePanel(container).querySelectorAll('[role="option"]')
      const sourceLabels = Array.from(sourceOpts).map((o) => o.textContent ?? '')
      expect(sourceLabels).not.toContain('Item A')
      expect(sourceLabels).not.toContain('Item C')
      // Target panel should have them
      const targetOpts = targetPanel(container).querySelectorAll('[role="option"]')
      const targetLabels = Array.from(targetOpts).map((o) => o.textContent ?? '')
      expect(targetLabels).toContain('Item A')
      expect(targetLabels).toContain('Item C')
    })
  })

  describe('move operations', () => {
    it('moves one item from source to target', () => {
      const onChange = vi.fn()
      const { container } = render(() => <IrisTransfer options={options} onChange={onChange} />)
      const itemA = container.querySelector('[data-iris-transfer-item="source-a"]') as HTMLElement
      fireEvent.click(itemA)
      fireEvent.click(moveRightBtn(container))
      expect(onChange).toHaveBeenCalledWith(['a'])
    })

    it('moves multiple selected items to target', () => {
      const onChange = vi.fn()
      const { container } = render(() => <IrisTransfer options={options} onChange={onChange} />)
      const itemA = container.querySelector('[data-iris-transfer-item="source-a"]') as HTMLElement
      const itemB = container.querySelector('[data-iris-transfer-item="source-b"]') as HTMLElement
      fireEvent.click(itemA)
      fireEvent.click(itemB)
      fireEvent.click(moveRightBtn(container))
      expect(onChange).toHaveBeenCalledWith(['a', 'b'])
    })

    it('source items decrease after move to target', () => {
      const { container } = render(() => <IrisTransfer options={options} value={['a', 'b']} />)
      const sourceOpts = sourcePanel(container).querySelectorAll('[role="option"]')
      expect(sourceOpts.length).toBe(2) // C and D remain
      const targetOpts = targetPanel(container).querySelectorAll('[role="option"]')
      expect(targetOpts.length).toBe(2) // A and B moved
    })
  })

  describe('disabled state', () => {
    it('disables move buttons when disabled', () => {
      const { container } = render(() => <IrisTransfer options={options} disabled />)
      expect(moveRightBtn(container).hasAttribute('disabled')).toBe(true)
    })

    it('sets data-disabled on container', () => {
      const { container } = render(() => <IrisTransfer options={options} disabled />)
      const el = container.querySelector('[data-iris-transfer]')
      expect(el?.getAttribute('data-disabled')).toBe('')
    })
  })

  describe('edge cases', () => {
    it('handles empty options', () => {
      const { container } = render(() => <IrisTransfer options={[]} />)
      expect(sourcePanel(container)).not.toBeNull()
      expect(targetPanel(container)).not.toBeNull()
    })

    it('does not crash with no options prop', () => {
      const { container } = render(() => <IrisTransfer />)
      expect(container.querySelector('[data-iris-transfer]')).not.toBeNull()
    })
  })
})
