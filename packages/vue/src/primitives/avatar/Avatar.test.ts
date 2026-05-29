import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { IrisAvatar } from './Avatar'

describe('IrisAvatar', () => {
  it('renders an <img> when src is provided', () => {
    const w = mount(IrisAvatar, { props: { src: '/u.png', alt: 'user' } })
    const img = w.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/u.png')
    expect(img.attributes('alt')).toBe('user')
  })

  it('renders initials when no src is given but name is', () => {
    const w = mount(IrisAvatar, { props: { name: 'Yan Buw' } })
    expect(w.text()).toBe('YB')
    expect(w.attributes('data-iris-avatar-state')).toBe('fallback')
  })

  it('uses the first 2 letters when name is a single word', () => {
    const w = mount(IrisAvatar, { props: { name: 'Claude' } })
    expect(w.text()).toBe('CL')
  })

  it('explicit fallback string wins over derived initials', () => {
    const w = mount(IrisAvatar, { props: { name: 'Yan Buw', fallback: 'AI' } })
    expect(w.text()).toBe('AI')
  })

  it('falls back to the fallback slot when given', () => {
    const w = mount(IrisAvatar, {
      props: { name: 'X' },
      slots: { fallback: '👤' },
    })
    expect(w.text()).toBe('👤')
  })

  it('swaps to fallback when the image fails to load', async () => {
    const w = mount(IrisAvatar, { props: { src: '/missing.png', name: 'Yan Buw' } })
    expect(w.attributes('data-iris-avatar-state')).toBe('image')
    await w.find('img').trigger('error')
    await nextTick()
    expect(w.attributes('data-iris-avatar-state')).toBe('fallback')
    expect(w.text()).toBe('YB')
  })

  it('resets failed state when src changes', async () => {
    const w = mount(IrisAvatar, { props: { src: '/missing.png', name: 'Yan Buw' } })
    await w.find('img').trigger('error')
    await nextTick()
    expect(w.attributes('data-iris-avatar-state')).toBe('fallback')
    await w.setProps({ src: '/new.png' })
    expect(w.attributes('data-iris-avatar-state')).toBe('image')
  })

  it('size="sm"/"md"/"lg" maps to 24/32/48 px', () => {
    expect(mount(IrisAvatar, { props: { size: 'sm' } }).attributes('style')).toContain(
      'width: 24px',
    )
    expect(mount(IrisAvatar, { props: { size: 'md' } }).attributes('style')).toContain(
      'width: 32px',
    )
    expect(mount(IrisAvatar, { props: { size: 'lg' } }).attributes('style')).toContain(
      'width: 48px',
    )
  })

  it('accepts a numeric size', () => {
    const w = mount(IrisAvatar, { props: { size: 64 } })
    expect(w.attributes('style')).toContain('width: 64px')
    expect(w.attributes('style')).toContain('height: 64px')
  })

  it('shape="square" disables circle border-radius', () => {
    const w = mount(IrisAvatar, { props: { shape: 'square' } })
    const style = w.attributes('style') ?? ''
    expect(style).not.toContain('border-radius: 50%')
  })
})
