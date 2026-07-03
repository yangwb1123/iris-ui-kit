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

  it('toggles item open on Enter key (unmodified existing keyboard behavior)', () => {
    const { container } = render(() => (
      <IrisAccordion>
        <IrisAccordionItem value="a" title="Section A">
          Content A
        </IrisAccordionItem>
      </IrisAccordion>
    ))
    const trigger = container.querySelector('[data-iris-accordion-trigger]') as HTMLButtonElement
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('toggles item open on Space key (unmodified existing keyboard behavior)', () => {
    const { container } = render(() => (
      <IrisAccordion>
        <IrisAccordionItem value="a" title="Section A">
          Content A
        </IrisAccordionItem>
      </IrisAccordion>
    ))
    const trigger = container.querySelector('[data-iris-accordion-trigger]') as HTMLButtonElement
    fireEvent.keyDown(trigger, { key: ' ' })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  describe('roving-focus keyboard navigation (WAI-ARIA accordion pattern)', () => {
    function renderThree() {
      const utils = render(() => (
        <IrisAccordion>
          <IrisAccordionItem value="a" title="Section A">
            Content A
          </IrisAccordionItem>
          <IrisAccordionItem value="b" title="Section B">
            Content B
          </IrisAccordionItem>
          <IrisAccordionItem value="c" title="Section C">
            Content C
          </IrisAccordionItem>
        </IrisAccordion>
      ))
      const triggers = Array.from(
        utils.container.querySelectorAll('[data-iris-accordion-trigger]'),
      ) as HTMLButtonElement[]
      return { ...utils, triggers }
    }

    it('ArrowDown moves focus to the next header', () => {
      const { triggers } = renderThree()
      fireEvent.focus(triggers[0]!)
      fireEvent.keyDown(triggers[0]!, { key: 'ArrowDown' })
      expect(document.activeElement).toBe(triggers[1])
    })

    it('ArrowUp moves focus to the previous header', () => {
      const { triggers } = renderThree()
      fireEvent.focus(triggers[1]!)
      fireEvent.keyDown(triggers[1]!, { key: 'ArrowUp' })
      expect(document.activeElement).toBe(triggers[0])
    })

    it('ArrowDown wraps from the last header to the first (loop: true)', () => {
      const { triggers } = renderThree()
      fireEvent.focus(triggers[2]!)
      fireEvent.keyDown(triggers[2]!, { key: 'ArrowDown' })
      expect(document.activeElement).toBe(triggers[0])
    })

    it('ArrowUp wraps from the first header to the last (loop: true)', () => {
      const { triggers } = renderThree()
      fireEvent.focus(triggers[0]!)
      fireEvent.keyDown(triggers[0]!, { key: 'ArrowUp' })
      expect(document.activeElement).toBe(triggers[2])
    })

    it('Home jumps focus to the first header', () => {
      const { triggers } = renderThree()
      fireEvent.focus(triggers[2]!)
      fireEvent.keyDown(triggers[2]!, { key: 'Home' })
      expect(document.activeElement).toBe(triggers[0])
    })

    it('End jumps focus to the last header', () => {
      const { triggers } = renderThree()
      fireEvent.focus(triggers[0]!)
      fireEvent.keyDown(triggers[0]!, { key: 'End' })
      expect(document.activeElement).toBe(triggers[2])
    })
  })
})
