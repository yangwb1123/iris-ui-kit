import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
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

  it('renders horizontal orientation by default', () => {
    const { container } = render(() => <IrisSplitter start={<div>L</div>} end={<div>R</div>} />)
    expect(container.querySelector('[data-iris-splitter-orientation="horizontal"]')).not.toBeNull()
  })
})
