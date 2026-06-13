import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisTransfer } from './IrisTransfer'

afterEach(cleanup)

const options = [
  { label: 'Item A', value: 'a' },
  { label: 'Item B', value: 'b' },
  { label: 'Item C', value: 'c' },
]

describe('IrisTransfer', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisTransfer options={options} />)
    expect(container.querySelector('[data-iris-transfer]')).not.toBeNull()
  })

  it('renders source and target panels', () => {
    const { container } = render(() => <IrisTransfer options={options} />)
    expect(container.querySelector('[data-iris-transfer-panel="source"]')).not.toBeNull()
    expect(container.querySelector('[data-iris-transfer-panel="target"]')).not.toBeNull()
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
    const moveRight = container.querySelector(
      '[data-iris-transfer-move-right]',
    ) as HTMLButtonElement
    fireEvent.click(moveRight)
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
    const sourcePanel = container.querySelector('[data-iris-transfer-panel="source"]')!
    const selectAll = sourcePanel.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(selectAll).not.toBeNull()
    fireEvent.click(selectAll)
    // every source item is now aria-selected
    const opts = sourcePanel.querySelectorAll('[role="option"]')
    opts.forEach((o) => expect(o.getAttribute('aria-selected')).toBe('true'))
  })
})
