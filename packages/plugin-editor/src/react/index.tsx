import * as React from 'react'
import { createEditor, type EditorHandle, type EditorLanguage } from '../core'

export type { EditorLanguage } from '../core'

export interface IrisCodeEditorProps {
  /** Controlled document text. */
  value?: string
  /** Uncontrolled initial text. */
  defaultValue?: string
  /** Syntax-highlighting language. Default `'plain'`. */
  language?: EditorLanguage
  /** Render read-only. Default `false`. */
  readOnly?: boolean
  /** Enable autocompletion popup. Default `true`. */
  completions?: boolean
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
  language = 'plain',
  readOnly = false,
  completions,
  onChange,
  className,
  style,
}: IrisCodeEditorProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null)
  const handleRef = React.useRef<EditorHandle | null>(null)
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange

  React.useEffect(() => {
    if (!hostRef.current) return undefined
    const handle = createEditor({
      parent: hostRef.current,
      doc: value ?? defaultValue ?? '',
      language,
      readOnly,
      completions,
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
    handleRef.current?.setLanguage(language)
  }, [language])

  React.useEffect(() => {
    handleRef.current?.setReadOnly(readOnly)
  }, [readOnly])

  return <div ref={hostRef} data-iris-code-editor="" className={className} style={style} />
}
