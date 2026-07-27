import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTagInput } from './TagInput'

afterEach(() => cleanup())

const field = (c: HTMLElement) => c.querySelector('input') as HTMLInputElement
const tags = (c: HTMLElement) => c.querySelectorAll('[data-iris-tag-input-tag]')
const removes = (c: HTMLElement) => c.querySelectorAll('[data-iris-tag-input-remove]')

describe('@iris-ui-kit/react IrisTagInput', () => {
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

  it('trims committed text and clears the field', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisTagInput onValueChange={onValueChange} />)
    const input = field(container)

    fireEvent.change(input, { target: { value: '  release  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onValueChange).toHaveBeenLastCalledWith(['release'])
    expect(input.value).toBe('')
  })

  it('commits a pasted comma list and keeps the unfinished suffix', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisTagInput value={['stable']} onValueChange={onValueChange} />)

    fireEvent.change(field(container), {
      target: { value: ' alpha, stable, beta, unfinished' },
    })

    expect(onValueChange).toHaveBeenLastCalledWith(['stable', 'alpha', 'beta'])
    expect(field(container).value).toBe(' unfinished')
  })

  it('allows duplicate tags when requested', () => {
    const onValueChange = vi.fn()
    const { container } = render(
      <IrisTagInput value={['same']} allowDuplicates onValueChange={onValueChange} />,
    )

    fireEvent.change(field(container), { target: { value: 'same' } })
    fireEvent.keyDown(field(container), { key: 'Enter' })

    expect(onValueChange).toHaveBeenLastCalledWith(['same', 'same'])
  })

  it('updates its uncontrolled defaultValue when adding and removing tags', () => {
    const onValueChange = vi.fn()
    const { container } = render(
      <IrisTagInput defaultValue={['seed']} onValueChange={onValueChange} />,
    )

    fireEvent.change(field(container), { target: { value: 'next' } })
    fireEvent.keyDown(field(container), { key: 'Enter' })
    expect(Array.from(tags(container), (tag) => tag.getAttribute('data-value'))).toEqual([
      'seed',
      'next',
    ])

    fireEvent.click(removes(container)[0])
    expect(Array.from(tags(container), (tag) => tag.getAttribute('data-value'))).toEqual(['next'])
    expect(onValueChange).toHaveBeenLastCalledWith(['next'])
  })

  it('exposes invalid, focus and form-description states', () => {
    const { container } = render(
      <IrisTagInput invalid id="labels" ariaDescribedby="labels-error" />,
    )
    const root = container.querySelector('[data-iris-tag-input]') as HTMLElement
    const input = field(container)

    expect(root.dataset.state).toBe('invalid')
    expect(input.id).toBe('labels')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe('labels-error')

    fireEvent.focus(input)
    expect(root.dataset.state).toBe('invalid')
    fireEvent.blur(input)
    expect(root.dataset.state).toBe('invalid')
  })

  it('uses focused state when valid and only shows placeholder without tags', () => {
    const { container, rerender } = render(<IrisTagInput placeholder="Add label" />)
    const root = container.querySelector('[data-iris-tag-input]') as HTMLElement

    expect(field(container).placeholder).toBe('Add label')
    fireEvent.focus(field(container))
    expect(root.dataset.state).toBe('focused')
    fireEvent.blur(field(container))
    expect(root.dataset.state).toBe('idle')

    rerender(<IrisTagInput value={['present']} placeholder="Add label" />)
    expect(field(container).hasAttribute('placeholder')).toBe(false)
  })

  it('disables removal and forwards root presentation props', () => {
    const onValueChange = vi.fn()
    const { container } = render(
      <IrisTagInput
        value={['locked']}
        disabled
        className="custom-root"
        style={{ marginTop: 12 }}
        onValueChange={onValueChange}
      />,
    )
    const root = container.querySelector('[data-iris-tag-input]') as HTMLElement
    const remove = removes(container)[0] as HTMLButtonElement

    expect(root.className).toBe('custom-root')
    expect(root.style.marginTop).toBe('12px')
    expect(remove.disabled).toBe(true)
    fireEvent.click(remove)
    fireEvent.keyDown(field(container), { key: 'Backspace' })
    expect(onValueChange).not.toHaveBeenCalled()
  })
})
