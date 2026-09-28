import { createSignal } from 'solid-js'
import {
  PROGRESS_INDETERMINATE_ANIMATION,
  PROGRESS_INDETERMINATE_KEYFRAME,
  PROGRESS_STYLES,
} from '@iris-ui-kit/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisProgress } from './IrisProgress'
import { __PROGRESS_STYLE_ID, __resetProgressStyles } from './styles'

beforeEach(__resetProgressStyles)
afterEach(() => {
  cleanup()
  __resetProgressStyles()
})

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

  it('uses the shared indeterminate keyframe in the rendered style', () => {
    const { container } = render(() => <IrisProgress indeterminate />)
    const bar = container.querySelector('[data-iris-progress-bar]')!

    expect(PROGRESS_INDETERMINATE_KEYFRAME).toBe('iris-progress-indeterminate')
    expect(PROGRESS_STYLES).toContain(`@keyframes ${PROGRESS_INDETERMINATE_KEYFRAME}`)
    expect(bar.getAttribute('style')).toContain(PROGRESS_INDETERMINATE_ANIMATION)
    expect(document.getElementById(__PROGRESS_STYLE_ID)?.textContent).toContain(
      `@keyframes ${PROGRESS_INDETERMINATE_KEYFRAME}`,
    )
  })

  it('uses logical inline positioning for the indeterminate fill in LTR and RTL', () => {
    const [dir, setDir] = createSignal<'ltr' | 'rtl'>('ltr')
    const { container } = render(() => (
      <div dir={dir()}>
        <IrisProgress indeterminate />
      </div>
    ))

    const assertLogicalPositioning = () => {
      const fill = container.querySelector('[data-iris-progress-bar]') as HTMLElement
      const stylesheet = document.getElementById(__PROGRESS_STYLE_ID)?.textContent ?? ''
      expect(fill.style.left).toBe('')
      expect(fill.style.right).toBe('')
      expect(stylesheet).toContain('inset-inline-start')
      expect(stylesheet).toContain('inset-inline-end')
      expect(stylesheet).not.toMatch(/\b(?:left|right)\s*:/)
    }

    assertLogicalPositioning()
    setDir('rtl')
    assertLogicalPositioning()
  })

  it('applies correct tone data attribute', () => {
    const { container } = render(() => <IrisProgress value={30} tone="success" />)
    expect(container.querySelector('[data-iris-progress-tone="success"]')).not.toBeNull()
  })
})
