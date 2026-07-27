import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTextarea } from './Textarea'

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisTextarea', () => {
  it('renders a <textarea>', () => {
    const { container } = render(<IrisTextarea />)
    expect(container.querySelector('textarea')).not.toBeNull()
  })

  it('default rows = 3', () => {
    const { container } = render(<IrisTextarea />)
    expect(container.querySelector('textarea')!.getAttribute('rows')).toBe('3')
  })

  it('controlled value + onChange', () => {
    const onChange = vi.fn()
    const { container } = render(<IrisTextarea value="hello" onChange={onChange} />)
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    expect(ta.value).toBe('hello')
    fireEvent.change(ta, { target: { value: 'world' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('disabled forwarded + opacity', () => {
    const { container } = render(<IrisTextarea disabled />)
    expect(container.querySelector('textarea')!.disabled).toBe(true)
    expect(container.querySelector('[data-iris-textarea]')!.getAttribute('style')).toContain(
      'opacity: 0.6',
    )
  })

  it('invalid sets aria-invalid + data-state', () => {
    const { container } = render(<IrisTextarea invalid />)
    expect(container.querySelector('textarea')!.getAttribute('aria-invalid')).toBe('true')
    expect(container.querySelector('[data-iris-textarea]')!.getAttribute('data-state')).toBe(
      'invalid',
    )
  })

  it('ariaDescribedby forwarded', () => {
    const { container } = render(<IrisTextarea ariaDescribedby="hint" />)
    expect(container.querySelector('textarea')!.getAttribute('aria-describedby')).toBe('hint')
  })

  it('focus/blur change data-state', () => {
    const { container } = render(<IrisTextarea />)
    const ta = container.querySelector('textarea')!
    fireEvent.focus(ta)
    expect(container.querySelector('[data-iris-textarea]')!.getAttribute('data-state')).toBe(
      'focused',
    )
    fireEvent.blur(ta)
    expect(container.querySelector('[data-iris-textarea]')!.getAttribute('data-state')).toBe('idle')
  })

  it('size flips data attr', () => {
    const { container } = render(<IrisTextarea size="lg" />)
    expect(
      container.querySelector('[data-iris-textarea]')!.getAttribute('data-iris-textarea-size'),
    ).toBe('lg')
  })
})
