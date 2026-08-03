import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
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

describe('@iris-ui-kit/solid IrisNavMenu', () => {
  it('renders top-level items; branches collapsed by default', () => {
    const { container } = render(() => <IrisNavMenu items={items} />)
    expect(navItems(container)).toHaveLength(2)
    expect(container.querySelector('[data-iris-nav-children]')).toBeNull()
  })

  it('clicking a leaf calls onSelect(key, node); clicking a branch toggles children', () => {
    const onSelect = vi.fn()
    const { container } = render(() => <IrisNavMenu items={items} onSelect={onSelect} />)
    fireEvent.click(navItems(container)[0]!) // Dashboard leaf
    expect(onSelect).toHaveBeenCalledWith('dash', items[0])

    fireEvent.click(navItems(container)[1]!) // System branch → expand
    expect(container.querySelector('[data-iris-nav-children]')).not.toBeNull()
    expect(navItems(container)).toHaveLength(4)
  })

  it('auto-expands the active trail + marks the active leaf and a badge', () => {
    const { container } = render(() => <IrisNavMenu items={items} activeKey="users" />)
    expect(container.querySelector('[data-iris-nav-children]')).not.toBeNull()
    const active = navItems(container).find((b) => b.getAttribute('data-active') === 'true')!
    expect(active.textContent).toContain('Users')
    expect(active.getAttribute('aria-current')).toBe('page')
    expect(container.querySelector('[data-iris-nav-badge]')!.textContent).toBe('3')
  })

  it('collapsed rail: top-level only, section labels, branch click → first leaf', () => {
    const onSelect = vi.fn()
    const { container } = render(() => <IrisNavMenu items={items} collapsed onSelect={onSelect} />)
    const tops = navItems(container)
    expect(tops).toHaveLength(2)
    expect(tops[1]!.getAttribute('aria-label')).toBe('System (section)')
    fireEvent.click(tops[1]!) // System → first leaf Users
    expect(onSelect).toHaveBeenCalledWith('users', items[1]!.children![0])
  })

  it('arrow keys move focus + expand/collapse branches', () => {
    const { container } = render(() => <IrisNavMenu items={items} />, {
      container: document.body.appendChild(document.createElement('div')),
    })
    const nav = container.querySelector('[data-iris-nav-menu]')! as HTMLElement
    const buttons = navItems(container)
    buttons[0]!.focus()
    fireEvent.keyDown(nav, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(buttons[1])
    fireEvent.keyDown(nav, { key: 'ArrowRight' }) // expand System
    expect(container.querySelector('[data-iris-nav-children]')).not.toBeNull()
    fireEvent.keyDown(nav, { key: 'ArrowLeft' }) // collapse
    expect(container.querySelector('[data-iris-nav-children]')).toBeNull()
  })

  it('supports controlled expandedKeys (emits, stays closed until parent updates)', () => {
    const onExpanded = vi.fn()
    const { container } = render(() => (
      <IrisNavMenu items={items} expandedKeys={[]} onExpandedKeysChange={onExpanded} />
    ))
    fireEvent.click(navItems(container)[1]!)
    expect(onExpanded).toHaveBeenCalledWith(['sys'])
    expect(container.querySelector('[data-iris-nav-children]')).toBeNull()
  })

  it('applies the hover token only to an enabled hovered item', () => {
    const { container } = render(() => (
      <IrisNavMenu
        items={[
          { key: 'enabled', title: 'Enabled' },
          { key: 'disabled', title: 'Disabled', disabled: true },
        ]}
      />
    ))
    const [enabled, disabled] = navItems(container)

    fireEvent.mouseEnter(enabled!)
    expect(enabled!.style.background).toBe('var(--iris-surface-hover, var(--iris-surface))')

    fireEvent.mouseEnter(disabled!)
    expect(disabled!.style.background).toBe('transparent')
  })
})
