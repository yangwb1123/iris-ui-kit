import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisAccordion, IrisAccordionItem } from './IrisAccordion'

afterEach(cleanup)

describe('IrisAccordion', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisAccordion>
        <IrisAccordionItem value="a" title="Section A">
          Content A
        </IrisAccordionItem>
      </IrisAccordion>
    ))
    expect(container.querySelector('[data-iris-accordion]')).not.toBeNull()
  })

  it('toggles item open on trigger click (uncontrolled)', () => {
    const { container } = render(() => (
      <IrisAccordion>
        <IrisAccordionItem value="a" title="Section A">
          Content A
        </IrisAccordionItem>
      </IrisAccordion>
    ))
    const trigger = container.querySelector('[data-iris-accordion-trigger]') as HTMLButtonElement
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[data-iris-accordion-content]')).not.toBeNull()
  })

  it('calls onChange when item toggled', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisAccordion onChange={onChange}>
        <IrisAccordionItem value="a" title="Section A">
          Content
        </IrisAccordionItem>
      </IrisAccordion>
    ))
    const trigger = container.querySelector('[data-iris-accordion-trigger]') as HTMLButtonElement
    fireEvent.click(trigger)
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('supports multiple mode: multiple items open simultaneously', () => {
    const { container } = render(() => (
      <IrisAccordion multiple>
        <IrisAccordionItem value="a" title="A">
          A content
        </IrisAccordionItem>
        <IrisAccordionItem value="b" title="B">
          B content
        </IrisAccordionItem>
      </IrisAccordion>
    ))
    const triggers = container.querySelectorAll('[data-iris-accordion-trigger]')
    fireEvent.click(triggers[0] as HTMLButtonElement)
    fireEvent.click(triggers[1] as HTMLButtonElement)
    expect(container.querySelectorAll('[data-iris-accordion-content]').length).toBe(2)
  })

  it('controlled: opens item when value matches', () => {
    const { container } = render(() => (
      <IrisAccordion value="a">
        <IrisAccordionItem value="a" title="A">
          Content
        </IrisAccordionItem>
      </IrisAccordion>
    ))
    expect(container.querySelector('[data-iris-accordion-content]')).not.toBeNull()
  })
})
