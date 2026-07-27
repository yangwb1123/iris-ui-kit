import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { createTabsNav } from '@iris-ui-kit/core'
import TabsNavProbe from './TabsNavProbe.svelte'
import type { UseTabsNavReturn } from './useTabsNav'

afterEach(cleanup)

describe('@iris-ui-kit/svelte useTabsNav', () => {
  it('reflects initial state', () => {
    const nav = createTabsNav({ tabs: [{ key: 'home', title: 'Home', pinned: true }] })
    const { container } = render(TabsNavProbe, { props: { nav } })
    expect(container.querySelector('[data-active]')!.textContent).toBe('home')
    expect(container.querySelector('[data-keys]')!.textContent).toBe('home')
  })

  it('reacts to open / close + bumps cacheKey on refresh', () => {
    const nav = createTabsNav()
    let api: UseTabsNavReturn | undefined
    const { container } = render(TabsNavProbe, {
      props: {
        nav,
        onready: (a: UseTabsNavReturn) => {
          api = a
        },
      },
    })
    api!.open({ key: 'a', title: 'A' })
    flushSync()
    expect(container.querySelector('[data-keys]')!.textContent).toBe('a')
    expect(container.querySelector('[data-cache]')!.textContent).toBe('a:0')
    api!.open({ key: 'b', title: 'B' })
    flushSync()
    expect(container.querySelector('[data-keys]')!.textContent).toBe('a,b')
    expect(container.querySelector('[data-active]')!.textContent).toBe('b')
    api!.refresh('b')
    flushSync()
    expect(container.querySelector('[data-cache]')!.textContent).toBe('a:0,b:1')
    api!.close('b')
    flushSync()
    expect(container.querySelector('[data-active]')!.textContent).toBe('a')
  })
})
