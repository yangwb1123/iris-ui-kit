import { createSignal, onCleanup } from 'solid-js'
import { usePluginStore } from '@iris-ui-kit/solid/provider'
import { resolveEditorSettings, type EditorLanguage, type EditorSettingsStore } from '../core'
import { EditorSurface } from './editor-surface'

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

/** CodeMirror 6 code editor for SolidJS over the shared editor core. */
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

  return (
    <EditorSurface
      value={props.value}
      defaultValue={props.defaultValue}
      language={activeLanguage}
      tabSize={activeTabSize}
      readOnly={() => props.readOnly ?? false}
      completions={props.completions}
      base={props.base}
      onChange={props.onChange}
      class={props.class}
    />
  )
}
