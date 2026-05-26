import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisChip } from './Chip'

afterEach(() => cleanup())

describe('@iris-ui/react IrisChip', () => {
  it('renders a span by default', () => {
    const { container } = render(<IrisChip>tag</IrisChip>)
    expect(container.querySelector('[data-iris-chip]')!.tagName).toBe('SPAN')
  })

  it('clickable=true renders a button', () => {
    const { container } = render(<IrisChip clickable>tag</IrisChip>)
    expect(container.querySelector('[data-iris-chip]')!.tagName).toBe('BUTTON')
  })

  it('clickable + onClick fires', () => {
    const onClick = vi.fn()
    const { container } = render(
      <IrisChip clickable onClick={onClick}>
        tag
      </IrisChip>,
    )
    fireEvent.click(container.querySelector('[data-iris-chip]')!)
    expect(onClick).toHaveBeenCalled()
  })

  it('closable shows X button + onClose fires', () => {
    const onClose = vi.fn()
    const { container } = render(
      <IrisChip closable onClose={onClose}>
        tag
      </IrisChip>,
    )
    fireEvent.click(container.querySelector('[data-iris-chip-close]')!)
    expect(onClose).toHaveBeenCalled()
  })

  it('close click does not bubble to chip click', () => {
    const onClick = vi.fn()
    const onClose = vi.fn()
    const { container } = render(
      <IrisChip clickable closable onClick={onClick} onClose={onClose}>
        tag
      </IrisChip>,
    )
    fireEvent.click(container.querySelector('[data-iris-chip-close]')!)
    expect(onClose).toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('disabled blocks both onClick and onClose', () => {
    const onClick = vi.fn()
    const onClose = vi.fn()
    const { container } = render(
      <IrisChip clickable closable disabled onClick={onClick} onClose={onClose}>
        tag
      </IrisChip>,
    )
    fireEvent.click(container.querySelector('[data-iris-chip]')!)
    expect(onClick).not.toHaveBeenCalled()
    fireEvent.click(container.querySelector('[data-iris-chip-close]')!)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('renders icon when given', () => {
    const { container } = render(<IrisChip icon={<span>★</span>}>tag</IrisChip>)
    expect(container.querySelector('[data-iris-chip-icon]')!.textContent).toBe('★')
  })

  it('exposes data-iris-chip-{variant,tone,size}', () => {
    const { container } = render(
      <IrisChip variant="solid" tone="success" size="sm">
        x
      </IrisChip>,
    )
    const chip = container.querySelector('[data-iris-chip]')!
    expect(chip.getAttribute('data-iris-chip-variant')).toBe('solid')
    expect(chip.getAttribute('data-iris-chip-tone')).toBe('success')
    expect(chip.getAttribute('data-iris-chip-size')).toBe('sm')
  })
})
