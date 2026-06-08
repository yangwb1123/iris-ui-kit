import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
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
})
