import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisButton } from './Button'
import { __resetButtonStyles, __BUTTON_STYLE_ID } from './styles'

afterEach(() => {
  cleanup()
  __resetButtonStyles()
})

describe('@iris-ui-kit/solid IrisButton', () => {
  it('renders a native button (render takes a FUNCTION in Solid)', () => {
    const { getByRole } = render(() => <IrisButton>Save</IrisButton>)
    const btn = getByRole('button')
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.getAttribute('type')).toBe('button')
    expect(btn.textContent).toContain('Save')
  })

  it('reflects variant + size via data attributes', () => {
    const { getByRole } = render(() => (
      <IrisButton variant="outline" size="lg">
        X
      </IrisButton>
    ))
    const btn = getByRole('button')
    expect(btn.getAttribute('data-iris-button-variant')).toBe('outline')
    expect(btn.getAttribute('data-iris-button-size')).toBe('lg')
  })

  it('fires onClick when interactive', () => {
    const onClick = vi.fn()
    const { getByRole } = render(() => <IrisButton onClick={onClick}>Go</IrisButton>)
    fireEvent.click(getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('swallows clicks when disabled or loading', () => {
    const onClick = vi.fn()
    const { getByRole, unmount } = render(() => (
      <IrisButton disabled onClick={onClick}>
        D
      </IrisButton>
    ))
    fireEvent.click(getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
    unmount()

    const { getByRole: getByRole2 } = render(() => (
      <IrisButton loading onClick={onClick}>
        L
      </IrisButton>
    ))
    fireEvent.click(getByRole2('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('sets aria-busy + disabled and shows a spinner when loading', () => {
    const { getByRole, container } = render(() => <IrisButton loading>L</IrisButton>)
    const btn = getByRole('button')
    expect(btn.getAttribute('aria-busy')).toBe('true')
    expect(btn.hasAttribute('disabled')).toBe(true)
    expect(container.querySelector('.iris-button-spinner')).not.toBeNull()
  })

  it('inline style references CSS variables', () => {
    const { getByRole } = render(() => <IrisButton variant="solid">X</IrisButton>)
    expect(getByRole('button').getAttribute('style') ?? '').toContain('var(--iris-primary)')
  })

  it('installs the singleton stylesheet once', () => {
    render(() => <IrisButton>A</IrisButton>)
    render(() => <IrisButton>B</IrisButton>)
    expect(document.querySelectorAll(`#${__BUTTON_STYLE_ID}`)).toHaveLength(1)
  })

  it('asChild merges button props onto one custom element with no wrapper', () => {
    const calls: string[] = []
    const { container, getByText } = render(() => (
      <IrisButton
        asChild
        id="save-link"
        class="parent"
        style={{ color: 'red', background: 'black' }}
        onClick={() => calls.push('button')}
      >
        <a
          href="/save"
          class="child"
          style={{ color: 'blue' }}
          onClick={(event) => {
            event.preventDefault()
            calls.push('child')
          }}
        >
          Save link
        </a>
      </IrisButton>
    ))

    const anchor = getByText('Save link')
    expect(container.children).toHaveLength(1)
    expect(anchor.tagName).toBe('A')
    expect(anchor.id).toBe('save-link')
    expect(anchor.className).toBe('iris-button parent child')
    expect(anchor.getAttribute('data-iris-button-variant')).toBe('solid')
    expect((anchor as HTMLElement).style.color).toBe('blue')
    expect((anchor as HTMLElement).style.background).toBe('black')
    fireEvent.click(anchor)
    expect(calls).toEqual(['button', 'child'])
  })

  it('asChild disabled intercepts the child click', () => {
    const childClick = vi.fn()
    const { getByText } = render(() => (
      <IrisButton asChild disabled>
        <a href="/blocked" onClick={childClick}>
          Disabled link
        </a>
      </IrisButton>
    ))

    fireEvent.click(getByText('Disabled link'))
    expect(childClick).not.toHaveBeenCalled()
  })
})
