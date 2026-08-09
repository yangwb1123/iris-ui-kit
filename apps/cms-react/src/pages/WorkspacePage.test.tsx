// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { collectCmsLeafKeys, isCmsPageRoute } from '@iris-ui-kit/cms-shared'
import { menus } from '../menus'
import { WorkspacePage } from './WorkspacePage'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('React CMS workspace bridge', () => {
  let root: Root | undefined

  afterEach(() => {
    if (root) act(() => root?.unmount())
    root = undefined
  })

  it('covers every extended-menu leaf with a real page contract', () => {
    const leaves = collectCmsLeafKeys(menus)
    const dedicatedPluginRoutes = new Set([
      'form-builder',
      'realtime',
      'pro-table',
      'documentation',
      'vxe-example',
    ])
    expect(leaves.every((key) => dedicatedPluginRoutes.has(key) || isCmsPageRoute(key))).toBe(true)
    expect(leaves).toContain('audit-log')
  })

  it('renders shared article actions and reflects filter state', () => {
    const container = document.createElement('div')
    root = createRoot(container)
    act(() => root?.render(<WorkspacePage routeKey="articles" />))

    expect(container.querySelector('[data-cms-workspace="articles"]')).not.toBeNull()
    expect(container.textContent).not.toContain('placeholder')

    const create = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Create draft',
    )!
    act(() => create.click())
    expect(container.textContent).toContain('Untitled draft 4')

    const search = container.querySelector('input[aria-label="Search Articles"]')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        search,
        'token',
      )
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)

    const publish = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Toggle publish',
    )!
    act(() => publish.click())
    expect(container.textContent).toContain('Token migration playbook is now published.')
    expect(container.textContent).toContain('Published')
  })
})
