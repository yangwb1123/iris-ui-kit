import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

afterEach(cleanup)

const columns = [{ key: 'name', title: 'Name' }]
const data = [{ id: 1, name: 'Alice' }]

describe('Svelte IrisTable density', () => {
  it('uses the prop on the root and fails closed for invalid values', () => {
    const { container } = render(IrisTable, {
      props: { columns, data, density: 'compact' },
    })
    expect(container.querySelector('[data-iris-table]')?.getAttribute('data-density')).toBe(
      'compact',
    )
    cleanup()
    const second = render(IrisTable, {
      props: { columns, data, density: 'invalid' as never },
    })
    expect(second.container.querySelector('[data-iris-table]')?.getAttribute('data-density')).toBe(
      'comfortable',
    )
  })

  it('densityToggle opens the toolbar without a toolbar config and cycles', () => {
    const { container } = render(IrisTable, { props: { columns, data, densityToggle: true } })
    const root = () => container.querySelector('[data-iris-table]')
    const button = () => container.querySelector('[data-iris-density-toggle]') as HTMLElement
    expect(button()).not.toBeNull()
    expect(root()?.getAttribute('data-density')).toBe('comfortable')
    fireEvent.click(button())
    expect(root()?.getAttribute('data-density')).toBe('compact')
    fireEvent.click(button())
    expect(root()?.getAttribute('data-density')).toBe('cozy')
  })
})
