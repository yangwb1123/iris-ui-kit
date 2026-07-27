import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisNavMenu } from './NavMenu'
import type { NavNode } from '@iris-ui-kit/core'

afterEach(cleanup)

const items: NavNode[] = [
  { key: 'dash', title: 'Dashboard', icon: 'menu' },
  {
    key: 'sys',
    title: 'System',
    icon: 'folder',
    children: [
      { key: 'users', title: 'Users' },
      { key: 'roles', title: 'Roles', badge: 3 },
    ],
  },
]

const navItems = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLElement>('[data-iris-nav-item]'))

describe('IrisNavMenu (react)', () => {
  it('renders top-level items; branches collapsed by default', () => {
    const { container } = render(<IrisNavMenu items={items} />)
    expect(navItems(container)).toHaveLength(2)
    expect(container.querySelector('[data-iris-nav-children]')).toBeNull()
  })

  it('clicking a leaf calls onSelect(key, node)', () => {
    const onSelect = vi.fn()
    const { container } = render(<IrisNavMenu items={items} onSelect={onSelect} />)
    fireEvent.click(navItems(container)[0]!)
    expect(onSelect).toHaveBeenCalledWith('dash', items[0])
  })

  it('clicking a branch toggles its children (does not select)', () => {
    const onSelect = vi.fn()
    const { container } = render(<IrisNavMenu items={items} onSelect={onSelect} />)
    const sys = navItems(container)[1]!
    fireEvent.click(sys)
    expect(container.querySelector('[data-iris-nav-children]')).not.toBeNull()
    expect(navItems(container)).toHaveLength(4)
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.click(navItems(container)[1]!)
    expect(container.querySelector('[data-iris-nav-children]')).toBeNull()
  })

  it('auto-expands the active branch trail and marks the active leaf', () => {
    const { container } = render(<IrisNavMenu items={items} activeKey="users" />)
    expect(container.querySelector('[data-iris-nav-children]')).not.toBeNull()
    const active = navItems(container).find((b) => b.getAttribute('data-active') === 'true')!
    expect(active.textContent).toContain('Users')
    expect(active.getAttribute('aria-current')).toBe('page')
  })

  it('renders a badge for a leaf with badge', () => {
    const { container } = render(<IrisNavMenu items={items} activeKey="users" />)
    expect(container.querySelector('[data-iris-nav-badge]')!.textContent).toBe('3')
  })

  it('collapsed mode renders only top-level icon buttons announced as sections', () => {
    const { container } = render(<IrisNavMenu items={items} collapsed />)
    const tops = navItems(container)
    expect(tops).toHaveLength(2)
    expect(tops[1]!.getAttribute('title')).toBe('System')
    expect(tops[1]!.getAttribute('aria-label')).toBe('System (section)')
    expect(container.querySelector('[data-iris-nav-children]')).toBeNull()
  })

  it('collapsed branch click jumps to its first leaf', () => {
    const onSelect = vi.fn()
    const { container } = render(<IrisNavMenu items={items} collapsed onSelect={onSelect} />)
    fireEvent.click(navItems(container)[1]!) // System → first leaf Users
    expect(onSelect).toHaveBeenCalledWith('users', items[1]!.children![0])
  })

  it('supports controlled expandedKeys', () => {
    const onExpanded = vi.fn()
    const { container, rerender } = render(
      <IrisNavMenu items={items} expandedKeys={[]} onExpandedKeysChange={onExpanded} />,
    )
    expect(container.querySelector('[data-iris-nav-children]')).toBeNull()
    fireEvent.click(navItems(container)[1]!)
    expect(onExpanded).toHaveBeenCalledWith(['sys'])
    expect(container.querySelector('[data-iris-nav-children]')).toBeNull() // controlled
    rerender(<IrisNavMenu items={items} expandedKeys={['sys']} onExpandedKeysChange={onExpanded} />)
    expect(container.querySelector('[data-iris-nav-children]')).not.toBeNull()
  })

  it('does not select a disabled leaf', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <IrisNavMenu items={[{ key: 'x', title: 'X', disabled: true }]} onSelect={onSelect} />,
    )
    fireEvent.click(navItems(container)[0]!)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('Arrow Down / Up / Home / End move focus between visible items', () => {
    const { container } = render(<IrisNavMenu items={items} />, {
      container: document.body.appendChild(document.createElement('div')),
    })
    const buttons = navItems(container)
    buttons[0]!.focus()
    const nav = container.querySelector('[data-iris-nav-menu]')!
    act(() => fireEvent.keyDown(nav, { key: 'ArrowDown' }))
    expect(document.activeElement).toBe(buttons[1])
    act(() => fireEvent.keyDown(nav, { key: 'ArrowUp' }))
    expect(document.activeElement).toBe(buttons[0])
    act(() => fireEvent.keyDown(nav, { key: 'End' }))
    expect(document.activeElement).toBe(buttons[buttons.length - 1])
    act(() => fireEvent.keyDown(nav, { key: 'Home' }))
    expect(document.activeElement).toBe(buttons[0])
  })

  it('Arrow Right expands a collapsed branch, Arrow Left collapses it', () => {
    const { container } = render(<IrisNavMenu items={items} />, {
      container: document.body.appendChild(document.createElement('div')),
    })
    const sys = navItems(container).find((b) => b.textContent!.includes('System'))!
    sys.focus()
    const nav = container.querySelector('[data-iris-nav-menu]')!
    act(() => fireEvent.keyDown(nav, { key: 'ArrowRight' }))
    expect(container.querySelector('[data-iris-nav-children]')).not.toBeNull()
    act(() => fireEvent.keyDown(nav, { key: 'ArrowLeft' }))
    expect(container.querySelector('[data-iris-nav-children]')).toBeNull()
  })
})
