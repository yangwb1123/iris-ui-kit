import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisSplitButton } from './IrisSplitButton'

afterEach(cleanup)

const actions = [
  { key: 'edit', label: 'Edit', onClick: vi.fn() },
  { key: 'delete', label: 'Delete', onClick: vi.fn() },
]

describe('IrisSplitButton', () => {
  it('renders without crashing', () => {
    const { getByText } = render(() => <IrisSplitButton actions={actions}>Save</IrisSplitButton>)
    expect(getByText('Save')).toBeTruthy()
  })

  it('calls onClick when main button is clicked', () => {
    const onClick = vi.fn()
    const { getByText } = render(() => (
      <IrisSplitButton actions={actions} onClick={onClick}>
        Save
      </IrisSplitButton>
    ))
    fireEvent.click(getByText('Save'))
    expect(onClick).toHaveBeenCalled()
  })

  it('opens menu dropdown on caret click', () => {
    const { container, queryByRole } = render(() => (
      <IrisSplitButton actions={actions}>Save</IrisSplitButton>
    ))
    expect(queryByRole('menu')).toBeNull()
    fireEvent.click(container.querySelector('[data-iris-split-button-trigger]')!)
    expect(queryByRole('menu')).not.toBeNull()
  })

  it('calls action onClick when menu item is clicked', () => {
    const onClick = vi.fn()
    const testActions = [{ key: 'edit', label: 'Edit', onClick }]
    const { container, getByText } = render(() => (
      <IrisSplitButton actions={testActions}>Save</IrisSplitButton>
    ))
    fireEvent.click(container.querySelector('[data-iris-split-button-trigger]')!)
    fireEvent.click(getByText('Edit'))
    expect(onClick).toHaveBeenCalled()
  })
})
