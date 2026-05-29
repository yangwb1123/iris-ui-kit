import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisMarquee } from './Marquee'

afterEach(() => cleanup())

const copies = (c: HTMLElement) => c.querySelectorAll('[data-iris-marquee-content]')

describe('@iris-ui/react IrisMarquee', () => {
  it('renders the content', () => {
    const { container } = render(
      <IrisMarquee>
        <span>News flash</span>
      </IrisMarquee>,
    )
    expect(copies(container)[0].textContent).toBe('News flash')
  })

  it('duplicates content for a seamless loop; the copy is aria-hidden', () => {
    const { container } = render(
      <IrisMarquee>
        <span>x</span>
      </IrisMarquee>,
    )
    expect(copies(container).length).toBe(2)
    expect(copies(container)[0].getAttribute('aria-hidden')).toBeNull()
    expect(copies(container)[1].getAttribute('aria-hidden')).toBe('true')
  })

  it('clips overflow', () => {
    const { container } = render(
      <IrisMarquee>
        <span>x</span>
      </IrisMarquee>,
    )
    expect((container.querySelector('[data-iris-marquee]') as HTMLElement).style.overflow).toBe(
      'hidden',
    )
  })
})
