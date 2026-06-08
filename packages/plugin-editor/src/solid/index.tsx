import { createEffect, onCleanup, onMount } from 'solid-js'
import { createEditor, type EditorHandle, type EditorLanguage } from '../core'

export type { EditorLanguage } from '../core'

export interface IrisCodeEditorProps {
  value?: string
  defaultValue?: string
  language?: EditorLanguage
  readOnly?: boolean
  onChange?: (value: string) => void
  class?: string
}

/**
 * CodeMirror 6 code editor for SolidJS. Mounts {@link createEditor} once and
 * reconciles reactive props via `createEffect`.
 */
export function IrisCodeEditor(props: IrisCodeEditorProps) {
  let host: HTMLDivElement | undefined
  let handle: EditorHandle | null = null

  onMount(() => {
    if (!host) return
    handle = createEditor({
      parent: host,
      doc: props.value ?? props.defaultValue ?? '',
      language: props.language ?? 'plain',
      readOnly: props.readOnly ?? false,
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
    if (handle) handle.setLanguage(props.language ?? 'plain')
  })
  createEffect(() => {
    if (handle) handle.setReadOnly(props.readOnly ?? false)
  })

  return <div ref={host} data-iris-code-editor="" class={props.class} />
}
