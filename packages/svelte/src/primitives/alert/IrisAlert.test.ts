import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import IrisAlert from './IrisAlert.svelte'

afterEach(cleanup)

describe('@iris-ui-kit/svelte IrisAlert', () => {
  it('renders with default info tone', () => {
    const { container } = render(IrisAlert)
    const el = container.querySelector('[data-iris-alert]')
    expect(el).not.toBeNull()
    expect(el!.getAttribute('data-iris-alert-tone')).toBe('info')
  })

  it('uses role=alert for danger tone', () => {
    const { container } = render(IrisAlert, { props: { tone: 'danger' } })
    expect(container.querySelector('[data-iris-alert]')!.getAttribute('role')).toBe('alert')
  })

  it('uses role=status for info tone', () => {
    const { container } = render(IrisAlert, { props: { tone: 'info' } })
    expect(container.querySelector('[data-iris-alert]')!.getAttribute('role')).toBe('status')
  })

  it('renders close button when closable=true', () => {
    const { container } = render(IrisAlert, { props: { closable: true } })
    expect(container.querySelector('[data-iris-alert-close]')).not.toBeNull()
  })

  it('hides itself when close button is clicked (uncontrolled)', async () => {
    const { container } = render(IrisAlert, { props: { closable: true } })
    const btn = container.querySelector<HTMLButtonElement>('[data-iris-alert-close]')!
    await fireEvent.click(btn)
    flushSync()
    expect(container.querySelector('[data-iris-alert]')).toBeNull()
  })

  it('renders title when title prop is set', () => {
    const { container } = render(IrisAlert, { props: { title: 'Heads up' } })
    expect(container.querySelector('[data-iris-alert-title]')!.textContent).toContain('Heads up')
  })
})
