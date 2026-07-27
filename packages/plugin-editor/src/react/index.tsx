import * as React from 'react'
import { PluginStoreContext } from '@iris-ui-kit/react/provider'
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

const DEFAULT_SETTINGS = resolveEditorSettings()
const subscribeToNothing = () => () => {}
const getDefaultSettings = () => DEFAULT_SETTINGS

export interface IrisCodeEditorProps {
  /** Controlled document text. */
  value?: string
  /** Uncontrolled initial text. */
  defaultValue?: string
  /** Syntax-highlighting language. Default `'plain'`. */
  language?: EditorLanguage
  /** Tab width. Defaults to the editor Provider setting, then `2`. */
  tabSize?: number
  /** Render read-only (non-editable). Default `false`. */
  readOnly?: boolean
  /** Enable autocompletion popup. Default `true`. */
  completions?: boolean
  /** Base text for inline diff view. Editor enters read-only diff mode. */
  base?: string
  /** Called with the full text on every change. */
  onChange?: (value: string) => void
  className?: string
  style?: React.CSSProperties
}

/**
 * CodeMirror 6 code editor for React. Mounts the framework-agnostic
 * {@link createEditor} handle and reconciles `value` / `language` / `readOnly`.
 */
export function IrisCodeEditor({
  value,
  defaultValue,
  language,
  tabSize,
  readOnly = false,
  completions,
  base,
  onChange,
  className,
  style,
}: IrisCodeEditorProps) {
  const pluginContext = React.useContext(PluginStoreContext)
  const settingsStore = pluginContext?.stores.get('editor') as EditorSettingsStore | undefined
  const settings = React.useSyncExternalStore(
    settingsStore?.subscribe ?? subscribeToNothing,
    settingsStore?.getState ?? getDefaultSettings,
    settingsStore?.getState ?? getDefaultSettings,
  )
  const activeLanguage = language ?? settings.defaultLanguage
  const activeTabSize = tabSize ?? settings.tabSize

  const hostRef = React.useRef<HTMLDivElement | null>(null)
  const handleRef = React.useRef<EditorHandle | null>(null)
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange

  React.useEffect(() => {
    if (!hostRef.current) return undefined
    const handle = createEditor({
      parent: hostRef.current,
      doc: value ?? defaultValue ?? '',
      language: activeLanguage,
      tabSize: activeTabSize,
      readOnly,
      completions,
      base,
      onChange: (v) => onChangeRef.current?.(v),
    })
    handleRef.current = handle
    return () => {
      handle.destroy()
      handleRef.current = null
    }
    // mount once; prop changes are reconciled by the effects below.
  }, [])

  React.useEffect(() => {
    if (value !== undefined && handleRef.current && handleRef.current.getValue() !== value) {
      handleRef.current.setValue(value)
    }
  }, [value])

  React.useEffect(() => {
    handleRef.current?.setLanguage(activeLanguage)
  }, [activeLanguage])

  React.useEffect(() => {
    handleRef.current?.setTabSize(activeTabSize)
  }, [activeTabSize])

  React.useEffect(() => {
    handleRef.current?.setReadOnly(readOnly)
  }, [readOnly])

  return (
    <div
      ref={hostRef}
      data-iris-code-editor=""
      data-language={activeLanguage}
      data-tab-size={activeTabSize}
      className={className}
      style={style}
    />
  )
}
