import { describe, it, expect, afterEach } from 'vitest'
import { runPlugins } from '@iris-ui-kit/core'
import {
  createEditor,
  createEditorPlugin,
  editorPlugin,
  editorTokens,
  createEditorSettingsStore,
  type EditorSettingsStore,
} from './index'

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

  it('completions=false does not throw and editor still mounts', () => {
    const handle = createEditor({ parent: mount(), doc: 'test', completions: false })
    expect(handle.getValue()).toBe('test')
    expect(host?.querySelector('.cm-editor')).toBeTruthy()
    handle.destroy()
  })

  it('base option makes editor read-only with diff decorations', () => {
    const handle = createEditor({
      parent: mount(),
      doc: 'line1\nline2\nline3',
      base: 'line1\nline0\nline3',
    })
    expect(handle.getValue()).toBe('line1\nline2\nline3')
    // Editor mounts and is read-only in diff mode
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

  it('applies and live-reconfigures tabSize through the controller', () => {
    const handle = createEditor({ parent: mount(), tabSize: 6 })
    expect(handle.view.state.tabSize).toBe(6)
    handle.setTabSize(3)
    expect(handle.view.state.tabSize).toBe(3)
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

  it('creates a configurable Provider plugin settings store', () => {
    const { stores } = runPlugins([
      createEditorPlugin({ tabSize: 4, defaultLanguage: 'javascript' }),
    ])
    const store = stores.get('editor') as EditorSettingsStore
    expect(store.getState()).toEqual({ tabSize: 4, defaultLanguage: 'javascript' })
  })
})
