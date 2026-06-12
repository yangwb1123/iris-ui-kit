import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { setClipboardHandler } from '@iris-ui/core'
import { IrisCopyButton } from './CopyButton'

afterEach(() => {
  vi.useRealTimers()
  setClipboardHandler(null)
})

const btn = (w: ReturnType<typeof mount>) => w.find('[data-iris-copy-button]')

describe('IrisCopyButton', () => {
  it('renders the default copy label', () => {
    const w = mount(IrisCopyButton, { props: { text: 'hi' } })
    expect(btn(w).text()).toBe('Copy')
  })

  it('copies the text and shows the copied state', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const w = mount(IrisCopyButton, { props: { text: 'hello' } })
    await btn(w).trigger('click')
    expect(writeText).toHaveBeenCalledWith('hello')
    expect(w.emitted('copy')?.[0]).toEqual(['hello'])
    expect(btn(w).attributes('data-copied')).toBe('true')
    expect(btn(w).text()).toBe('Copied')
  })

  it('routes the copy through a host clipboard handler, skipping navigator.clipboard', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const handler = vi.fn()
    setClipboardHandler(handler)
    const w = mount(IrisCopyButton, { props: { text: 'hello' } })
    await btn(w).trigger('click')
    expect(handler).toHaveBeenCalledWith('hello')
    expect(writeText).not.toHaveBeenCalled()
    expect(w.emitted('copy')?.[0]).toEqual(['hello'])
    expect(btn(w).attributes('data-copied')).toBe('true')
  })

  it('falls through to navigator.clipboard when the handler declines', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    setClipboardHandler(() => false)
    const w = mount(IrisCopyButton, { props: { text: 'x' } })
    await btn(w).trigger('click')
    expect(writeText).toHaveBeenCalledWith('x')
  })

  it('reverts after the timeout', async () => {
    vi.useFakeTimers()
    const w = mount(IrisCopyButton, { props: { text: 'x', timeout: 1000 } })
    await btn(w).trigger('click')
    expect(btn(w).attributes('data-copied')).toBe('true')
    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(btn(w).attributes('data-copied')).toBeUndefined()
  })

  it('disabled does nothing', async () => {
    const w = mount(IrisCopyButton, { props: { text: 'x', disabled: true } })
    await btn(w).trigger('click')
    expect(w.emitted('copy')).toBeUndefined()
  })

  it('renders custom slot content', () => {
    const w = mount(IrisCopyButton, { props: { text: 'x' }, slots: { default: 'Copy URL' } })
    expect(btn(w).text()).toBe('Copy URL')
  })
})
