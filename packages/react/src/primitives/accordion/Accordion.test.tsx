import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisAccordion } from './Accordion'
import { IrisAccordionItem } from './AccordionItem'

afterEach(() => cleanup())

function harness(props?: {
  value?: string | string[] | null
  defaultValue?: string | string[] | null
  multiple?: boolean
  collapsible?: boolean
  onValueChange?: (v: string | string[] | null) => void
}) {
  return (
    <IrisAccordion
      value={props?.value}
      defaultValue={props?.defaultValue}
      multiple={props?.multiple}
      collapsible={props?.collapsible}
      onValueChange={props?.onValueChange}
    >
      <IrisAccordionItem value="a" title="A">
        Panel A
      </IrisAccordionItem>
      <IrisAccordionItem value="b" title="B">
        Panel B
      </IrisAccordionItem>
      <IrisAccordionItem value="c" title="C" disabled>
        Panel C
      </IrisAccordionItem>
    </IrisAccordion>
  )
}

function triggers(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll('[data-iris-accordion-trigger]')) as HTMLButtonElement[]
}

function regions(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[role=region]'))
}

describe('@iris-ui/react IrisAccordion', () => {
  it('renders all triggers, no regions initially (single, no default)', () => {
    render(harness())
    expect(triggers().length).toBe(3)
    expect(regions().length).toBe(0)
  })

  it('clicking opens the item; clicking again does nothing (non-collapsible single)', () => {
    render(harness())
    const [a] = triggers()
    act(() => {
      fireEvent.click(a!)
    })
    expect(regions().length).toBe(1)
    act(() => {
      fireEvent.click(a!)
    })
    expect(regions().length).toBe(1)
  })

  it('collapsible single mode allows toggle to null', () => {
    const onChange = vi.fn()
    render(harness({ collapsible: true, defaultValue: 'a', onValueChange: onChange }))
    const [a] = triggers()
    act(() => {
      fireEvent.click(a!)
    })
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('aria-expanded reflects state', () => {
    render(harness({ defaultValue: 'b' }))
    const [a, b] = triggers()
    expect(a!.getAttribute('aria-expanded')).toBe('false')
    expect(b!.getAttribute('aria-expanded')).toBe('true')
  })

  it('aria-controls + region aria-labelledby match', () => {
    render(harness({ defaultValue: 'a' }))
    const [a] = triggers()
    const region = regions()[0]!
    expect(a!.getAttribute('aria-controls')).toBe(region.id)
    expect(region.getAttribute('aria-labelledby')).toBe(a!.id)
  })

  it('single mode replaces active', () => {
    render(harness({ defaultValue: 'a' }))
    const [, b] = triggers()
    act(() => {
      fireEvent.click(b!)
    })
    expect(regions().length).toBe(1)
    expect(regions()[0]?.textContent).toBe('Panel B')
  })

  it('multiple mode opens any number of items', () => {
    render(harness({ multiple: true, defaultValue: [] }))
    const [a, b] = triggers()
    act(() => {
      fireEvent.click(a!)
      fireEvent.click(b!)
    })
    expect(regions().length).toBe(2)
  })

  it('multiple mode toggle removes from array', () => {
    const onChange = vi.fn()
    render(harness({ multiple: true, defaultValue: ['a'], onValueChange: onChange }))
    const [a] = triggers()
    act(() => {
      fireEvent.click(a!)
    })
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('disabled item does not toggle', () => {
    const onChange = vi.fn()
    render(harness({ onValueChange: onChange }))
    const [, , c] = triggers()
    act(() => {
      fireEvent.click(c!)
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Enter triggers toggle', () => {
    render(harness())
    const [a] = triggers()
    a!.focus()
    act(() => {
      fireEvent.keyDown(a!, { key: 'Enter' })
    })
    expect(regions().length).toBe(1)
  })

  it('Space triggers toggle', () => {
    render(harness())
    const [a] = triggers()
    a!.focus()
    act(() => {
      fireEvent.keyDown(a!, { key: ' ' })
    })
    expect(regions().length).toBe(1)
  })

  it('controlled mode reflects external value prop', () => {
    const { rerender } = render(harness({ value: 'a' }))
    expect(regions().length).toBe(1)
    expect(regions()[0]?.textContent).toBe('Panel A')
    rerender(harness({ value: null }))
    expect(regions().length).toBe(0)
  })

  it('chevron rotates open vs closed', () => {
    render(harness({ defaultValue: 'a' }))
    const chevrons = document.querySelectorAll('[data-iris-accordion-chevron]')
    expect((chevrons[0] as HTMLElement).style.transform).toContain('rotate(180deg)')
    expect((chevrons[1] as HTMLElement).style.transform).toContain('rotate(0deg)')
  })

  it('Item outside provider throws', () => {
    const e = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <IrisAccordionItem value="x" title="x">
          x
        </IrisAccordionItem>,
      ),
    ).toThrow(/must be inside an <IrisAccordion>/)
    e.mockRestore()
  })
})
