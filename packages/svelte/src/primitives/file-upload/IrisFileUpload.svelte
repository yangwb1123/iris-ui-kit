<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  export interface IrisFileUploadFile {
    file: File
    name: string
    size: number
    type: string
  }

  function wrapFile(f: File): IrisFileUploadFile {
    return { file: f, name: f.name, size: f.size, type: f.type }
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  interface Props {
    value?: IrisFileUploadFile[]
    accept?: string
    multiple?: boolean
    maxSize?: number
    maxFiles?: number
    disabled?: boolean
    label?: string
    id?: string
    style?: string
    onchange?: (files: IrisFileUploadFile[]) => void
    onaccept?: (files: IrisFileUploadFile[]) => void
    onreject?: (entries: { file: IrisFileUploadFile; reason: 'size' | 'count' | 'type' }[]) => void
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let {
    value = [],
    accept = '',
    multiple = false,
    maxSize = 0,
    maxFiles = 0,
    disabled = false,
    label,
    id,
    style,
    onchange,
    onaccept,
    onreject,
    children: _children,
    ...rest
  }: Props = $props()

  let inputEl = $state<HTMLInputElement | undefined>(undefined)
  let dragOver = $state(false)
  let dragCount = $state(0)

  const resolvedLabel = $derived(label ?? t('fileUpload.label'))

  function acceptMatches(file: File): boolean {
    if (!accept) return true
    const tokens = accept.split(',').map((t) => t.trim()).filter(Boolean)
    if (tokens.length === 0) return true
    return tokens.some((token) => {
      if (token.startsWith('.')) return file.name.toLowerCase().endsWith(token.toLowerCase())
      if (token.endsWith('/*')) return file.type.startsWith(token.slice(0, -2) + '/')
      return file.type === token
    })
  }

  function validate(incoming: File[]) {
    const accepted: IrisFileUploadFile[] = []
    const rejected: { file: IrisFileUploadFile; reason: 'size' | 'count' | 'type' }[] = []
    const existing = value.length
    let acceptedCount = 0
    for (const f of incoming) {
      const wrapped = wrapFile(f)
      if (!acceptMatches(f)) { rejected.push({ file: wrapped, reason: 'type' }); continue }
      if (maxSize > 0 && f.size > maxSize) { rejected.push({ file: wrapped, reason: 'size' }); continue }
      if (maxFiles > 0 && multiple && existing + acceptedCount + 1 > maxFiles) {
        rejected.push({ file: wrapped, reason: 'count' }); continue
      }
      accepted.push(wrapped)
      acceptedCount += 1
    }
    return { accepted, rejected }
  }

  function applyFiles(incoming: File[]) {
    if (disabled) return
    const { accepted, rejected } = validate(incoming)
    const next = multiple ? [...value, ...accepted] : accepted.slice(0, 1)
    onchange?.(next)
    if (accepted.length > 0) onaccept?.(accepted)
    if (rejected.length > 0) onreject?.(rejected)
  }

  function handleInputChange(e: Event) {
    const input = e.target as HTMLInputElement
    const files = input.files ? Array.from(input.files) : []
    applyFiles(files)
    input.value = ''
  }

  function clickZone() {
    if (!disabled) inputEl?.click()
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputEl?.click() }
  }

  function removeAt(index: number) {
    const next = [...value]
    next.splice(index, 1)
    onchange?.(next)
  }

  const zoneStyle = $derived(styleToString({
    display: 'flex',
    'flex-direction': 'column',
    'align-items': 'center',
    'justify-content': 'center',
    gap: '6px',
    padding: 'var(--iris-padding-lg, 20px)',
    border: `2px dashed ${dragOver ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
    'border-radius': 'var(--iris-radius-md, 6px)',
    background: dragOver ? 'var(--iris-surface-hover, var(--iris-surface))' : 'var(--iris-surface)',
    color: 'var(--iris-foreground)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? '0.6' : '1',
    transition: 'border-color 120ms ease, background-color 120ms ease',
    outline: 'none',
  }))
</script>

<div
  {...rest}
  data-iris-file-upload
  data-drag-over={dragOver ? 'true' : undefined}
  data-disabled={disabled ? 'true' : undefined}
  style={mergeStyle(styleToString({ position: 'relative' }), style)}
>
  <!-- Hidden native input -->
  <input
    bind:this={inputEl}
    {id}
    type="file"
    accept={accept || undefined}
    {multiple}
    {disabled}
    data-iris-file-upload-input
    onchange={handleInputChange}
    style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;"
  />
  <!-- Drop zone -->
  <div
    role="button"
    tabindex={disabled ? -1 : 0}
    aria-disabled={disabled ? 'true' : undefined}
    data-iris-file-upload-zone
    onclick={clickZone}
    onkeydown={handleKeyDown}
    ondragover={(e) => { if (!disabled) { e.preventDefault() } }}
    ondragenter={(e) => { if (!disabled) { e.preventDefault(); dragCount += 1; dragOver = true } }}
    ondragleave={() => { if (!disabled) { dragCount = Math.max(0, dragCount - 1); if (dragCount === 0) dragOver = false } }}
    ondrop={(e) => { if (!disabled) { e.preventDefault(); dragCount = 0; dragOver = false; applyFiles(e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : []) } }}
    style={zoneStyle}
  >
    <div data-iris-file-upload-label style="font-size: 14px; font-weight: 500;">{resolvedLabel}</div>
    {#if accept}
      <div style="font-size: 12px; color: var(--iris-muted);">{accept}</div>
    {/if}
  </div>
  <!-- File list -->
  {#if value.length > 0}
    <ul
      data-iris-file-upload-list
      style="list-style: none; margin: 8px 0 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px;"
    >
      {#each value as item, idx (item.name + '-' + idx)}
        <li
          data-iris-file-upload-item
          style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--iris-surface); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-sm, 4px); font-size: 13px;"
        >
          <span style="flex: 1; min-width: 0;">{item.name}</span>
          <span style="color: var(--iris-muted); font-size: 12px;">{formatBytes(item.size)}</span>
          <button
            type="button"
            aria-label={t('fileUpload.remove', { name: item.name })}
            {disabled}
            onclick={(e) => { e.stopPropagation(); removeAt(idx) }}
            style="background: transparent; border: none; color: var(--iris-muted); cursor: {disabled ? 'not-allowed' : 'pointer'}; font-size: 16px; line-height: 1; padding: 0 4px;"
          >×</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
