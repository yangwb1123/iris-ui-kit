import { describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { IrisToolbar } from './Toolbar'

describe('IrisToolbar', () => {
  it('renders a role="toolbar" with the orientation', () => {
    const { container } = render(
      <IrisToolbar ariaLabel="Text formatting">
        <button>B</button>
        <button>I</button>
      </IrisToolbar>,
    )
    const tb = container.querySelector('[role="toolbar"]')!
    expect(tb).not.toBeNull()
    expect(tb.getAttribute('aria-orientation')).toBe('horizontal')
    expect(tb.getAttribute('aria-label')).toBe('Text formatting')
  })

  it('sets roving tabindex on mount (first item tabbable, rest -1)', () => {
    const { container } = render(
      <IrisToolbar>
        <button>A</button>
        <button>B</button>
        <button>C</button>
      </IrisToolbar>,
    )
    const btns = container.querySelectorAll('button')
    expect(btns[0]!.tabIndex).toBe(0)
    expect(btns[1]!.tabIndex).toBe(-1)
    expect(btns[2]!.tabIndex).toBe(-1)
  })

  it('ArrowRight moves focus and the tab stop to the next item', () => {
    const { container } = render(
      <IrisToolbar>
        <button>A</button>
        <button>B</button>
      </IrisToolbar>,
    )
    const tb = container.querySelector('[role="toolbar"]')!
    const btns = container.querySelectorAll('button')
    btns[0]!.focus()
    fireEvent.keyDown(tb, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(btns[1])
    expect(btns[1]!.tabIndex).toBe(0)
    expect(btns[0]!.tabIndex).toBe(-1)
  })

  it('ArrowRight wraps from the last item back to the first', () => {
    const { container } = render(
      <IrisToolbar>
        <button>A</button>
        <button>B</button>
      </IrisToolbar>,
    )
    const tb = container.querySelector('[role="toolbar"]')!
    const btns = container.querySelectorAll('button')
    btns[1]!.focus()
    fireEvent.keyDown(tb, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(btns[0])
  })

  it('uses Up/Down arrows when vertical', () => {
    const { container } = render(
      <IrisToolbar orientation="vertical">
        <button>A</button>
        <button>B</button>
      </IrisToolbar>,
    )
    const tb = container.querySelector('[role="toolbar"]')!
    const btns = container.querySelectorAll('button')
    expect(tb.getAttribute('aria-orientation')).toBe('vertical')
    btns[0]!.focus()
    fireEvent.keyDown(tb, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(btns[1])
  })

  it('Home and End jump to the first and last items', () => {
    const { container } = render(
      <IrisToolbar>
        <button>A</button>
        <button>B</button>
        <button>C</button>
      </IrisToolbar>,
    )
    const tb = container.querySelector('[role="toolbar"]')!
    const btns = container.querySelectorAll('button')
    btns[0]!.focus()
    fireEvent.keyDown(tb, { key: 'End' })
    expect(document.activeElement).toBe(btns[2])
    fireEvent.keyDown(tb, { key: 'Home' })
    expect(document.activeElement).toBe(btns[0])
  })

  it('skips disabled items when assigning the initial tab stop', () => {
    const { container } = render(
      <IrisToolbar>
        <button disabled>A</button>
        <button>B</button>
      </IrisToolbar>,
    )
    const btns = container.querySelectorAll('button')
    // The disabled button is filtered out, so the first *enabled* item is tabbable.
    expect(btns[1]!.tabIndex).toBe(0)
  })
})
