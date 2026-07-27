// @vitest-environment jsdom

import { mount, tick, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { collectCmsLeafKeys, isCmsPageRoute } from '@iris-ui-kit/cms-shared'
import { menus } from '../menus'
import WorkspacePage from './WorkspacePage.svelte'

describe('Svelte CMS workspace bridge', () => {
  let instance: ReturnType<typeof mount> | undefined

  afterEach(async () => {
    if (instance) await unmount(instance)
    instance = undefined
  })

  it('covers every extended-menu leaf with a real page contract', () => {
    const leaves = collectCmsLeafKeys(menus)
    expect(leaves.every((key) => key === 'form-builder' || isCmsPageRoute(key))).toBe(true)
    expect(leaves).toContain('audit-log')
  })

  it('renders audit export and review actions through Svelte runes', async () => {
    const container = document.createElement('div')
    instance = mount(WorkspacePage, {
      target: container,
      props: { routeKey: 'audit-log' },
    })

    const exportButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Export visible',
    )!
    exportButton.click()
    await tick()
    expect(container.textContent).toContain('Exported 3 visible audit events.')

    const review = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Mark reviewed',
    )!
    review.click()
    await tick()
    expect(container.textContent).toContain('Marked the Updated Editor access event as reviewed.')
    expect(container.textContent).toContain('Reviewed')
  })
})
