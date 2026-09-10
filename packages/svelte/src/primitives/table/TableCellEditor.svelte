<script lang="ts">
  let {
    type = 'text',
    value,
    error = null,
    errorId,
    onInput,
    onCommit,
    onCancel,
    onTab,
    sessionIdentity,
    inputRef,
    preview,
    showPreview = false,
  }: {
    type?: 'text' | 'number'
    value: string
    error?: string | null
    errorId: string
    onInput: (value: string) => void
    onCommit: (sessionIdentity?: object) => void
    onCancel: () => void
    onTab?: (direction: 1 | -1, sessionIdentity?: object) => void
    sessionIdentity?: object
    inputRef?: (node: HTMLInputElement | null) => void
    preview?: string
    showPreview?: boolean
  } = $props()

  let inputEl = $state<HTMLInputElement | null>(null)
  let commit: (sessionIdentity?: object) => void = () => undefined
  let cancel: () => void = () => undefined
  let tab: ((direction: 1 | -1, sessionIdentity?: object) => void) | undefined = undefined
  let commitIdentity: object | undefined = undefined

  $effect(() => {
    commit = onCommit
    cancel = onCancel
    tab = onTab
    commitIdentity = sessionIdentity
  })

  $effect(() => {
    inputRef?.(inputEl)
    return () => inputRef?.(null)
  })
</script>

<input
  bind:this={inputEl}
  {type}
  {value}
  data-iris-table-editor
  aria-invalid={error ? 'true' : undefined}
  aria-describedby={error ? errorId : undefined}
  oninput={(event) => onInput((event.target as HTMLInputElement).value)}
  onkeydown={(event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit(commitIdentity)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    } else if (event.key === 'Tab' && tab) {
      event.preventDefault()
      tab(event.shiftKey ? -1 : 1, commitIdentity)
    }
  }}
  onblur={() => commit(commitIdentity)}
  onclick={(event) => event.stopPropagation()}
  style="width: 100%; border: 1px solid {error
    ? 'var(--iris-danger)'
    : 'var(--iris-primary)'}; border-radius: var(--iris-radius-sm, 4px); padding: var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px); font: inherit; background: var(--iris-background); color: var(--iris-foreground); outline: none"
/>
{#if showPreview}
  <div
    data-iris-edit-preview
    style="flex-basis: 100%; min-width: 0; margin-top: var(--iris-space-xxs, 4px); font-size: var(--iris-font-size-xs, 12px); color: var(--iris-muted)"
  >
    {preview}
  </div>
{/if}
{#if error}
  <div
    id={errorId}
    role="alert"
    data-iris-table-editor-error
    style="margin-top: var(--iris-space-xxs, 4px); font-size: var(--iris-font-size-xs, 12px); color: var(--iris-danger)"
  >
    {error}
  </div>
{/if}
