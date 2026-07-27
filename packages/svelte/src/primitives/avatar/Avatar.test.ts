import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import IrisAvatar from './Avatar.svelte'
import AvatarSnippetHarness from './AvatarSnippetHarness.svelte'

describe('@iris-ui-kit/svelte IrisAvatar', () => {
  it('renders an <img> when src is provided', () => {
    const { container } = render(IrisAvatar, { props: { src: '/u.png', alt: 'user' } })
    const img = container.querySelector('img')!
    expect(img).not.toBeNull()
    expect(img.getAttribute('src')).toBe('/u.png')
    expect(img.getAttribute('alt')).toBe('user')
    expect(
      container.querySelector('[data-iris-avatar-state]')!.getAttribute('data-iris-avatar-state'),
    ).toBe('image')
  })

  it('renders initials from name when no src', () => {
    const { container } = render(IrisAvatar, { props: { name: 'Yan Buw' } })
    expect(container.textContent).toBe('YB')
    expect(
      container.querySelector('[data-iris-avatar-state]')!.getAttribute('data-iris-avatar-state'),
    ).toBe('fallback')
  })

  it('explicit fallback wins over initials', () => {
    const { container } = render(IrisAvatar, { props: { name: 'Yan Buw', fallback: 'AI' } })
    expect(container.textContent).toBe('AI')
  })

  it('fallbackContent snippet wins over initials', () => {
    const { container } = render(AvatarSnippetHarness, { props: { name: 'X' } })
    expect(container.textContent).toBe('USER')
  })

  it('swaps to fallback when the image fails to load', async () => {
    const { container } = render(IrisAvatar, { props: { src: '/missing.png', name: 'Yan Buw' } })
    const wrapper = container.querySelector('[data-iris-avatar-state]')!
    expect(wrapper.getAttribute('data-iris-avatar-state')).toBe('image')
    await fireEvent.error(container.querySelector('img')!)
    flushSync()
    expect(wrapper.getAttribute('data-iris-avatar-state')).toBe('fallback')
    expect(container.textContent).toBe('YB')
  })

  it('size sm/md/lg maps to 24/32/48', () => {
    const sm = render(IrisAvatar, { props: { size: 'sm' } })
    expect(sm.container.querySelector('[data-iris-avatar]')!.getAttribute('style')!).toContain(
      'width: 24px',
    )
    const lg = render(IrisAvatar, { props: { size: 'lg' } })
    expect(lg.container.querySelector('[data-iris-avatar]')!.getAttribute('style')!).toContain(
      'width: 48px',
    )
  })

  it('numeric size applied verbatim', () => {
    const { container } = render(IrisAvatar, { props: { size: 64 } })
    expect(container.querySelector('[data-iris-avatar]')!.getAttribute('style')!).toContain(
      'width: 64px',
    )
  })

  it('shape="square" disables circle border-radius + sets data attr', () => {
    const { container } = render(IrisAvatar, { props: { shape: 'square' } })
    const root = container.querySelector('[data-iris-avatar]')!
    const style = root.getAttribute('style') ?? ''
    expect(style).not.toContain('border-radius: 50%')
    expect(root.getAttribute('data-iris-avatar-shape')).toBe('square')
  })
})
