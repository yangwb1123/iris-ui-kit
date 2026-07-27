import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisAdminBreadcrumb } from './AdminBreadcrumb'
import type { NavNode } from '@iris-ui-kit/core'

afterEach(cleanup)

const trail: NavNode[] = [
  { key: 'sys', title: 'System', icon: 'folder' },
  { key: 'settings', title: 'Settings' },
  { key: 'profile', title: 'Profile' },
]

describe('IrisAdminBreadcrumb (react)', () => {
  it('renders a crumb per trail node and marks the last current', () => {
    const { container } = render(<IrisAdminBreadcrumb trail={trail} />)
    expect(container.querySelectorAll('[data-iris-admin-crumb]')).toHaveLength(3)
    expect(container.querySelector('[aria-current="page"]')).not.toBeNull()
  })

  it('calls onSelect for an ancestor crumb but not the current one', () => {
    const onSelect = vi.fn()
    const { container } = render(<IrisAdminBreadcrumb trail={trail} onSelect={onSelect} />)
    const crumbs = container.querySelectorAll<HTMLElement>('[data-iris-admin-crumb]')
    fireEvent.click(crumbs[0]!) // System
    fireEvent.click(crumbs[2]!) // Profile (current — no select)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('sys', trail[0])
  })

  it('renders nothing for an empty trail, and respects hideSingle', () => {
    const { container: empty } = render(<IrisAdminBreadcrumb trail={[]} />)
    expect(empty.querySelector('nav')).toBeNull()
    const { container: single } = render(<IrisAdminBreadcrumb trail={[trail[0]!]} hideSingle />)
    expect(single.querySelector('nav')).toBeNull()
  })
})
