import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisTextarea } from './IrisTextarea'

afterEach(cleanup)

describe('IrisTextarea', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisTextarea />)
    expect(container.querySelector('[data-iris-textarea]')).not.toBeNull()
  })

  it('renders textarea element', () => {
    const { container } = render(() => <IrisTextarea placeholder="Write here" />)
    const ta = container.querySelector('textarea')
    expect(ta).not.toBeNull()
    expect(ta?.getAttribute('placeholder')).toBe('Write here')
  })

  it('calls onChange on input', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisTextarea onChange={onChange} />)
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    fireEvent.input(ta, { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalledWith('hello')
  })

  it('applies invalid state', () => {
    const { container } = render(() => <IrisTextarea invalid />)
    expect(container.querySelector('[data-state="invalid"]')).not.toBeNull()
  })
})
