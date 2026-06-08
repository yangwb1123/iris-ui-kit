import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import IrisCodeEditor from './IrisCodeEditor.svelte'

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
})
