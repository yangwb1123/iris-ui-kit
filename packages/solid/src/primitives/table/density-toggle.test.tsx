import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'

afterEach(cleanup)

const columns = [{ key: 'name', title: 'Name' }]
const data = [{ id: 1, name: 'Alice' }]

describe('Solid IrisTable density', () => {
  it('uses the prop on the root and invalid values fail closed', () => {
    const { container } = render(() => (
      <IrisTable columns={columns} data={data} density={'compact' as never} />
    ))
    expect(container.querySelector('[data-iris-table]')?.getAttribute('data-density')).toBe(
      'compact',
    )
    cleanup()
    const second = render(() => (
      <IrisTable columns={columns} data={data} density={'invalid' as never} />
    ))
    expect(second.container.querySelector('[data-iris-table]')?.getAttribute('data-density')).toBe(
      'comfortable',
    )
  })

  it('densityToggle opens the toolbar without a toolbar config and cycles', () => {
    const { container } = render(() => <IrisTable columns={columns} data={data} densityToggle />)
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
