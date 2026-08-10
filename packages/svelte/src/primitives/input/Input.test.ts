import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisInput from './Input.svelte'
import InputAffixHarness from './InputAffixHarness.svelte'

describe('@iris-ui-kit/svelte IrisInput', () => {
  it('renders a native <input>', () => {
    const { container } = render(IrisInput, { props: { placeholder: 'x' } })
    expect(container.querySelector('input')).not.toBeNull()
    expect(container.querySelector('input')!.getAttribute('placeholder')).toBe('x')
  })

  it('value + oninput forwarded', async () => {
    const oninput = vi.fn()
    const { container } = render(IrisInput, { props: { value: 'hello', oninput } })
    const input = container.querySelector('input')!
    expect(input.value).toBe('hello')
    await fireEvent.input(input, { target: { value: 'world' } })
    flushSync()
    expect(oninput).toHaveBeenCalled()
  })

  it('disabled forwarded + style opacity drops', () => {
    const { container } = render(IrisInput, { props: { disabled: true } })
    expect(container.querySelector('input')!.disabled).toBe(true)
    const label = container.querySelector('[data-iris-input]') as HTMLElement
    expect(label.getAttribute('style')).toContain('opacity: 0.6')
  })

  it('invalid sets aria-invalid + data-state="invalid"', () => {
    const { container } = render(IrisInput, { props: { invalid: true } })
    expect(container.querySelector('input')!.getAttribute('aria-invalid')).toBe('true')
    expect(container.querySelector('[data-iris-input]')!.getAttribute('data-state')).toBe('invalid')
  })

  it('ariaDescribedby forwarded', () => {
    const { container } = render(IrisInput, { props: { ariaDescribedby: 'hint-id' } })
    expect(container.querySelector('input')!.getAttribute('aria-describedby')).toBe('hint-id')
  })

  it('focus → data-state="focused"; blur → idle', async () => {
    const { container } = render(IrisInput)
    const input = container.querySelector('input')!
    await fireEvent.focus(input)
    flushSync()
    expect(container.querySelector('[data-iris-input]')!.getAttribute('data-state')).toBe('focused')
    await fireEvent.blur(input)
    flushSync()
    expect(container.querySelector('[data-iris-input]')!.getAttribute('data-state')).toBe('idle')
  })

  it('renders prefix + suffix snippets', () => {
    const { container } = render(InputAffixHarness)
    expect(container.querySelector('[data-iris-input-prefix]')!.textContent).toBe('$')
    expect(container.querySelector('[data-iris-input-suffix]')!.textContent).toBe('USD')
  })

  it('size sm/md/lg flips data attr + font size', () => {
    const sm = render(IrisInput, { props: { size: 'sm' } })
    expect(
      sm.container.querySelector('[data-iris-input]')!.getAttribute('data-iris-input-size'),
    ).toBe('sm')
    const lg = render(IrisInput, { props: { size: 'lg' } })
    expect(lg.container.querySelector('[data-iris-input]')!.getAttribute('style')).toContain(
      'font-size: var(--iris-font-size-lg, 16px)',
    )
  })

  it('type prop is honored', () => {
    const { container } = render(IrisInput, { props: { type: 'password' } })
    expect(container.querySelector('input')!.getAttribute('type')).toBe('password')
  })

  it('id prop is applied to the inner input', () => {
    const { container } = render(IrisInput, { props: { id: 'my-input' } })
    expect(container.querySelector('input')!.id).toBe('my-input')
  })
})
