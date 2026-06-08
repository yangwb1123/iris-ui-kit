import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisMarquee } from './IrisMarquee'

afterEach(cleanup)

describe('IrisMarquee', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisMarquee>Scrolling text</IrisMarquee>)
    expect(container.querySelector('[data-iris-marquee]')).not.toBeNull()
  })

  it('renders a track element', () => {
    const { container } = render(() => <IrisMarquee>Content</IrisMarquee>)
    expect(container.querySelector('[data-iris-marquee-track]')).not.toBeNull()
  })

  it('renders content twice (original + aria-hidden copy)', () => {
    const { container } = render(() => <IrisMarquee>Repeat me</IrisMarquee>)
    const content = container.querySelectorAll('[data-iris-marquee-content]')
    expect(content.length).toBe(2)
    expect(content[1]?.getAttribute('aria-hidden')).toBe('true')
  })

  it('shows the content', () => {
    const { getAllByText } = render(() => <IrisMarquee>Hello world</IrisMarquee>)
    // Two copies — one visible, one aria-hidden
    expect(getAllByText('Hello world').length).toBeGreaterThanOrEqual(1)
  })
})
