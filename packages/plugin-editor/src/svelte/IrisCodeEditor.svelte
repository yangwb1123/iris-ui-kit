<script lang="ts">
  import { untrack } from 'svelte'
  import { usePlugin, usePluginStore } from '@iris-ui-kit/svelte/provider'
  import {
    createEditor,
    resolveEditorSettings,
    type EditorHandle,
    type EditorLanguage,
    type EditorSettings,
    type EditorSettingsStore,
  } from '../core'

  interface Props {
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

  let {
    value = undefined,
    defaultValue = '',
    language = undefined,
    tabSize = undefined,
    readOnly = false,
    completions = undefined,
    base = undefined,
    onChange,
    class: klass = '',
  }: Props = $props()

  const settingsStore = usePlugin('editor')
    ? usePluginStore<EditorSettingsStore>('editor')
    : undefined
  let settingsValue: EditorSettings = $state(settingsStore?.getState() ?? resolveEditorSettings())
  $effect(() => settingsStore?.subscribe((next) => (settingsValue = next)))
  const activeLanguage = $derived(language ?? settingsValue.defaultLanguage)
  const activeTabSize = $derived(tabSize ?? settingsValue.tabSize)

  let host: HTMLDivElement
  let handle: EditorHandle | null = null

  // Create once on mount; initial prop reads are untracked so prop changes don't
  // recreate the editor (they're reconciled by the effects below).
  $effect(() => {
    const created = createEditor({
      parent: host,
      doc: untrack(() => value ?? defaultValue),
      language: untrack(() => activeLanguage),
      tabSize: untrack(() => activeTabSize),
      readOnly: untrack(() => readOnly),
      completions: untrack(() => completions),
      base: untrack(() => base),
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
    handle?.setLanguage(activeLanguage)
  })
  $effect(() => {
    handle?.setTabSize(activeTabSize)
  })
  $effect(() => {
    handle?.setReadOnly(readOnly)
  })
</script>

<div
  bind:this={host}
  data-iris-code-editor
  data-language={activeLanguage}
  data-tab-size={activeTabSize}
  class={klass}
></div>
