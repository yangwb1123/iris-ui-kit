import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisAnchor } from './Anchor'

const rect = (top: number): DOMRect =>
  ({
    top,
    bottom: top,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }) as DOMRect

function section(id: string): HTMLElement {
  const d = document.createElement('div')
  d.id = id
  d.setAttribute('data-test-section', '')
  document.body.appendChild(d)
  return d
}

afterEach(() => {
  cleanup()
  document.querySelectorAll('[data-test-section]').forEach((e) => e.remove())
})

const links = (c: HTMLElement) => c.querySelectorAll('[data-iris-anchor-link]')

describe('@iris-ui/react IrisAnchor', () => {
  it('renders a nav of links', () => {
    const { container } = render(
      <IrisAnchor
        items={[
          { href: '#a', title: 'A' },
          { href: '#b', title: 'B' },
        ]}
      />,
    )
    expect(container.querySelector('nav[data-iris-anchor]')).not.toBeNull()
    expect(links(container).length).toBe(2)
    expect(links(container)[0].getAttribute('href')).toBe('#a')
  })

  it('clicking a link scrolls to the target and marks it active', () => {
    const sec = section('a')
    const spy = vi.fn()
    ;(sec as unknown as { scrollIntoView: unknown }).scrollIntoView = spy
    const onChange = vi.fn()
    const { container } = render(
      <IrisAnchor items={[{ href: '#a', title: 'A' }]} onChange={onChange} />,
    )
    fireEvent.click(links(container)[0])
    expect(spy).toHaveBeenCalled()
    expect(links(container)[0].getAttribute('aria-current')).toBe('true')
    expect(onChange).toHaveBeenCalledWith('#a')
  })

  it('scroll-spy activates the last passed section', () => {
    const a = section('a')
    const b = section('b')
    a.getBoundingClientRect = () => rect(-10)
    b.getBoundingClientRect = () => rect(100)
    const { container } = render(
      <IrisAnchor
        items={[
          { href: '#a', title: 'A' },
          { href: '#b', title: 'B' },
        ]}
      />,
    )
    fireEvent.scroll(window)
    expect(links(container)[0].getAttribute('aria-current')).toBe('true')
    expect(links(container)[1].getAttribute('aria-current')).toBeNull()
    b.getBoundingClientRect = () => rect(-5)
    fireEvent.scroll(window)
    expect(links(container)[1].getAttribute('aria-current')).toBe('true')
  })
})
