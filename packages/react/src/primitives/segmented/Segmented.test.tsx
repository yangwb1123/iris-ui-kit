import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisSegmented, type IrisSegmentedOption } from './Segmented'

afterEach(() => cleanup())

const OPTS: IrisSegmentedOption[] = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month', disabled: true },
]

const items = (c: HTMLElement) => c.querySelectorAll('[data-iris-segmented-item]')

describe('@iris-ui-kit/react IrisSegmented', () => {
  it('controlled value renders from the prop (reject → no flip; accept → flips)', () => {
    const onValueChange = vi.fn()
    function C({ value }: { value: string }) {
      return <IrisSegmented options={OPTS} value={value} onValueChange={onValueChange} />
    }
    const { container, rerender } = render(<C value="day" />)
    const seg = () => Array.from(container.querySelectorAll('[data-iris-segmented-item]'))
    fireEvent.click(seg()[1]!) // click "Week"
    expect(onValueChange).toHaveBeenLastCalledWith('week')
    // parent rejected → "Day" stays active, "Week" not
    expect(seg()[0]!.getAttribute('aria-checked')).toBe('true')
    expect(seg()[1]!.getAttribute('aria-checked')).toBe('false')
    rerender(<C value="week" />)
    expect(seg()[1]!.getAttribute('aria-checked')).toBe('true')
  })

  it('renders a radiogroup of segments', () => {
    const { container } = render(<IrisSegmented options={OPTS} />)
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull()
    expect(items(container).length).toBe(3)
  })

  it('accepts plain string options', () => {
    const { container } = render(<IrisSegmented options={['a', 'b']} />)
    expect(items(container).length).toBe(2)
    expect(items(container)[0].textContent).toBe('a')
  })

  it('marks the selected segment with aria-checked', () => {
    const { container } = render(<IrisSegmented options={OPTS} value="week" />)
    const sel = Array.from(items(container)).find((b) => b.getAttribute('aria-checked') === 'true')
    expect(sel?.textContent).toBe('Week')
  })

  it('clicking a segment selects it', () => {
    const onValueChange = vi.fn()
    const { container } = render(<IrisSegmented options={OPTS} onValueChange={onValueChange} />)
    fireEvent.click(items(container)[1])
    expect(onValueChange).toHaveBeenCalledWith('week')
  })

  it('Arrow keys move selection, skipping disabled (with wrap)', () => {
    const onValueChange = vi.fn()
    const { container } = render(
      <IrisSegmented options={OPTS} value="week" onValueChange={onValueChange} />,
    )
    fireEvent.keyDown(items(container)[1], { key: 'ArrowRight' })
    expect(onValueChange).toHaveBeenLastCalledWith('day')
  })

  it('disabled control ignores clicks', () => {
    const onValueChange = vi.fn()
    const { container } = render(
      <IrisSegmented options={OPTS} disabled onValueChange={onValueChange} />,
    )
    fireEvent.click(items(container)[0])
    expect(onValueChange).not.toHaveBeenCalled()
  })
})
