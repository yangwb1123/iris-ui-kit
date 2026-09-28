import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { darkTheme } from '@iris-ui-kit/tokens'
import { applyTheme } from '@iris-ui-kit/theme'
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

  it('uses dark-theme foreground and divider tokens for the primary variant', () => {
    const applied = applyTheme(darkTheme)
    try {
      const { container } = render(() => (
        <IrisSplitButton actions={[{ key: 'a', label: 'A' }]}>Save</IrisSplitButton>
      ))
      const mainStyle =
        container.querySelector('[data-iris-split-button-main]')?.getAttribute('style') ?? ''
      const triggerStyle =
        container.querySelector('[data-iris-split-button-trigger]')?.getAttribute('style') ?? ''
      expect(mainStyle).toContain('--iris-primary-foreground')
      expect(mainStyle).not.toContain('#fff')
      expect(triggerStyle).toContain('--iris-border')
      expect(triggerStyle).not.toContain('rgba(255,255,255,0.3)')
      expect(document.documentElement.style.getPropertyValue('--iris-primary-foreground')).toBe(
        darkTheme.colors['iris.primary.foreground'],
      )
    } finally {
      applied.revert()
    }
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
