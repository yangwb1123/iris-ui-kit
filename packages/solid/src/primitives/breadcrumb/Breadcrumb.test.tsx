import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { IrisBreadcrumb } from './Breadcrumb'
import { IrisBreadcrumbItem } from './BreadcrumbItem'

afterEach(cleanup)

describe('@iris-ui/solid IrisBreadcrumb', () => {
  it('renders <nav aria-label="Breadcrumb"> + <ol>', () => {
    const { container } = render(() => (
      <IrisBreadcrumb>
        <IrisBreadcrumbItem href="/">Home</IrisBreadcrumbItem>
        <IrisBreadcrumbItem current>Settings</IrisBreadcrumbItem>
      </IrisBreadcrumb>
    ))
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Breadcrumb')
    expect(container.querySelector('ol')).not.toBeNull()
  })

  it('intersperses separators between items', () => {
    const { container } = render(() => (
      <IrisBreadcrumb>
        <IrisBreadcrumbItem href="/">Home</IrisBreadcrumbItem>
        <IrisBreadcrumbItem href="/x">X</IrisBreadcrumbItem>
        <IrisBreadcrumbItem current>Y</IrisBreadcrumbItem>
      </IrisBreadcrumb>
    ))
    expect(container.querySelectorAll('[data-iris-breadcrumb-separator]').length).toBe(2)
  })

  it('current item gets aria-current="page" and renders as span', () => {
    const { container } = render(() => (
      <IrisBreadcrumb>
        <IrisBreadcrumbItem href="/">Home</IrisBreadcrumbItem>
        <IrisBreadcrumbItem href="/never" current>
          Last
        </IrisBreadcrumbItem>
      </IrisBreadcrumb>
    ))
    const crumbs = container.querySelectorAll('[data-iris-breadcrumb-crumb]')
    expect(crumbs[1]?.tagName).toBe('SPAN') // current → span even though href was provided
    expect(crumbs[1]?.getAttribute('aria-current')).toBe('page')
    expect(crumbs[0]?.tagName).toBe('A')
    expect(crumbs[0]?.getAttribute('aria-current')).toBeNull()
  })

  it('item without href renders as span', () => {
    const { container } = render(() => (
      <IrisBreadcrumb>
        <IrisBreadcrumbItem>One</IrisBreadcrumbItem>
        <IrisBreadcrumbItem current>Two</IrisBreadcrumbItem>
      </IrisBreadcrumb>
    ))
    const crumbs = container.querySelectorAll('[data-iris-breadcrumb-crumb]')
    expect(crumbs[0]?.tagName).toBe('SPAN')
  })

  it('custom separator is rendered', () => {
    const { container } = render(() => (
      <IrisBreadcrumb separator=">">
        <IrisBreadcrumbItem href="/">A</IrisBreadcrumbItem>
        <IrisBreadcrumbItem current>B</IrisBreadcrumbItem>
      </IrisBreadcrumb>
    ))
    expect(container.querySelector('[data-iris-breadcrumb-separator]')?.textContent).toBe('>')
  })

  it('last item marker on the wrapping li', () => {
    const { container } = render(() => (
      <IrisBreadcrumb>
        <IrisBreadcrumbItem href="/">A</IrisBreadcrumbItem>
        <IrisBreadcrumbItem current>B</IrisBreadcrumbItem>
      </IrisBreadcrumb>
    ))
    const items = container.querySelectorAll('[data-iris-breadcrumb-item]')
    expect(items[1]?.getAttribute('data-iris-breadcrumb-last')).toBe('true')
    expect(items[0]?.getAttribute('data-iris-breadcrumb-last')).toBeNull()
  })

  it('href is preserved on non-current anchor items', () => {
    const { container } = render(() => (
      <IrisBreadcrumb>
        <IrisBreadcrumbItem href="/docs">Docs</IrisBreadcrumbItem>
        <IrisBreadcrumbItem current>x</IrisBreadcrumbItem>
      </IrisBreadcrumb>
    ))
    const link = container.querySelector('a')!
    expect(link.getAttribute('href')).toBe('/docs')
  })
})
