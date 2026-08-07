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
import { createStore, createPlugin, type Store } from '@iris-ui-kit/core'
import { diffViewPlugin } from './diff-extension'

/**
 * `@iris-ui-kit/plugin-editor` — a dbgate-style code editor for Iris UI, built on
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
  /** Tab width in columns. Default `2`. */
  tabSize?: number
  /** Render read-only (non-editable). Default `false`. */
  readOnly?: boolean
  /** Enable autocompletion popup. Default `true`. */
  completions?: boolean
  /** Base text for inline diff view. When set, the editor enters read-only
   *  diff mode, highlighting added (green) and modified (yellow) lines. */
  base?: string
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
  /** Change tab width without recreating the editor. */
  setTabSize(tabSize: number): void
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
  const tabSizeComp = new Compartment()

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
      tabSizeComp.of(EditorState.tabSize.of(normalizeTabSize(options.tabSize))),
      readOnlyComp.of(
        EditorState.readOnly.of(options.base !== undefined || (options.readOnly ?? false)),
      ),
      ...(options.base ? [diffViewPlugin(options.base)] : []),
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
    setTabSize(tabSize) {
      view.dispatch({
        effects: tabSizeComp.reconfigure(EditorState.tabSize.of(normalizeTabSize(tabSize))),
      })
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

function normalizeTabSize(tabSize: number | undefined): number {
  if (!Number.isFinite(tabSize)) return 2
  return Math.max(1, Math.min(16, Math.round(tabSize!)))
}

export function resolveEditorSettings(settings?: Partial<EditorSettings>): EditorSettings {
  return {
    tabSize: normalizeTabSize(settings?.tabSize),
    defaultLanguage: settings?.defaultLanguage ?? 'plain',
  }
}

export function createEditorSettingsStore(initial?: Partial<EditorSettings>): EditorSettingsStore {
  return createStore<EditorSettings>(resolveEditorSettings(initial))
}

/** CSS custom properties the editor reads; overridable by the host theme. */
export const editorTokens: Record<string, string> = {
  // Consumed by diff-extension.ts (CM6 diff decorations). Editor chrome is
  // styled by CM6's own theme, so --iris-editor-bg/fg/font/radius/border stay
  // unregistered (§6c — no dead registrations).
  '--iris-editor-diff-added-bg': 'rgba(40, 160, 80, 0.15)',
  '--iris-editor-diff-removed-bg': 'rgba(220, 60, 60, 0.12)',
}

export type { DiffLine, DiffKind } from './diff'
export { computeDiff } from './diff'
export { diffViewPlugin, setDiffBase } from './diff-extension'

/**
 * The editor plugin. Pass to `<IrisProvider plugins={[editorPlugin]}>`. Registers
 * the editor theme tokens and a shared settings store under the key `'editor'`.
 */
export function createEditorPlugin(initial?: Partial<EditorSettings>) {
  return createPlugin({
    name: 'editor',
    install(registry) {
      registry.registerTokens(editorTokens)
      registry.registerStore('editor', () => createEditorSettingsStore(initial))
    },
  })
}

export const editorPlugin = createEditorPlugin()
