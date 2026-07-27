import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisProvider } from '@iris-ui-kit/solid/provider'
import { createEditorPlugin } from '../core'
import { IrisCodeEditor } from './index'

afterEach(cleanup)

describe('IrisCodeEditor (solid)', () => {
  it('renders a CodeMirror editor with the initial value', () => {
    const { container } = render(() => <IrisCodeEditor defaultValue="SELECT 1" language="sql" />)
    const host = container.querySelector('[data-iris-code-editor]')
    expect(host).toBeTruthy()
    expect(host?.querySelector('.cm-editor')).toBeTruthy()
    expect(container.textContent).toContain('SELECT 1')
  })

  it('consumes Provider defaultLanguage and tabSize when props are omitted', () => {
    const plugin = createEditorPlugin({ defaultLanguage: 'sql', tabSize: 6 })
    const { container } = render(() => (
      <IrisProvider plugins={[plugin]}>
        <IrisCodeEditor defaultValue="SELECT 1" />
      </IrisProvider>
    ))
    const host = container.querySelector('[data-iris-code-editor]')!
    expect(host.getAttribute('data-language')).toBe('sql')
    expect(host.getAttribute('data-tab-size')).toBe('6')
    expect(host.querySelector('.cm-editor')).toBeTruthy()
  })
})
