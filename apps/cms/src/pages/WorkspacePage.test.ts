// @vitest-environment jsdom

import { createApp, nextTick, type App } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { collectCmsLeafKeys, isCmsPageRoute } from '@iris-ui-kit/cms-shared'
import { menus } from '../menus'
import WorkspacePage from './WorkspacePage.vue'

describe('Vue CMS workspace bridge', () => {
  let app: App<Element> | undefined

  afterEach(() => {
    app?.unmount()
    app = undefined
  })

  it('covers every compact-menu leaf with a real page contract', () => {
    const leaves = collectCmsLeafKeys(menus)
    expect(leaves.every(isCmsPageRoute)).toBe(true)
    expect(leaves).not.toContain('audit-log')
  })

  it('renders shared category mutations through Vue reactivity', async () => {
    const container = document.createElement('div')
    app = createApp(WorkspacePage, { routeKey: 'categories' })
    app.mount(container)

    const add = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Add category',
    )!
    add.click()
    await nextTick()
    expect(container.textContent).toContain('New category 4')

    const row = [...container.querySelectorAll('tbody tr')].find((candidate) =>
      candidate.textContent?.includes('New category 4'),
    )!
    const attach = [...row.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Add article',
    )!
    attach.click()
    await nextTick()

    expect(row.textContent).toContain('1')
    expect(container.textContent).toContain('Attached an article to New category 4.')
  })
})
