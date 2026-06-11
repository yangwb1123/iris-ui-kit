import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSignal } from 'solid-js'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisToggleGroup, IrisToggleGroupItem } from './IrisToggleGroup'

afterEach(cleanup)

describe('IrisToggleGroup', () => {
  it('controlled value renders from the prop (reject → no flip; accept → flips)', () => {
    const onChange = vi.fn()
    const [value, setValue] = createSignal<string | null>(null)
    const { container } = render(() => (
      <IrisToggleGroup value={value()} onChange={onChange}>
        <IrisToggleGroupItem value="a">A</IrisToggleGroupItem>
        <IrisToggleGroupItem value="b">B</IrisToggleGroupItem>
      </IrisToggleGroup>
    ))
    const items = (): Element[] =>
      Array.from(container.querySelectorAll('[data-iris-toggle-group-item]'))
    fireEvent.click(items()[0] as HTMLButtonElement) // press A
    expect(onChange).toHaveBeenLastCalledWith('a')
    // parent rejected → item A stays off (true controlled)
    expect(items()[0]!.getAttribute('data-state')).toBe('off')
    // parent accepts → prop updates → item A reflects it
    setValue('a')
    expect(items()[0]!.getAttribute('data-state')).toBe('on')
  })

  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisToggleGroup>
        <IrisToggleGroupItem value="a">A</IrisToggleGroupItem>
      </IrisToggleGroup>
    ))
    expect(container.querySelector('[data-iris-toggle-group]')).not.toBeNull()
  })

  it('activates item on click (single mode)', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisToggleGroup onChange={onChange}>
        <IrisToggleGroupItem value="a">A</IrisToggleGroupItem>
        <IrisToggleGroupItem value="b">B</IrisToggleGroupItem>
      </IrisToggleGroup>
    ))
    const itemA = container.querySelector('[data-iris-toggle-group-item]') as HTMLButtonElement
    fireEvent.click(itemA)
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('multiple mode: can activate multiple items', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisToggleGroup type="multiple" onChange={onChange}>
        <IrisToggleGroupItem value="a">A</IrisToggleGroupItem>
        <IrisToggleGroupItem value="b">B</IrisToggleGroupItem>
      </IrisToggleGroup>
    ))
    const items = container.querySelectorAll('[data-iris-toggle-group-item]')
    fireEvent.click(items[0] as HTMLButtonElement)
    fireEvent.click(items[1] as HTMLButtonElement)
    // Both clicks trigger onChange; second call should have both
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('item with value matches controlled value shows active state', () => {
    const { container } = render(() => (
      <IrisToggleGroup value="b">
        <IrisToggleGroupItem value="a">A</IrisToggleGroupItem>
        <IrisToggleGroupItem value="b">B</IrisToggleGroupItem>
      </IrisToggleGroup>
    ))
    const items = container.querySelectorAll('[data-iris-toggle-group-item]')
    expect(items[1].getAttribute('data-state')).toBe('on')
    expect(items[0].getAttribute('data-state')).toBe('off')
  })
})
