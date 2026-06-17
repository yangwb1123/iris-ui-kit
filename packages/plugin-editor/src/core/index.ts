import { EditorState, Compartment, type Extension } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from '@codemirror/view'
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  indentOnInput,
  bracketMatching,
} from '@codemirror/language'
import { sql } from '@codemirror/lang-sql'
import { json } from '@codemirror/lang-json'
import { javascript } from '@codemirror/lang-javascript'
import { createStore, createPlugin, type Store } from '@iris-ui/core'

/**
 * `@iris-ui/plugin-editor` — a dbgate-style code editor for Iris UI, built on
 * CodeMirror 6. This `core` entry is framework-agnostic: it owns the CM6
 * `EditorView` lifecycle behind a small imperative {@link EditorHandle}, plus
 * the {@link editorPlugin} (registers theme tokens + a shared settings store).
 * The react / vue / solid / svelte entries are ~40-line wrappers over it.
 */

export type EditorLanguage = 'sql' | 'json' | 'javascript' | 'plain'

function languageExtension(language: EditorLanguage): Extension {
  switch (language) {
    case 'sql':
      return sql()
    case 'json':
      return json()
    case 'javascript':
      return javascript()
    case 'plain':
    default:
      return []
  }
}

/** Static extensions shared by every editor instance (a trimmed basic-setup). */
function baseExtensions(completions: boolean): Extension[] {
  const exts: Extension[] = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
  ]
  if (completions) {
    exts.push(autocompletion(), closeBrackets())
    exts.push(keymap.of([...closeBracketsKeymap, ...completionKeymap]))
  }
  return exts
}

export interface CreateEditorOptions {
  /** Element the editor mounts into. */
  parent: HTMLElement
  /** Initial document text. */
  doc?: string
  /** Syntax-highlighting language. Default `'plain'`. */
  language?: EditorLanguage
  /** Render read-only (non-editable). Default `false`. */
  readOnly?: boolean
  /** Enable autocompletion popup. Default `true`. */
  completions?: boolean
  /** Called with the full document text whenever it changes. */
  onChange?: (value: string) => void
}

/** Imperative handle returned by {@link createEditor}. */
export interface EditorHandle {
  readonly view: EditorView
  /** Current document text. */
  getValue(): string
  /** Replace the document text (no-op if equal — preserves selection/history). */
  setValue(value: string): void
  /** Swap the language without recreating the editor (CM6 Compartment). */
  setLanguage(language: EditorLanguage): void
  /** Toggle read-only without recreating the editor. */
  setReadOnly(readOnly: boolean): void
  /** Tear down the CM6 view. */
  destroy(): void
}

/**
 * Create a CodeMirror 6 editor mounted in `options.parent`. Language and
 * read-only are held in Compartments so they can be reconfigured live.
 */
export function createEditor(options: CreateEditorOptions): EditorHandle {
  const languageComp = new Compartment()
  const readOnlyComp = new Compartment()

  const onChange = options.onChange
  const updateListener = onChange
    ? EditorView.updateListener.of((update) => {
        if (update.docChanged) onChange(update.state.doc.toString())
      })
    : []

  const state = EditorState.create({
    doc: options.doc ?? '',
    extensions: [
      ...baseExtensions(options.completions ?? true),
      languageComp.of(languageExtension(options.language ?? 'plain')),
      readOnlyComp.of(EditorState.readOnly.of(options.readOnly ?? false)),
      updateListener,
    ],
  })

  const view = new EditorView({ state, parent: options.parent })

  return {
    view,
    getValue: () => view.state.doc.toString(),
    setValue(value) {
      const current = view.state.doc.toString()
      if (current === value) return
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    },
    setLanguage(language) {
      view.dispatch({ effects: languageComp.reconfigure(languageExtension(language)) })
    },
    setReadOnly(readOnly) {
      view.dispatch({ effects: readOnlyComp.reconfigure(EditorState.readOnly.of(readOnly)) })
    },
    destroy() {
      view.destroy()
    },
  }
}

/** Shared editor preferences, exposed via `usePluginStore('editor')`. */
export interface EditorSettings {
  tabSize: number
  defaultLanguage: EditorLanguage
}

export type EditorSettingsStore = Store<EditorSettings>

export function createEditorSettingsStore(initial?: Partial<EditorSettings>): EditorSettingsStore {
  return createStore<EditorSettings>({
    tabSize: initial?.tabSize ?? 2,
    defaultLanguage: initial?.defaultLanguage ?? 'plain',
  })
}

/** CSS custom properties the editor reads; overridable by the host theme. */
export const editorTokens: Record<string, string> = {
  '--iris-editor-bg': '#1e1e1e',
  '--iris-editor-fg': '#d4d4d4',
  '--iris-editor-font': "13px/1.6 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  '--iris-editor-radius': '8px',
  '--iris-editor-border': '#33333a',
}

/**
 * The editor plugin. Pass to `<IrisProvider plugins={[editorPlugin]}>`. Registers
 * the editor theme tokens and a shared settings store under the key `'editor'`.
 */
export const editorPlugin = createPlugin({
  name: 'editor',
  install(registry) {
    registry.registerTokens(editorTokens)
    registry.registerStore('editor', () => createEditorSettingsStore())
  },
})
