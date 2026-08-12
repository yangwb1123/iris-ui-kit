// @vitest-environment jsdom

import { render } from 'solid-js/web'
import { afterEach, describe, expect, it } from 'vitest'
import { collectCmsLeafKeys, isCmsPageRoute } from '@iris-ui-kit/cms-shared'
import { menus } from '../menus'
import { WorkspacePage } from './WorkspacePage'

describe('Solid CMS workspace bridge', () => {
  let dispose: (() => void) | undefined
  let container: HTMLDivElement | undefined

  afterEach(() => {
    dispose?.()
    container?.remove()
    dispose = undefined
    container = undefined
  })

  it('covers every compact-menu leaf with a real page contract', () => {
    const leaves = collectCmsLeafKeys(menus)
    expect(
      leaves.every((key) => key === 'form-builder' || key === 'vxe-example' || isCmsPageRoute(key)),
    ).toBe(true)
    expect(leaves).not.toContain('audit-log')
  })

  it('renders calendar navigation and mutations through Solid signals', async () => {
    container = document.createElement('div')
    document.body.append(container)
    dispose = render(() => <WorkspacePage routeKey="calendar" />, container)

    expect(container.textContent).toContain('July 2026')
    const next = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Next',
    )!
    next.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
    expect(container.textContent).toContain('August 2026')

    const add = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Add event',
    )!
    add.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
    expect(container.textContent).toContain('Editorial event 4')
    expect(container.textContent).toContain('Aug 18')
  })
})
