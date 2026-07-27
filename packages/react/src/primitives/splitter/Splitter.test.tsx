import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisSplitter } from './Splitter'

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisSplitter', () => {
  it('renders container + handle + two panes', () => {
    const { container } = render(<IrisSplitter start={<div>S</div>} end={<div>E</div>} />)
    expect(container.querySelector('[data-iris-splitter]')).not.toBeNull()
    expect(container.querySelector('[data-iris-splitter-handle]')).not.toBeNull()
    expect(container.querySelector('[data-iris-splitter-pane=start]')).not.toBeNull()
    expect(container.querySelector('[data-iris-splitter-pane=end]')).not.toBeNull()
  })

  it('handle has role="separator" with correct ARIA values', () => {
    const { container } = render(<IrisSplitter value={0.3} start={<div />} end={<div />} />)
    const handle = container.querySelector('[data-iris-splitter-handle]')!
    expect(handle.getAttribute('role')).toBe('separator')
    expect(handle.getAttribute('aria-orientation')).toBe('horizontal')
    expect(handle.getAttribute('aria-valuenow')).toBe('30')
    expect(handle.getAttribute('aria-valuemin')).toBe('0')
    expect(handle.getAttribute('aria-valuemax')).toBe('100')
  })

  it('vertical orientation reflects on data + aria attrs', () => {
    const { container } = render(
      <IrisSplitter orientation="vertical" value={0.5} start={<div />} end={<div />} />,
    )
    expect(
      container
        .querySelector('[data-iris-splitter]')
        ?.getAttribute('data-iris-splitter-orientation'),
    ).toBe('vertical')
    expect(
      container.querySelector('[data-iris-splitter-handle]')?.getAttribute('aria-orientation'),
    ).toBe('vertical')
  })

  it('disabled handle has tabindex=-1', () => {
    const { container } = render(<IrisSplitter disabled start={<div />} end={<div />} />)
    expect((container.querySelector('[data-iris-splitter-handle]') as HTMLElement).tabIndex).toBe(
      -1,
    )
  })

  it('pane flex ratios derive from value', () => {
    const { container } = render(<IrisSplitter value={0.25} start={<div />} end={<div />} />)
    const startPane = container.querySelector('[data-iris-splitter-pane=start]') as HTMLElement
    const endPane = container.querySelector('[data-iris-splitter-pane=end]') as HTMLElement
    expect(startPane.style.flex).toContain('0.25')
    expect(endPane.style.flex).toContain('0.75')
  })

  it('defaultValue applies for uncontrolled', () => {
    const { container } = render(<IrisSplitter defaultValue={0.7} start={<div />} end={<div />} />)
    const handle = container.querySelector('[data-iris-splitter-handle]')!
    expect(handle.getAttribute('aria-valuenow')).toBe('70')
  })
})
