import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisClickOutside } from './ClickOutside'
import { IrisHotkey } from './Hotkey'
import { IrisMovable } from './Movable'
import { IrisResizable } from './Resizable'

afterEach(cleanup)

describe('IrisClickOutside', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisClickOutside>
        <div>content</div>
      </IrisClickOutside>
    ))
    expect(container.querySelector('[data-iris-click-outside]')).not.toBeNull()
  })
})

describe('IrisHotkey', () => {
  it('renders children without crashing', () => {
    const { getByText } = render(() => (
      <IrisHotkey shortcut="Escape">
        <span>child</span>
      </IrisHotkey>
    ))
    expect(getByText('child')).not.toBeNull()
  })
})

describe('IrisMovable', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisMovable>
        <div>drag me</div>
      </IrisMovable>
    ))
    expect(container.querySelector('[data-iris-movable]')).not.toBeNull()
  })
})

describe('IrisResizable', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisResizable>
        <div>content</div>
      </IrisResizable>
    ))
    expect(container.querySelector('[data-iris-resizable]')).not.toBeNull()
  })

  it('renders resize handles', () => {
    const { container } = render(() => (
      <IrisResizable handles={['right', 'bottom']}>
        <div>content</div>
      </IrisResizable>
    ))
    expect(container.querySelector('[data-iris-resizable-handle="right"]')).not.toBeNull()
    expect(container.querySelector('[data-iris-resizable-handle="bottom"]')).not.toBeNull()
  })
})
