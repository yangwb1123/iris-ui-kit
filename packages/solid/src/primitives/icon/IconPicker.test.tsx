import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createIconRegistry } from '@iris-ui-kit/icons'
import { IrisIconPicker } from './IconPicker'

afterEach(cleanup)

const categories = [{ id: 'common', label: 'Common', iconNames: ['check', 'folder'] }] as const

describe('@iris-ui-kit/solid IrisIconPicker', () => {
  it('searches names and filters the categorized icon grid', () => {
    render(() => <IrisIconPicker iconNames={['check', 'folder', 'home']} categories={categories} />)
    expect(screen.getAllByRole('option')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Common' }))
    expect(screen.getAllByRole('option').map((node) => node.getAttribute('aria-label'))).toEqual([
      'check',
      'folder',
    ])
    fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'folder' } })
    expect(screen.getAllByRole('option').map((node) => node.getAttribute('aria-label'))).toEqual([
      'folder',
    ])
  })

  it('moves focus with arrows and emits the chosen name', () => {
    const onValueChange = vi.fn()
    render(() => <IrisIconPicker iconNames={['check', 'folder']} onValueChange={onValueChange} />)
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

  it('hands the latest controlled value back to internal state', () => {
    const [value, setValue] = createSignal<string | undefined>('check')
    render(() => <IrisIconPicker value={value()} iconNames={['check', 'folder']} />)
    setValue('folder')
    setValue(undefined)
    expect(screen.getByRole('option', { name: 'folder' }).getAttribute('aria-selected')).toBe(
      'true',
    )
  })

  it('supports controlled state and custom structured icon registries', () => {
    const registry = createIconRegistry({
      icons: [{ name: 'custom', nodes: [{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 4 } }] }],
    })
    render(() => <IrisIconPicker value="custom" registry={registry} label="Choose glyph" />)
    expect(screen.getByRole('group', { name: 'Choose glyph' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'custom' }).getAttribute('aria-selected')).toBe(
      'true',
    )
  })
})
