import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisProgress } from './IrisProgress'

afterEach(cleanup)

describe('IrisProgress', () => {
  it('renders determinate progress bar', () => {
    const { container } = render(() => <IrisProgress value={50} max={100} />)
    const el = container.querySelector('[data-iris-progress]')!
    expect(el.getAttribute('aria-valuenow')).toBe('50')
    expect(el.getAttribute('data-state')).toBe('determinate')
  })

  it('renders indeterminate state when value is null', () => {
    const { container } = render(() => <IrisProgress value={null} />)
    const el = container.querySelector('[data-iris-progress]')!
    expect(el.getAttribute('data-state')).toBe('indeterminate')
    expect(el.hasAttribute('aria-valuenow')).toBe(false)
  })

  it('renders indeterminate state via indeterminate prop', () => {
    const { container } = render(() => <IrisProgress indeterminate />)
    expect(container.querySelector('[data-state="indeterminate"]')).not.toBeNull()
  })

  it('applies correct tone data attribute', () => {
    const { container } = render(() => <IrisProgress value={30} tone="success" />)
    expect(container.querySelector('[data-iris-progress-tone="success"]')).not.toBeNull()
  })
})
