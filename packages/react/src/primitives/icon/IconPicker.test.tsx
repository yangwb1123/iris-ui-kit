import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createIconRegistry } from '@iris-ui-kit/icons'
import { IrisIconPicker } from './IconPicker'

afterEach(cleanup)

const categories = [{ id: 'common', label: 'Common', iconNames: ['check', 'folder'] }] as const

describe('@iris-ui-kit/react IrisIconPicker', () => {
  it('renders searchable categorized options from the registry', () => {
    render(<IrisIconPicker iconNames={['check', 'folder', 'home']} categories={categories} />)

    expect(screen.getByRole('group', { name: 'Icon picker' })).toBeTruthy()
    expect(screen.getByRole('searchbox', { name: 'Search icons' })).toBeTruthy()
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Common' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Other' })).toBeTruthy()

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'FOLDER' } })
    expect(screen.getAllByRole('option').map((node) => node.getAttribute('aria-label'))).toEqual([
      'folder',
    ])
  })

  it('filters by category and reports an empty state', () => {
    render(<IrisIconPicker iconNames={['check', 'folder', 'home']} categories={categories} />)
    fireEvent.click(screen.getByRole('button', { name: 'Common' }))
    expect(screen.getAllByRole('option').map((node) => node.getAttribute('aria-label'))).toEqual([
      'check',
      'folder',
    ])
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing' } })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByRole('status').textContent).toBe('No icons found')
  })

  it('supports arrow-key roving focus and emits a selected semantic name', () => {
    const onValueChange = vi.fn()
    render(<IrisIconPicker iconNames={['check', 'folder']} onValueChange={onValueChange} />)
    const search = screen.getByRole('searchbox')
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    const check = screen.getByRole('option', { name: 'check' })
    expect(document.activeElement).toBe(check)
    fireEvent.keyDown(check, { key: 'ArrowRight' })
    const folder = screen.getByRole('option', { name: 'folder' })
    expect(document.activeElement).toBe(folder)
    fireEvent.click(folder)
    expect(onValueChange).toHaveBeenCalledWith('folder')
    expect(folder.getAttribute('aria-selected')).toBe('true')
  })

  it('activates and focuses adjacent categories with toolbar arrow keys', () => {
    render(<IrisIconPicker iconNames={['check', 'folder']} />)
    const all = screen.getByRole('button', { name: 'All icons' })
    fireEvent.keyDown(all, { key: 'ArrowRight' })
    const actions = screen.getByRole('button', { name: 'Actions' })
    expect(document.activeElement).toBe(actions)
    expect(actions.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByRole('option').map((node) => node.getAttribute('aria-label'))).toEqual([
      'check',
    ])
  })

  it('keeps controlled selection authoritative and accepts a custom registry', () => {
    const registry = createIconRegistry({
      icons: [{ name: 'custom', nodes: [{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 4 } }] }],
    })
    const onValueChange = vi.fn()
    render(
      <IrisIconPicker
        value="custom"
        registry={registry}
        onValueChange={onValueChange}
        label="Choose glyph"
      />,
    )
    expect(screen.getByRole('group', { name: 'Choose glyph' })).toBeTruthy()
    const option = screen.getByRole('option', { name: 'custom' })
    fireEvent.click(option)
    expect(onValueChange).toHaveBeenCalledWith('custom')
    expect(option.getAttribute('aria-selected')).toBe('true')
  })

  it('hands the last accepted controlled value back to internal state', () => {
    const iconNames = ['check', 'folder']
    const { rerender } = render(<IrisIconPicker value="check" iconNames={iconNames} />)
    rerender(<IrisIconPicker value="folder" iconNames={iconNames} />)
    rerender(<IrisIconPicker iconNames={iconNames} />)
    expect(screen.getByRole('option', { name: 'folder' }).getAttribute('aria-selected')).toBe(
      'true',
    )
  })

  it('disables search and selection controls', () => {
    render(<IrisIconPicker iconNames={['check']} disabled />)
    expect((screen.getByRole('searchbox') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('option', { name: 'check' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
