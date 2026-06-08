import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisChip } from './IrisChip'

afterEach(cleanup)

describe('IrisChip', () => {
  it('renders chip with label', () => {
    const { getByText, container } = render(() => <IrisChip>React</IrisChip>)
    expect(getByText('React')).toBeTruthy()
    expect(container.querySelector('[data-iris-chip]')).not.toBeNull()
  })

  it('renders close button when closable=true', () => {
    const { container } = render(() => <IrisChip closable>Tag</IrisChip>)
    expect(container.querySelector('[data-iris-chip-close]')).not.toBeNull()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    const { container } = render(() => (
      <IrisChip closable onClose={onClose}>
        Tag
      </IrisChip>
    ))
    const closeBtn = container.querySelector('[data-iris-chip-close]') as HTMLButtonElement
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('renders as button when clickable=true', () => {
    const { container } = render(() => <IrisChip clickable>Click Me</IrisChip>)
    const chip = container.querySelector('[data-iris-chip]')!
    expect(chip.tagName.toLowerCase()).toBe('button')
  })

  it('renders as span when not clickable', () => {
    const { container } = render(() => <IrisChip>Label</IrisChip>)
    const chip = container.querySelector('[data-iris-chip]')!
    expect(chip.tagName.toLowerCase()).toBe('span')
  })

  it('applies tone data attribute', () => {
    const { container } = render(() => <IrisChip tone="success">OK</IrisChip>)
    expect(container.querySelector('[data-iris-chip-tone="success"]')).not.toBeNull()
  })
})
