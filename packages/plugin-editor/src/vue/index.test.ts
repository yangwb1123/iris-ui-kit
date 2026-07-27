import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { IrisProvider } from '@iris-ui-kit/vue/provider'
import { createEditorPlugin } from '../core'
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

  it('consumes Provider defaultLanguage and tabSize when props are omitted', () => {
    const wrapper = mount(IrisProvider, {
      props: { plugins: [createEditorPlugin({ defaultLanguage: 'sql', tabSize: 6 })] },
      slots: { default: () => h(IrisCodeEditor, { defaultValue: 'SELECT 1' }) },
    })
    const host = wrapper.find('[data-iris-code-editor]')
    expect(host.attributes('data-language')).toBe('sql')
    expect(host.attributes('data-tab-size')).toBe('6')
    expect(host.find('.cm-editor').exists()).toBe(true)
    wrapper.unmount()
  })
})
