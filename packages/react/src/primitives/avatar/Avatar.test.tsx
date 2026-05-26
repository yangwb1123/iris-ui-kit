import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisAvatar } from './Avatar'

afterEach(() => cleanup())

describe('@iris-ui/react IrisAvatar', () => {
  it('renders an <img> when src is provided', () => {
    const { container } = render(<IrisAvatar src="/u.png" alt="user" />)
    const img = container.querySelector('img')!
    expect(img).not.toBeNull()
    expect(img.getAttribute('src')).toBe('/u.png')
    expect(img.getAttribute('alt')).toBe('user')
  })

  it('renders initials from name when no src', () => {
    const { container } = render(<IrisAvatar name="Yan Buw" />)
    expect(container.textContent).toBe('YB')
    expect(container.querySelector('[data-iris-avatar-state]')!.getAttribute('data-iris-avatar-state')).toBe('fallback')
  })

  it('explicit fallback wins over initials', () => {
    const { container } = render(<IrisAvatar name="Yan Buw" fallback="AI" />)
    expect(container.textContent).toBe('AI')
  })

  it('fallbackContent React node wins over initials', () => {
    const { container } = render(<IrisAvatar name="X" fallbackContent={<span>👤</span>} />)
    expect(container.textContent).toBe('👤')
  })

  it('swaps to fallback when the image fails to load', () => {
    const { container } = render(<IrisAvatar src="/missing.png" name="Yan Buw" />)
    const wrapper = container.querySelector('[data-iris-avatar-state]')!
    expect(wrapper.getAttribute('data-iris-avatar-state')).toBe('image')
    fireEvent.error(container.querySelector('img')!)
    expect(wrapper.getAttribute('data-iris-avatar-state')).toBe('fallback')
    expect(container.textContent).toBe('YB')
  })

  it('size sm/md/lg maps to 24/32/48', () => {
    const { container, rerender } = render(<IrisAvatar size="sm" />)
    expect(container.querySelector('[data-iris-avatar]')!.getAttribute('style')!).toContain('width: 24px')
    rerender(<IrisAvatar size="lg" />)
    expect(container.querySelector('[data-iris-avatar]')!.getAttribute('style')!).toContain('width: 48px')
  })

  it('numeric size applied', () => {
    const { container } = render(<IrisAvatar size={64} />)
    expect(container.querySelector('[data-iris-avatar]')!.getAttribute('style')!).toContain('width: 64px')
  })

  it('shape="square" disables circle border-radius', () => {
    const { container } = render(<IrisAvatar shape="square" />)
    const style = container.querySelector('[data-iris-avatar]')!.getAttribute('style') ?? ''
    expect(style).not.toContain('border-radius: 50%')
  })
})
