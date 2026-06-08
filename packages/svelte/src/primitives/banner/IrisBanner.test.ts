import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import BannerHarness from './BannerHarness.svelte'

describe('IrisBanner', () => {
  it('renders a banner by default', () => {
    const { container } = render(BannerHarness)
    const banner = container.querySelector('[data-iris-banner]')
    expect(banner).toBeTruthy()
  })

  it('hides banner after close button click', async () => {
    const { container } = render(BannerHarness, { props: { closable: true } })
    const closeBtn = container.querySelector('[data-iris-banner-close]')!
    await fireEvent.click(closeBtn)
    flushSync()
    const banner = container.querySelector('[data-iris-banner]')
    expect(banner).toBeFalsy()
  })

  it('calls onclose when closed', async () => {
    const onclose = vi.fn()
    const { container } = render(BannerHarness, { props: { closable: true, onclose } })
    const closeBtn = container.querySelector('[data-iris-banner-close]')!
    await fireEvent.click(closeBtn)
    flushSync()
    expect(onclose).toHaveBeenCalled()
  })
})
