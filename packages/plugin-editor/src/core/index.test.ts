import { describe, it, expect, afterEach } from 'vitest'
import { runPlugins } from '@iris-ui/core'
import { createEditor, editorPlugin, editorTokens, createEditorSettingsStore } from './index'

let host: HTMLDivElement | null = null

afterEach(() => {
  host?.remove()
  host = null
})

function mount(): HTMLDivElement {
  host = document.createElement('div')
  document.body.appendChild(host)
  return host
}

describe('createEditor', () => {
  it('mounts a CodeMirror view and reads the initial doc', () => {
    const handle = createEditor({ parent: mount(), doc: 'SELECT 1', language: 'sql' })
    expect(handle.getValue()).toBe('SELECT 1')
    expect(host?.querySelector('.cm-editor')).toBeTruthy()
    handle.destroy()
  })

  it('setValue replaces the document', () => {
    const handle = createEditor({ parent: mount(), doc: 'a' })
    handle.setValue('b')
    expect(handle.getValue()).toBe('b')
    handle.destroy()
  })

  it('fires onChange when the doc changes', () => {
    const seen: string[] = []
    const handle = createEditor({ parent: mount(), doc: '', onChange: (v) => seen.push(v) })
    handle.setValue('typed')
    expect(seen).toContain('typed')
    handle.destroy()
  })

  it('setLanguage / setReadOnly do not throw', () => {
    const handle = createEditor({ parent: mount(), doc: '{}', language: 'json' })
    expect(() => handle.setLanguage('javascript')).not.toThrow()
    expect(() => handle.setReadOnly(true)).not.toThrow()
    handle.destroy()
  })
})

describe('editorPlugin', () => {
  it('registers editor tokens and an editor store', () => {
    const { tokens, stores } = runPlugins([editorPlugin])
    expect(tokens['--iris-editor-bg']).toBe(editorTokens['--iris-editor-bg'])
    expect(stores.has('editor')).toBe(true)
  })

  it('settings store has defaults', () => {
    const store = createEditorSettingsStore()
    expect(store.getState().tabSize).toBe(2)
    expect(store.getState().defaultLanguage).toBe('plain')
  })
})
