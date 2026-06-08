import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisSegmented } from './IrisSegmented'

afterEach(cleanup)

describe('IrisSegmented', () => {
  const options = ['Day', 'Week', 'Month']

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
})
