import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { IrisCodeEditor } from './index'

afterEach(cleanup)

describe('IrisCodeEditor (react)', () => {
  it('renders a CodeMirror editor with the initial value', () => {
    const { container } = render(<IrisCodeEditor defaultValue="SELECT 1" language="sql" />)
    const host = container.querySelector('[data-iris-code-editor]')
    expect(host).toBeTruthy()
    expect(host?.querySelector('.cm-editor')).toBeTruthy()
    expect(container.textContent).toContain('SELECT 1')
  })

  it('forwards className', () => {
    const { container } = render(<IrisCodeEditor className="my-editor" />)
    expect(container.querySelector('.my-editor')).toBeTruthy()
  })
})
