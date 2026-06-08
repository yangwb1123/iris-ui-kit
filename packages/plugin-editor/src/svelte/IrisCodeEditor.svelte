<script lang="ts">
  import { untrack } from 'svelte'
  import { createEditor, type EditorHandle, type EditorLanguage } from '../core'

  interface Props {
    value?: string
    defaultValue?: string
    language?: EditorLanguage
    readOnly?: boolean
    onChange?: (value: string) => void
    class?: string
  }

  let {
    value = undefined,
    defaultValue = '',
    language = 'plain',
    readOnly = false,
    onChange,
    class: klass = '',
  }: Props = $props()

  let host: HTMLDivElement
  let handle: EditorHandle | null = null

  // Create once on mount; initial prop reads are untracked so prop changes don't
  // recreate the editor (they're reconciled by the effects below).
  $effect(() => {
    const created = createEditor({
      parent: host,
      doc: untrack(() => value ?? defaultValue),
      language: untrack(() => language),
      readOnly: untrack(() => readOnly),
      onChange: (v) => onChange?.(v),
    })
    handle = created
    return () => {
      created.destroy()
      handle = null
    }
  })

  $effect(() => {
    if (value !== undefined && handle && handle.getValue() !== value) handle.setValue(value)
  })
  $effect(() => {
    handle?.setLanguage(language)
  })
  $effect(() => {
    handle?.setReadOnly(readOnly)
  })
</script>

<div bind:this={host} data-iris-code-editor class={klass}></div>
