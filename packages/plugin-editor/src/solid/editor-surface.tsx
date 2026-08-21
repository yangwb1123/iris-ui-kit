import { createEffect, onCleanup, onMount, type Accessor, type JSX } from 'solid-js'
import type { EditorHandle, EditorLanguage } from '../core'
import { createEditor } from '../core'

interface EditorSurfaceProps {
  value?: string
  defaultValue?: string
  language: Accessor<EditorLanguage>
  tabSize: Accessor<number>
  readOnly: Accessor<boolean>
  completions?: boolean
  base?: string
  onChange?: (value: string) => void
  class?: string
}

/** Own the DOM editor lifecycle while the parent bridges plugin settings. */
export function EditorSurface(props: EditorSurfaceProps): JSX.Element {
  let host: HTMLDivElement | undefined
  let handle: EditorHandle | null = null

  onMount(() => {
    if (!host) return
    handle = createEditor({
      parent: host,
      doc: props.value ?? props.defaultValue ?? '',
      language: props.language(),
      tabSize: props.tabSize(),
      readOnly: props.readOnly(),
      completions: props.completions,
      base: props.base,
      onChange: (value) => props.onChange?.(value),
    })
  })

  onCleanup(() => {
    handle?.destroy()
    handle = null
  })

  createEffect(() => {
    const value = props.value
    if (value !== undefined && handle && handle.getValue() !== value) handle.setValue(value)
  })
  createEffect(() => {
    if (handle) handle.setLanguage(props.language())
  })
  createEffect(() => {
    if (handle) handle.setTabSize(props.tabSize())
  })
  createEffect(() => {
    if (handle) handle.setReadOnly(props.readOnly())
  })

  return (
    <div
      ref={host}
      data-iris-code-editor=""
      data-language={props.language()}
      data-tab-size={props.tabSize()}
      class={props.class}
    />
  )
}
