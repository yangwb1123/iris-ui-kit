import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import { __resetBreadcrumbStyles } from './styles'
import BreadcrumbHarness from './BreadcrumbHarness.svelte'

afterEach(() => {
  cleanup()
  __resetBreadcrumbStyles()
})

describe('@iris-ui/svelte IrisBreadcrumb', () => {
  it('renders nav > ol with one li per crumb; href crumbs are links', () => {
    const { container, getByText } = render(BreadcrumbHarness)
    expect(
      container.querySelector('nav[aria-label="Breadcrumb"] ol[data-iris-breadcrumb-list]'),
    ).not.toBeNull()
    expect(container.querySelectorAll('[data-iris-breadcrumb-item]')).toHaveLength(3)
    expect((getByText('Home') as HTMLElement).tagName).toBe('A')
  })

  it('marks the current crumb with aria-current=page (rendered as a span)', () => {
    const { getByText } = render(BreadcrumbHarness)
    const current = getByText('Page')
    expect(current.tagName).toBe('SPAN')
    expect(current.getAttribute('aria-current')).toBe('page')
  })

  it('installs the separator stylesheet once', () => {
    render(BreadcrumbHarness)
    render(BreadcrumbHarness)
    expect(document.querySelectorAll('#iris-breadcrumb-styles')).toHaveLength(1)
  })
})
