import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisCascader } from './IrisCascader'

afterEach(cleanup)

const options = [
  {
    label: 'Fruits',
    value: 'fruits',
    children: [
      { label: 'Apple', value: 'apple' },
      { label: 'Banana', value: 'banana' },
    ],
  },
  {
    label: 'Vegetables',
    value: 'vegetables',
    children: [{ label: 'Carrot', value: 'carrot' }],
  },
]

describe('IrisCascader', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisCascader options={options} />)
    expect(container.querySelector('[data-iris-cascader]')).not.toBeNull()
  })

  it('opens dropdown on trigger click', () => {
    const { container } = render(() => <IrisCascader options={options} />)
    const trigger = container.querySelector('[data-iris-cascader-trigger]') as HTMLButtonElement
    expect(container.querySelector('[data-iris-cascader-dropdown]')).toBeNull()
    fireEvent.click(trigger)
    expect(container.querySelector('[data-iris-cascader-dropdown]')).not.toBeNull()
  })

  it('trigger has aria-haspopup=listbox and opens on ArrowDown / closes on Escape', () => {
    const { container } = render(() => <IrisCascader options={options} />)
    const trigger = container.querySelector('[data-iris-cascader-trigger]') as HTMLButtonElement
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(container.querySelector('[data-iris-cascader-dropdown]')).not.toBeNull()
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(container.querySelector('[data-iris-cascader-dropdown]')).toBeNull()
  })

  it('shows first level options when open', () => {
    const { container } = render(() => <IrisCascader options={options} />)
    const trigger = container.querySelector('[data-iris-cascader-trigger]') as HTMLButtonElement
    fireEvent.click(trigger)
    const optionEls = container.querySelectorAll('[data-iris-cascader-option]')
    expect(optionEls.length).toBeGreaterThanOrEqual(2)
  })

  it('calls onChange when leaf selected', () => {
    const onChange = vi.fn()
    const leafOptions = [{ label: 'Direct', value: 'direct' }]
    const { container } = render(() => <IrisCascader options={leafOptions} onChange={onChange} />)
    const trigger = container.querySelector('[data-iris-cascader-trigger]') as HTMLButtonElement
    fireEvent.click(trigger)
    const opt = container.querySelector('[data-iris-cascader-option="direct"]') as HTMLElement
    fireEvent.click(opt)
    expect(onChange).toHaveBeenCalledWith(['direct'])
  })
})
