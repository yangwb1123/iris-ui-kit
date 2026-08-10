import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { IrisCompose } from './Compose'

describe('IrisCompose (capability composition interface)', () => {
  it('renders children unchanged when no capabilities are enabled', () => {
    const { container } = render(
      <IrisCompose>
        <button type="button">plain</button>
      </IrisCompose>,
    )
    expect(container.querySelector('button')?.textContent).toBe('plain')
    expect(container.querySelector('[data-iris-resizable]')).toBeNull()
  })

  it('wraps with resizable when configured', () => {
    const { container } = render(
      <IrisCompose resizable={{ defaultSize: { width: 200, height: 100 } }}>
        <div>box</div>
      </IrisCompose>,
    )
    expect(container.querySelector('[data-iris-resizable]')).not.toBeNull()
  })

  it('binds hotkey and clickOutside through one interface', () => {
    const onTrigger = vi.fn()
    const onOutside = vi.fn()
    render(
      <IrisCompose hotkey={{ shortcut: 'Mod+k', onTrigger }} clickOutside={{ onOutside }}>
        <div>panel</div>
      </IrisCompose>,
    )
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true })
    expect(onTrigger).toHaveBeenCalled()
  })

  it('composes sortable + resizable together (no new component needed)', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <IrisCompose
        sortable={{ items: ['a', 'b'], onReorder }}
        resizable={{ defaultSize: { width: 160, height: 120 } }}
      >
        <div>list</div>
      </IrisCompose>,
    )
    expect(container.querySelector('[data-iris-sortable]')).not.toBeNull()
    expect(container.querySelector('[data-iris-resizable]')).not.toBeNull()
  })
})
