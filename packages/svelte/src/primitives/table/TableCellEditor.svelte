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
    inputRef,
    preview,
    showPreview = false,
  }: {
    type?: 'text' | 'number'
    value: string
    error?: string | null
    errorId: string
    onInput: (value: string) => void
    onCommit: () => void
    onCancel: () => void
    onTab?: (direction: 1 | -1) => void
    inputRef?: (node: HTMLInputElement | null) => void
    preview?: string
    showPreview?: boolean
  } = $props()

  let inputEl = $state<HTMLInputElement | null>(null)
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
      onCommit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    } else if (event.key === 'Tab' && onTab) {
      event.preventDefault()
      onTab(event.shiftKey ? -1 : 1)
    }
  }}
  onblur={onCommit}
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
