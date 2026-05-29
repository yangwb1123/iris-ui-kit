import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisProgress } from './Progress'
import { __PROGRESS_STYLE_ID, __resetProgressStyles } from './styles'

afterEach(() => cleanup())

describe('@iris-ui/react IrisProgress', () => {
  beforeEach(() => __resetProgressStyles())
  afterEach(() => __resetProgressStyles())

  it('renders with role=progressbar', () => {
    const { container } = render(<IrisProgress value={50} />)
    expect(container.querySelector('[role=progressbar]')).not.toBeNull()
  })

  it('determinate sets aria-valuenow', () => {
    const { container } = render(<IrisProgress value={30} max={60} />)
    const bar = container.querySelector('[data-iris-progress]')!
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('60')
    expect(bar.getAttribute('aria-valuenow')).toBe('30')
  })

  it('clamps value to [0, max]', () => {
    const { container, rerender } = render(<IrisProgress value={-5} />)
    expect(container.querySelector('[data-iris-progress]')!.getAttribute('aria-valuenow')).toBe('0')
    rerender(<IrisProgress value={200} max={100} />)
    expect(container.querySelector('[data-iris-progress]')!.getAttribute('aria-valuenow')).toBe(
      '100',
    )
  })

  it('bar width reflects percent', () => {
    const { container } = render(<IrisProgress value={25} max={100} />)
    const bar = container.querySelector('[data-iris-progress-bar]') as HTMLElement
    expect(bar.getAttribute('style')).toContain('width: 25%')
  })

  it('value=null → indeterminate', () => {
    const { container } = render(<IrisProgress />)
    const bar = container.querySelector('[data-iris-progress]')!
    expect(bar.getAttribute('data-state')).toBe('indeterminate')
    expect(bar.getAttribute('aria-valuenow')).toBeNull()
  })

  it('indeterminate=true forces indeterminate', () => {
    const { container } = render(<IrisProgress value={50} indeterminate />)
    expect(container.querySelector('[data-iris-progress]')!.getAttribute('data-state')).toBe(
      'indeterminate',
    )
  })

  it('tone success uses --iris-success', () => {
    const { container } = render(<IrisProgress value={50} tone="success" />)
    const bar = container.querySelector('[data-iris-progress-bar]') as HTMLElement
    expect(bar.getAttribute('style')).toContain('--iris-success')
  })

  it('size sm/md flips height', () => {
    const { container, rerender } = render(<IrisProgress value={0} size="sm" />)
    expect(container.querySelector('[data-iris-progress]')!.getAttribute('style')).toContain(
      'height: 4px',
    )
    rerender(<IrisProgress value={0} size="md" />)
    expect(container.querySelector('[data-iris-progress]')!.getAttribute('style')).toContain(
      'height: 8px',
    )
  })

  it('installs the stylesheet once', () => {
    render(<IrisProgress value={50} />)
    render(<IrisProgress value={60} />)
    expect(document.querySelectorAll(`#${__PROGRESS_STYLE_ID}`)).toHaveLength(1)
  })
})
