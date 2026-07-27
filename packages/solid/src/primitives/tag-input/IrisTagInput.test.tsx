import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisTagInput } from './IrisTagInput'

afterEach(cleanup)

function field(container: HTMLElement): HTMLInputElement {
  return container.querySelector('[data-iris-tag-input-field]') as HTMLInputElement
}

function root(container: HTMLElement): HTMLDivElement {
  return container.querySelector('[data-iris-tag-input]') as HTMLDivElement
}

function tagValues(container: HTMLElement): (string | null)[] {
  return Array.from(container.querySelectorAll('[data-iris-tag-input-tag]'), (tag) =>
    tag.getAttribute('data-value'),
  )
}

function removeButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('[data-iris-tag-input-remove]'))
}

describe('IrisTagInput', () => {
  it('renders controlled tags in order with labelled remove buttons', () => {
    const { container } = render(() => <IrisTagInput value={['foo', 'bar']} />)
    expect(tagValues(container)).toEqual(['foo', 'bar'])
    expect(removeButtons(container).map((button) => button.ariaLabel)).toEqual([
      'Remove foo',
      'Remove bar',
    ])
  })

  it('shows the placeholder only while there are no tags', () => {
    const empty = render(() => <IrisTagInput placeholder="Add skill" />)
    expect(field(empty.container).placeholder).toBe('Add skill')

    cleanup()
    const filled = render(() => <IrisTagInput value={['Solid']} placeholder="Add skill" />)
    expect(field(filled.container).placeholder).toBe('')
  })

  it('trims and commits a tag on Enter', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisTagInput onChange={onChange} />)
    fireEvent.input(field(container), { target: { value: '  newtag  ' } })
    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    field(container).dispatchEvent(enter)

    expect(onChange).toHaveBeenCalledWith(['newtag'])
    expect(tagValues(container)).toEqual(['newtag'])
    expect(field(container).value).toBe('')
    expect(enter.defaultPrevented).toBe(true)
  })

  it('does not emit an empty or whitespace-only tag', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisTagInput onChange={onChange} />)
    fireEvent.input(field(container), { target: { value: '   ' } })
    fireEvent.keyDown(field(container), { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
    expect(field(container).value).toBe('')
  })

  it('accumulates multiple tags in uncontrolled mode', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisTagInput onChange={onChange} />)
    fireEvent.input(field(container), { target: { value: 'alpha' } })
    fireEvent.keyDown(field(container), { key: 'Enter' })
    fireEvent.input(field(container), { target: { value: 'beta' } })
    fireEvent.keyDown(field(container), { key: 'Enter' })

    expect(onChange).toHaveBeenNthCalledWith(1, ['alpha'])
    expect(onChange).toHaveBeenNthCalledWith(2, ['alpha', 'beta'])
    expect(tagValues(container)).toEqual(['alpha', 'beta'])
  })

  it('controlled mode reports a proposed value without mutating rendered tags', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisTagInput value={['alpha']} onChange={onChange} />)
    fireEvent.input(field(container), { target: { value: 'beta' } })
    fireEvent.keyDown(field(container), { key: 'Enter' })

    expect(onChange).toHaveBeenLastCalledWith(['alpha', 'beta'])
    expect(tagValues(container)).toEqual(['alpha'])
  })

  it('reacts when a controlled tag list changes', () => {
    const [value, setValue] = createSignal(['alpha'])
    const { container } = render(() => <IrisTagInput value={value()} />)
    setValue(['beta', 'gamma'])
    expect(tagValues(container)).toEqual(['beta', 'gamma'])
  })

  it('commits every completed comma-delimited segment and keeps the tail', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisTagInput onChange={onChange} />)
    fireEvent.input(field(container), { target: { value: ' alpha, beta,tail' } })

    expect(onChange).toHaveBeenLastCalledWith(['alpha', 'beta'])
    expect(tagValues(container)).toEqual(['alpha', 'beta'])
    expect(field(container).value).toBe('tail')
  })

  it('deduplicates entries within one comma-delimited batch', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisTagInput onChange={onChange} />)
    fireEvent.input(field(container), { target: { value: 'foo,foo,bar,' } })
    expect(onChange).toHaveBeenLastCalledWith(['foo', 'bar'])
    expect(tagValues(container)).toEqual(['foo', 'bar'])
  })

  it('prevents duplicates by default and clears the attempted input', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisTagInput value={['foo']} onChange={onChange} />)
    fireEvent.input(field(container), { target: { value: 'foo' } })
    fireEvent.keyDown(field(container), { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
    expect(field(container).value).toBe('')
  })

  it('allows duplicates when explicitly enabled', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisTagInput value={['foo']} allowDuplicates onChange={onChange} />
    ))
    fireEvent.input(field(container), { target: { value: 'foo' } })
    fireEvent.keyDown(field(container), { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith(['foo', 'foo'])
  })

  it('enforces max across a comma-delimited batch', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisTagInput defaultValue={['seed']} max={3} onChange={onChange} />
    ))
    fireEvent.input(field(container), { target: { value: 'one,two,three,' } })
    expect(onChange).toHaveBeenLastCalledWith(['seed', 'one', 'two'])
    expect(tagValues(container)).toEqual(['seed', 'one', 'two'])
  })

  it('blocks Enter additions after reaching max', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisTagInput value={['only']} max={1} onChange={onChange} />
    ))
    fireEvent.input(field(container), { target: { value: 'extra' } })
    fireEvent.keyDown(field(container), { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('removes the clicked tag by index', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisTagInput value={['alpha', 'beta', 'gamma']} onChange={onChange} />
    ))
    fireEvent.click(removeButtons(container)[1]!)
    expect(onChange).toHaveBeenLastCalledWith(['alpha', 'gamma'])
  })

  it('Backspace on an empty field removes the final tag', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisTagInput value={['alpha', 'beta']} onChange={onChange} />
    ))
    const backspace = new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
      cancelable: true,
    })
    field(container).dispatchEvent(backspace)
    expect(onChange).toHaveBeenLastCalledWith(['alpha'])
    expect(backspace.defaultPrevented).toBe(true)
  })

  it('does not remove a tag when Backspace edits non-empty text', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisTagInput value={['alpha']} onChange={onChange} />)
    fireEvent.input(field(container), { target: { value: 'draft' } })
    fireEvent.keyDown(field(container), { key: 'Backspace' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('tracks focus and invalid state for styling and accessibility', () => {
    const { container } = render(() => <IrisTagInput invalid />)
    expect(root(container).getAttribute('data-state')).toBe('invalid')
    expect(field(container).getAttribute('aria-invalid')).toBe('true')
    expect(root(container).style.border).toContain('var(--iris-danger)')

    cleanup()
    const focused = render(() => <IrisTagInput />)
    fireEvent.focus(field(focused.container))
    expect(root(focused.container).getAttribute('data-state')).toBe('focused')
    fireEvent.blur(field(focused.container))
    expect(root(focused.container).getAttribute('data-state')).toBe('idle')
  })

  it('forwards form wiring, class, and object style props', () => {
    const { container } = render(() => (
      <IrisTagInput
        id="skills"
        ariaDescribedby="skills-help"
        class="custom-tags"
        style={{ width: '320px' }}
      />
    ))
    expect(field(container).id).toBe('skills')
    expect(field(container).getAttribute('aria-describedby')).toBe('skills-help')
    expect(root(container).classList.contains('custom-tags')).toBe(true)
    expect(root(container).style.width).toBe('320px')
  })

  it('disabled state blocks input and removal', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisTagInput value={['locked']} disabled onChange={onChange} />
    ))
    expect(field(container).disabled).toBe(true)
    expect(removeButtons(container)[0]!.disabled).toBe(true)

    fireEvent.click(removeButtons(container)[0]!)
    fireEvent.keyDown(field(container), { key: 'Backspace' })
    expect(onChange).not.toHaveBeenCalled()
  })
})
