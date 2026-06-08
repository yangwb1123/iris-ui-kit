import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisSplitter from './IrisSplitter.svelte'

afterEach(cleanup)

describe('IrisSplitter', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisSplitter)
    expect(container).toBeTruthy()
  })

  it('renders start and end panes', () => {
    const { container } = render(IrisSplitter)
    expect(container.querySelector('[data-iris-splitter-pane="start"]')).not.toBeNull()
    expect(container.querySelector('[data-iris-splitter-pane="end"]')).not.toBeNull()
  })

  it('renders a separator handle', () => {
    const { container } = render(IrisSplitter)
    const handle = container.querySelector('[data-iris-splitter-handle]')
    expect(handle).not.toBeNull()
    expect(handle?.getAttribute('role')).toBe('separator')
  })

  it('sets correct aria attributes on handle', () => {
    const { container } = render(IrisSplitter, { props: { value: 0.5 } })
    const handle = container.querySelector('[data-iris-splitter-handle]')!
    expect(handle.getAttribute('aria-valuenow')).toBe('50')
  })
})
