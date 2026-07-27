import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import IrisCodeEditor from './IrisCodeEditor.svelte'
import EditorProviderHarness from './EditorProviderHarness.svelte'

describe('IrisCodeEditor (svelte)', () => {
  it('renders a CodeMirror editor with the initial value', () => {
    const { container } = render(IrisCodeEditor, {
      props: { defaultValue: 'SELECT 1', language: 'sql' },
    })
    const host = container.querySelector('[data-iris-code-editor]')
    expect(host).toBeTruthy()
    expect(host?.querySelector('.cm-editor')).toBeTruthy()
    expect(container.textContent).toContain('SELECT 1')
  })

  it('consumes Provider defaultLanguage and tabSize when props are omitted', () => {
    const { container } = render(EditorProviderHarness)
    const host = container.querySelector('[data-iris-code-editor]')!
    expect(host.getAttribute('data-language')).toBe('sql')
    expect(host.getAttribute('data-tab-size')).toBe('6')
    expect(host.querySelector('.cm-editor')).toBeTruthy()
  })
})
