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
})
