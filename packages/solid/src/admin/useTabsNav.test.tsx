import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { createTabsNav } from '@iris-ui-kit/core'
import { useTabsNav, type UseTabsNavReturn } from './useTabsNav'

afterEach(cleanup)

function probe(nav: ReturnType<typeof createTabsNav>) {
  let api!: UseTabsNavReturn
  const Probe = () => {
    api = useTabsNav(nav)
    return (
      <div>
        <span data-active="">{api.activeKey() ?? '—'}</span>
        <span data-keys="">
          {api
            .tabs()
            .map((t) => t.key)
            .join(',')}
        </span>
        <span data-cache="">{api.cacheKeys().join(',')}</span>
      </div>
    )
  }
  const utils = render(() => <Probe />)
  return { ...utils, api }
}

describe('@iris-ui-kit/solid useTabsNav', () => {
  it('reflects initial state', () => {
    const nav = createTabsNav({ tabs: [{ key: 'home', title: 'Home', pinned: true }] })
    const { container } = probe(nav)
    expect(container.querySelector('[data-active]')!.textContent).toBe('home')
    expect(container.querySelector('[data-keys]')!.textContent).toBe('home')
  })

  it('reacts to open / close + bumps cacheKey on refresh', () => {
    const nav = createTabsNav()
    const { container, api } = probe(nav)
    api.open({ key: 'a', title: 'A' })
    expect(container.querySelector('[data-keys]')!.textContent).toBe('a')
    expect(container.querySelector('[data-cache]')!.textContent).toBe('a:0')
    api.open({ key: 'b', title: 'B' })
    expect(container.querySelector('[data-keys]')!.textContent).toBe('a,b')
    expect(container.querySelector('[data-active]')!.textContent).toBe('b')
    api.refresh('b')
    expect(container.querySelector('[data-cache]')!.textContent).toBe('a:0,b:1')
    api.close('b')
    expect(container.querySelector('[data-active]')!.textContent).toBe('a')
  })
})
