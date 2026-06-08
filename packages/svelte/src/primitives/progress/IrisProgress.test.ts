import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisProgress from './IrisProgress.svelte'

describe('IrisProgress', () => {
  it('renders a determinate progress bar', () => {
    const { container } = render(IrisProgress, { props: { value: 50 } })
    const bar = container.querySelector('[data-iris-progress]')
    expect(bar).toBeTruthy()
    expect(bar!.getAttribute('data-state')).toBe('determinate')
    expect(bar!.getAttribute('aria-valuenow')).toBe('50')
  })

  it('renders an indeterminate bar', () => {
    const { container } = render(IrisProgress, { props: { indeterminate: true } })
    const bar = container.querySelector('[data-iris-progress]')
    expect(bar!.getAttribute('data-state')).toBe('indeterminate')
    expect(bar!.getAttribute('aria-valuenow')).toBeNull()
  })
})
