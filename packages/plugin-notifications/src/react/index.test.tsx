import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createNotificationCenter } from '../core'
import { IrisNotificationCenter } from './index'

afterEach(cleanup)

describe('IrisNotificationCenter (react)', () => {
  it('renders items + unread badge, marks read on click, dismisses', () => {
    const center = createNotificationCenter()
    center.push({ title: 'First' })
    center.push({ title: 'Second' })
    const { container } = render(<IrisNotificationCenter center={center} />)

    expect(container.querySelectorAll('[data-iris-notification]')).toHaveLength(2)
    expect(container.querySelector('[data-iris-notifications-badge]')!.textContent).toBe('2')

    // click the first item's body → marks read → badge drops to 1
    fireEvent.click(container.querySelector('[data-iris-notification-body]')!)
    expect(container.querySelector('[data-iris-notifications-badge]')!.textContent).toBe('1')

    // dismiss the first item → one left
    fireEvent.click(container.querySelector('[data-iris-notification-dismiss]')!)
    expect(container.querySelectorAll('[data-iris-notification]')).toHaveLength(1)
  })

  it('mark-all clears the badge, clear empties the list', () => {
    const center = createNotificationCenter({ initial: [{ title: 'A' }, { title: 'B' }] })
    const { container } = render(<IrisNotificationCenter center={center} />)
    fireEvent.click(container.querySelector('[data-iris-notifications-mark-all]')!)
    expect(container.querySelector('[data-iris-notifications-badge]')).toBeNull()
    fireEvent.click(container.querySelector('[data-iris-notifications-clear]')!)
    expect(container.querySelector('[data-iris-notifications-empty]')).not.toBeNull()
  })

  it('uses host-localized labels for every action and badge', () => {
    const center = createNotificationCenter({ initial: [{ title: 'A' }] })
    const { container } = render(
      <IrisNotificationCenter
        center={center}
        markAllReadLabel="Alles lesen"
        clearLabel="Leeren"
        dismissLabel="Schließen"
        unreadLabel="{n} ungelesen"
      />,
    )
    expect(container.querySelector('[data-iris-notifications-mark-all]')?.textContent).toBe(
      'Alles lesen',
    )
    expect(container.querySelector('[data-iris-notifications-clear]')?.textContent).toBe('Leeren')
    expect(
      container.querySelector('[data-iris-notification-dismiss]')?.getAttribute('aria-label'),
    ).toBe('Schließen')
    expect(
      container.querySelector('[data-iris-notifications-badge]')?.getAttribute('aria-label'),
    ).toBe('1 ungelesen')
  })
})
