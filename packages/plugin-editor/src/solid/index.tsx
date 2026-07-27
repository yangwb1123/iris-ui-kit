import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { usePluginStore } from '@iris-ui-kit/solid/provider'
import {
  createEditor,
  resolveEditorSettings,
  type EditorHandle,
  type EditorLanguage,
  type EditorSettingsStore,
} from '../core'

export {
  createEditorPlugin,
  createEditorSettingsStore,
  editorPlugin,
  type EditorLanguage,
  type EditorSettings,
  type EditorSettingsStore,
} from '../core'

export interface IrisCodeEditorProps {
  value?: string
  defaultValue?: string
  language?: EditorLanguage
  tabSize?: number
  readOnly?: boolean
  completions?: boolean
  base?: string
  onChange?: (value: string) => void
  class?: string
}

/**
 * CodeMirror 6 code editor for SolidJS. Mounts {@link createEditor} once and
 * reconciles reactive props via `createEffect`.
 */
export function IrisCodeEditor(props: IrisCodeEditorProps) {
  let settingsStore: EditorSettingsStore | undefined
  try {
    settingsStore = usePluginStore<EditorSettingsStore>('editor')
  } catch {
    // Standalone editors remain supported when no Provider/editor plugin exists.
    settingsStore = undefined
  }
  const [settings, setSettings] = createSignal(settingsStore?.getState() ?? resolveEditorSettings())
  if (settingsStore) onCleanup(settingsStore.subscribe(setSettings))
  const activeLanguage = () => props.language ?? settings().defaultLanguage
  const activeTabSize = () => props.tabSize ?? settings().tabSize

  let host: HTMLDivElement | undefined
  let handle: EditorHandle | null = null

  onMount(() => {
    if (!host) return
    handle = createEditor({
      parent: host,
      doc: props.value ?? props.defaultValue ?? '',
      language: activeLanguage(),
      tabSize: activeTabSize(),
      readOnly: props.readOnly ?? false,
      completions: props.completions,
      base: props.base,
      onChange: (v) => props.onChange?.(v),
    })
  })

  onCleanup(() => {
    handle?.destroy()
    handle = null
  })

  createEffect(() => {
    const v = props.value
    if (v !== undefined && handle && handle.getValue() !== v) handle.setValue(v)
  })
  createEffect(() => {
    if (handle) handle.setLanguage(activeLanguage())
  })
  createEffect(() => {
    if (handle) handle.setTabSize(activeTabSize())
  })
  createEffect(() => {
    if (handle) handle.setReadOnly(props.readOnly ?? false)
  })

  return (
    <div
      ref={host}
      data-iris-code-editor=""
      data-language={activeLanguage()}
      data-tab-size={activeTabSize()}
      class={props.class}
    />
  )
}
