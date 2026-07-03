import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisSegmented } from './IrisSegmented'

afterEach(cleanup)

describe('IrisSegmented', () => {
  const options = ['Day', 'Week', 'Month']

  it('controlled value renders from the prop (reject → no flip; accept → flips)', () => {
    const onChange = vi.fn()
    const [value, setValue] = createSignal('Day')
    const { container } = render(() => (
      <IrisSegmented options={options} value={value()} onChange={onChange} />
    ))
    const seg = (): Element[] =>
      Array.from(container.querySelectorAll('[data-iris-segmented-item]'))
    fireEvent.click(seg()[1] as HTMLButtonElement) // click "Week"
    expect(onChange).toHaveBeenLastCalledWith('Week')
    // parent rejected → "Day" stays active, "Week" not (true controlled)
    expect(seg()[0]!.getAttribute('aria-checked')).toBe('true')
    expect(seg()[1]!.getAttribute('aria-checked')).toBe('false')
    // parent accepts → prop updates → the segment reflects it
    setValue('Week')
    expect(seg()[1]!.getAttribute('aria-checked')).toBe('true')
    expect(seg()[0]!.getAttribute('aria-checked')).toBe('false')
  })

  it('renders all options', () => {
    const { container } = render(() => <IrisSegmented options={options} />)
    expect(container.querySelectorAll('[data-iris-segmented-item]').length).toBe(3)
  })

  it('marks selected option', () => {
    const { container } = render(() => <IrisSegmented options={options} value="Week" />)
    const selected = container.querySelector('[data-selected="true"]')!
    expect(selected.textContent).toBe('Week')
  })

  it('fires onChange when option is clicked', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisSegmented options={options} onChange={onChange} />)
    const btns = container.querySelectorAll('[data-iris-segmented-item]')
    fireEvent.click(btns[1] as HTMLButtonElement)
    expect(onChange).toHaveBeenCalledWith('Week')
  })

  it('has radiogroup role', () => {
    const { container } = render(() => <IrisSegmented options={options} />)
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull()
  })

  describe('keyboard navigation', () => {
    it('ArrowRight moves to the next option', () => {
      const onChange = vi.fn()
      const { container } = render(() => <IrisSegmented options={options} onChange={onChange} />)
      const btns = container.querySelectorAll('[data-iris-segmented-item]')
      fireEvent.keyDown(btns[0] as HTMLButtonElement, { key: 'ArrowRight' })
      expect(onChange).toHaveBeenCalledWith('Week')
    })

    it('ArrowLeft moves to the previous option', () => {
      const onChange = vi.fn()
      const { container } = render(() => (
        <IrisSegmented options={options} value="Week" onChange={onChange} />
      ))
      const btns = container.querySelectorAll('[data-iris-segmented-item]')
      fireEvent.keyDown(btns[1] as HTMLButtonElement, { key: 'ArrowLeft' })
      expect(onChange).toHaveBeenCalledWith('Day')
    })

    it('ArrowDown moves to the next option', () => {
      const onChange = vi.fn()
      const { container } = render(() => <IrisSegmented options={options} onChange={onChange} />)
      const btns = container.querySelectorAll('[data-iris-segmented-item]')
      fireEvent.keyDown(btns[0] as HTMLButtonElement, { key: 'ArrowDown' })
      expect(onChange).toHaveBeenCalledWith('Week')
    })

    it('ArrowUp moves to the previous option', () => {
      const onChange = vi.fn()
      const { container } = render(() => (
        <IrisSegmented options={options} value="Week" onChange={onChange} />
      ))
      const btns = container.querySelectorAll('[data-iris-segmented-item]')
      fireEvent.keyDown(btns[1] as HTMLButtonElement, { key: 'ArrowUp' })
      expect(onChange).toHaveBeenCalledWith('Day')
    })

    it('Home moves to the first option', () => {
      const onChange = vi.fn()
      const { container } = render(() => (
        <IrisSegmented options={options} value="Month" onChange={onChange} />
      ))
      const btns = container.querySelectorAll('[data-iris-segmented-item]')
      fireEvent.keyDown(btns[2] as HTMLButtonElement, { key: 'Home' })
      expect(onChange).toHaveBeenCalledWith('Day')
    })

    it('End moves to the last option', () => {
      const onChange = vi.fn()
      const { container } = render(() => (
        <IrisSegmented options={options} value="Day" onChange={onChange} />
      ))
      const btns = container.querySelectorAll('[data-iris-segmented-item]')
      fireEvent.keyDown(btns[0] as HTMLButtonElement, { key: 'End' })
      expect(onChange).toHaveBeenCalledWith('Month')
    })
  })
})
