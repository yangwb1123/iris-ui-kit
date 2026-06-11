import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { createNotificationCenter } from '../core'
import IrisNotificationCenter from './IrisNotificationCenter.svelte'

describe('IrisNotificationCenter (svelte)', () => {
  it('renders items + unread badge, marks read on click, dismisses', async () => {
    const center = createNotificationCenter()
    center.push({ title: 'First' })
    center.push({ title: 'Second' })
    const { container } = render(IrisNotificationCenter, { props: { center } })

    expect(container.querySelectorAll('[data-iris-notification]')).toHaveLength(2)
    expect(container.querySelector('[data-iris-notifications-badge]')!.textContent).toBe('2')

    // click the first item's body → marks read → badge drops to 1
    await fireEvent.click(container.querySelector('[data-iris-notification-body]')!)
    expect(container.querySelector('[data-iris-notifications-badge]')!.textContent).toBe('1')

    // dismiss the first item → one left
    await fireEvent.click(container.querySelector('[data-iris-notification-dismiss]')!)
    expect(container.querySelectorAll('[data-iris-notification]')).toHaveLength(1)
  })

  it('mark-all clears the badge, clear empties the list', async () => {
    const center = createNotificationCenter({ initial: [{ title: 'A' }, { title: 'B' }] })
    const { container } = render(IrisNotificationCenter, { props: { center } })
    await fireEvent.click(container.querySelector('[data-iris-notifications-mark-all]')!)
    expect(container.querySelector('[data-iris-notifications-badge]')).toBeNull()
    await fireEvent.click(container.querySelector('[data-iris-notifications-clear]')!)
    expect(container.querySelector('[data-iris-notifications-empty]')).not.toBeNull()
  })
})
