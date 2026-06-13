import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisCommandPalette } from './IrisCommandPalette'

afterEach(cleanup)

const items = [
  { id: 'new', label: 'New File', group: 'File', action: vi.fn() },
  { id: 'open', label: 'Open File', group: 'File' },
  { id: 'settings', label: 'Settings', group: 'App' },
]

describe('IrisCommandPalette', () => {
  it('renders nothing when closed', () => {
    const { container } = render(() => <IrisCommandPalette items={items} />)
    expect(container.querySelector('[data-iris-command-palette]')).toBeNull()
  })

  it('renders when open=true', () => {
    const { container } = render(() => <IrisCommandPalette open items={items} />)
    expect(container.querySelector('[data-iris-command-palette]')).not.toBeNull()
  })

  it('shows all items when open with no query', () => {
    const { container } = render(() => <IrisCommandPalette open items={items} />)
    const rows = container.querySelectorAll('[data-iris-command-palette-item]')
    expect(rows.length).toBe(3)
  })

  it('calls onSelect when item clicked', () => {
    const onSelect = vi.fn()
    const { container } = render(() => (
      <IrisCommandPalette open items={items} onSelect={onSelect} />
    ))
    const row = container.querySelector('[data-iris-command-palette-item="new"]') as HTMLElement
    fireEvent.click(row)
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('ArrowDown skips disabled items and wraps at the end', () => {
    const withDisabled = [
      { id: 'a', label: 'Apple' },
      { id: 'b', label: 'Banana', disabled: true },
      { id: 'c', label: 'Cherry' },
    ]
    const onSelect = vi.fn()
    const { container } = render(() => (
      <IrisCommandPalette open items={withDisabled} onSelect={onSelect} />
    ))
    const input = container.querySelector('[data-iris-command-palette-input]') as HTMLInputElement
    // active starts on 'a'; ArrowDown must skip disabled 'b' and land on 'c'
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect.mock.calls[0][0].id).toBe('c')
    // ArrowDown again wraps back to 'a'
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect.mock.calls[1][0].id).toBe('a')
  })

  it('honors a custom filter prop', () => {
    const filter = (_q: string, item: { label: string }) => (item.label === 'Settings' ? 0 : null)
    const { container } = render(() => <IrisCommandPalette open items={items} filter={filter} />)
    const rows = container.querySelectorAll('[data-iris-command-palette-item]')
    expect(rows.length).toBe(1)
    expect(rows[0].getAttribute('data-iris-command-palette-item')).toBe('settings')
  })
})
