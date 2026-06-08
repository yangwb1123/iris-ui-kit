import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisTagInput } from './IrisTagInput'

afterEach(cleanup)

describe('IrisTagInput', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisTagInput />)
    expect(container.querySelector('[data-iris-tag-input]')).not.toBeNull()
  })

  it('renders existing tags', () => {
    const { container } = render(() => <IrisTagInput value={['foo', 'bar']} />)
    const tags = container.querySelectorAll('[data-iris-tag-input-tag]')
    expect(tags.length).toBe(2)
  })

  it('adds a tag on Enter', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisTagInput onChange={onChange} />)
    const input = container.querySelector('[data-iris-tag-input-field]') as HTMLInputElement
    fireEvent.input(input, { target: { value: 'newtag' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['newtag'])
  })

  it('removes a tag on remove button click', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisTagInput value={['alpha', 'beta']} onChange={onChange} />
    ))
    const removeBtn = container.querySelector('[data-iris-tag-input-remove]') as HTMLButtonElement
    fireEvent.click(removeBtn)
    expect(onChange).toHaveBeenCalledWith(['beta'])
  })
})
