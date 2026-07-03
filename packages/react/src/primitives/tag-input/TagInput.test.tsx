import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTagInput } from './TagInput'

afterEach(() => cleanup())

const field = (c: HTMLElement) => c.querySelector('input') as HTMLInputElement
const tags = (c: HTMLElement) => c.querySelectorAll('[data-iris-tag-input-tag]')
const removes = (c: HTMLElement) => c.querySelectorAll('[data-iris-tag-input-remove]')

describe('@iris-ui/react IrisTagInput', () => {
  it('renders existing tags', () => {
    const { container } = render(<IrisTagInput value={['a', 'b']} />)
    expect(tags(container).length).toBe(2)
  })

  it('Enter commits a tag', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisTagInput onValueChange={onValueChange} />)
    fireEvent.change(field(container), { target: { value: 'foo' } })
    fireEvent.keyDown(field(container), { key: 'Enter' })
    expect(onValueChange).toHaveBeenLastCalledWith(['foo'])
  })

  it('a comma commits a tag', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisTagInput onValueChange={onValueChange} />)
    fireEvent.change(field(container), { target: { value: 'foo,' } })
    expect(onValueChange).toHaveBeenLastCalledWith(['foo'])
  })

  it('Backspace on an empty field removes the last tag', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisTagInput value={['a', 'b']} onValueChange={onValueChange} />)
    fireEvent.keyDown(field(container), { key: 'Backspace' })
    expect(onValueChange).toHaveBeenLastCalledWith(['a'])
  })

  it('the remove button removes its tag', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisTagInput value={['a', 'b']} onValueChange={onValueChange} />)
    fireEvent.click(removes(container)[0])
    expect(onValueChange).toHaveBeenLastCalledWith(['b'])
  })

  it('prevents duplicates by default', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisTagInput value={['foo']} onValueChange={onValueChange} />)
    fireEvent.change(field(container), { target: { value: 'foo' } })
    fireEvent.keyDown(field(container), { key: 'Enter' })
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('enforces max', () => {
    const onValueChange = vi.fn()
    const { container } = render(
      <IrisTagInput value={['a']} max={1} onValueChange={onValueChange} />,
    )
    fireEvent.change(field(container), { target: { value: 'b' } })
    fireEvent.keyDown(field(container), { key: 'Enter' })
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('a11y: remove buttons are labelled', () => {
    const { container } = render(<IrisTagInput value={['foo']} />)
    expect(removes(container)[0].getAttribute('aria-label')).toBe('Remove foo')
  })

  it('disabled input has disabled attribute', () => {
    const { container } = render(<IrisTagInput disabled />)
    expect(field(container).disabled).toBe(true)
  })

  it('controlled value updates through rerender', () => {
    const { container, rerender } = render(<IrisTagInput value={['a']} />)
    expect(tags(container).length).toBe(1)
    rerender(<IrisTagInput value={['a', 'b', 'c']} />)
    expect(tags(container).length).toBe(3)
  })

  it('empty value shows no tags', () => {
    const { container } = render(<IrisTagInput value={[]} />)
    expect(tags(container).length).toBe(0)
  })
})
