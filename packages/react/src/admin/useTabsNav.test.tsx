import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { createTabsNav } from '@iris-ui/core'
import { useTabsNav, type UseTabsNavReturn } from './useTabsNav'

afterEach(cleanup)

function probe(nav: ReturnType<typeof createTabsNav>) {
  const api: { current?: UseTabsNavReturn } = {}
  function Probe() {
    const t = useTabsNav(nav)
    api.current = t
    return (
      <div>
        <span data-testid="active">{t.activeKey ?? '—'}</span>
        <span data-testid="keys">{t.tabs.map((x) => x.key).join(',')}</span>
        <span data-testid="cache">{t.cacheKeys.join(',')}</span>
      </div>
    )
  }
  const utils = render(<Probe />)
  return { ...utils, api }
}

describe('useTabsNav (react)', () => {
  it('reflects initial state', () => {
    const nav = createTabsNav({ tabs: [{ key: 'home', title: 'Home', pinned: true }] })
    const { getByTestId } = probe(nav)
    expect(getByTestId('active').textContent).toBe('home')
    expect(getByTestId('keys').textContent).toBe('home')
  })

  it('reacts to open / activate / close', () => {
    const nav = createTabsNav()
    const { getByTestId, api } = probe(nav)
    act(() => api.current!.open({ key: 'a', title: 'A' }))
    expect(getByTestId('keys').textContent).toBe('a')
    expect(getByTestId('active').textContent).toBe('a')

    act(() => api.current!.open({ key: 'b', title: 'B' }))
    expect(getByTestId('keys').textContent).toBe('a,b')
    expect(getByTestId('active').textContent).toBe('b')

    act(() => api.current!.close('b'))
    expect(getByTestId('keys').textContent).toBe('a')
    expect(getByTestId('active').textContent).toBe('a')
  })

  it('exposes reactive keep-alive cacheKeys that bump on refresh', () => {
    const nav = createTabsNav()
    const { getByTestId, api } = probe(nav)
    act(() => api.current!.open({ key: 'a', title: 'A' }))
    expect(getByTestId('cache').textContent).toBe('a:0')
    act(() => api.current!.refresh('a'))
    expect(getByTestId('cache').textContent).toBe('a:1')
  })
})
