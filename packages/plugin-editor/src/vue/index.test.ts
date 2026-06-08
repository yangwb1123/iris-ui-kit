import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisCodeEditor } from './index'

describe('IrisCodeEditor (vue)', () => {
  it('renders a CodeMirror editor with the initial value', async () => {
    const wrapper = mount(IrisCodeEditor, { props: { defaultValue: 'SELECT 1', language: 'sql' } })
    const host = wrapper.element as HTMLElement
    expect(host.matches('[data-iris-code-editor]')).toBe(true)
    expect(host.querySelector('.cm-editor')).toBeTruthy()
    expect(host.textContent).toContain('SELECT 1')
    wrapper.unmount()
  })
})
