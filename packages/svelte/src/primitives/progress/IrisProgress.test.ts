import { render } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import IrisProgress from './IrisProgress.svelte'
import { __PROGRESS_STYLE_ID, __resetProgressStyles } from './styles'

describe('IrisProgress', () => {
  beforeEach(__resetProgressStyles)
  afterEach(__resetProgressStyles)

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

  it('uses logical inline positioning for the indeterminate fill in LTR and RTL', () => {
    const { container } = render(IrisProgress, { props: { indeterminate: true } })
    const root = container.querySelector('[data-iris-progress]') as HTMLElement
    const fill = container.querySelector('[data-iris-progress-bar]') as HTMLElement

    const assertLogicalPositioning = () => {
      const stylesheet = document.getElementById(__PROGRESS_STYLE_ID)?.textContent ?? ''
      expect(fill.style.left).toBe('')
      expect(fill.style.right).toBe('')
      expect(stylesheet).toContain('inset-inline-start')
      expect(stylesheet).toContain('inset-inline-end')
      expect(stylesheet).not.toMatch(/\b(?:left|right)\s*:/)
    }

    root.setAttribute('dir', 'ltr')
    assertLogicalPositioning()
    root.setAttribute('dir', 'rtl')
    assertLogicalPositioning()
  })
})
