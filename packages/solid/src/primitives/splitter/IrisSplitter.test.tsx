import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisSplitter } from './IrisSplitter'

afterEach(cleanup)

describe('IrisSplitter', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisSplitter start={<div>Left</div>} end={<div>Right</div>} />
    ))
    expect(container.querySelector('[data-iris-splitter]')).not.toBeNull()
  })

  it('renders start and end panes', () => {
    const { getByText } = render(() => (
      <IrisSplitter start={<div>Pane A</div>} end={<div>Pane B</div>} />
    ))
    expect(getByText('Pane A')).toBeTruthy()
    expect(getByText('Pane B')).toBeTruthy()
  })

  it('renders the separator handle', () => {
    const { container } = render(() => (
      <IrisSplitter start={<div>Left</div>} end={<div>Right</div>} />
    ))
    const handle = container.querySelector('[data-iris-splitter-handle]')
    expect(handle).not.toBeNull()
    expect(handle?.getAttribute('role')).toBe('separator')
  })

  it('focused handle resizes with arrows and jumps to Home/End boundaries', () => {
    const { container } = render(() => <IrisSplitter defaultValue={0.5} />)
    const handle = container.querySelector('[data-iris-splitter-handle]') as HTMLElement

    handle.focus()
    expect(document.activeElement).toBe(handle)
    expect(handle.getAttribute('aria-label')).toBe('Resize panels')
    expect(handle.getAttribute('aria-orientation')).toBe('horizontal')
    expect(handle.getAttribute('aria-valuemin')).toBe('0')
    expect(handle.getAttribute('aria-valuemax')).toBe('100')
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(handle.getAttribute('aria-valuenow')).toBe('55')
    fireEvent.keyDown(handle, { key: 'Home' })
    expect(handle.getAttribute('aria-valuenow')).toBe('0')
    fireEvent.keyDown(handle, { key: 'End' })
    expect(handle.getAttribute('aria-valuenow')).toBe('100')
  })

  it('disabled handle ignores keyboard input', () => {
    const { container } = render(() => <IrisSplitter defaultValue={0.5} disabled />)
    const handle = container.querySelector('[data-iris-splitter-handle]') as HTMLElement

    expect(handle.getAttribute('aria-disabled')).toBe('true')
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(handle.getAttribute('aria-valuenow')).toBe('50')
  })

  it('renders horizontal orientation by default', () => {
    const { container } = render(() => <IrisSplitter start={<div>L</div>} end={<div>R</div>} />)
    expect(container.querySelector('[data-iris-splitter-orientation="horizontal"]')).not.toBeNull()
  })
})
