import { createSignal, For, mergeProps, Show, splitProps, type JSX } from 'solid-js'
import { useI18n } from '../../i18n'

export interface IrisFileUploadFile {
  file: File
  name: string
  size: number
  type: string
}

function wrapFile(file: File): IrisFileUploadFile {
  return { file, name: file.name, size: file.size, type: file.type }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export interface IrisFileUploadProps {
  value?: IrisFileUploadFile[]
  defaultValue?: IrisFileUploadFile[]
  accept?: string
  multiple?: boolean
  maxSize?: number
  maxFiles?: number
  disabled?: boolean
  label?: string
  id?: string
  onChange?: (files: IrisFileUploadFile[]) => void
  onAccept?: (files: IrisFileUploadFile[]) => void
  onReject?: (entries: { file: IrisFileUploadFile; reason: 'size' | 'count' | 'type' }[]) => void
  style?: JSX.CSSProperties | string
  class?: string
}

export { formatBytes }

/** Solid port of IrisFileUpload — drag-drop + click-to-upload zone. */
export function IrisFileUpload(props: IrisFileUploadProps): JSX.Element {
  const merged = mergeProps({ multiple: false, maxSize: 0, maxFiles: 0, accept: '' }, props)
  const [local, rest] = splitProps(merged, [
    'value',
    'defaultValue',
    'accept',
    'multiple',
    'maxSize',
    'maxFiles',
    'disabled',
    'label',
    'id',
    'onChange',
    'onAccept',
    'onReject',
    'style',
  ])

  const { t } = useI18n()

  const isControlled = (): boolean => local.value !== undefined
  const [internal, setInternal] = createSignal<IrisFileUploadFile[]>(local.defaultValue ?? [])
  const current = (): IrisFileUploadFile[] =>
    isControlled() ? (local.value as IrisFileUploadFile[]) : internal()

  const [dragOver, setDragOver] = createSignal(false)
  const [dragCount, setDragCount] = createSignal(0)
  let inputRef: HTMLInputElement | undefined

  const acceptMatches = (file: File): boolean => {
    if (!local.accept) return true
    const tokens = local.accept
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (tokens.length === 0) return true
    return tokens.some((token) => {
      if (token.startsWith('.')) return file.name.toLowerCase().endsWith(token.toLowerCase())
      if (token.endsWith('/*')) return file.type.startsWith(token.slice(0, -2) + '/')
      return file.type === token
    })
  }

  const validate = (incoming: File[]) => {
    const accepted: IrisFileUploadFile[] = []
    const rejected: { file: IrisFileUploadFile; reason: 'size' | 'count' | 'type' }[] = []
    const existing = current().length
    let acceptedCount = 0
    for (const f of incoming) {
      const wrapped = wrapFile(f)
      if (!acceptMatches(f)) {
        rejected.push({ file: wrapped, reason: 'type' })
        continue
      }
      if (local.maxSize > 0 && f.size > local.maxSize) {
        rejected.push({ file: wrapped, reason: 'size' })
        continue
      }
      if (local.maxFiles > 0 && local.multiple && existing + acceptedCount + 1 > local.maxFiles) {
        rejected.push({ file: wrapped, reason: 'count' })
        continue
      }
      accepted.push(wrapped)
      acceptedCount++
    }
    return { accepted, rejected }
  }

  const applyFiles = (incoming: File[]): void => {
    if (local.disabled) return
    const { accepted, rejected } = validate(incoming)
    const next = local.multiple ? [...current(), ...accepted] : accepted.slice(0, 1)
    if (!isControlled()) setInternal(next)
    local.onChange?.(next)
    if (accepted.length > 0) local.onAccept?.(accepted)
    if (rejected.length > 0) local.onReject?.(rejected)
  }

  const onInputChange = (e: Event): void => {
    const input = e.target as HTMLInputElement
    const files = input.files ? Array.from(input.files) : []
    applyFiles(files)
    input.value = ''
  }

  const onClickZone = (): void => {
    if (local.disabled) return
    inputRef?.click()
  }

  const onKeyDownZone = (e: KeyboardEvent): void => {
    if (local.disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef?.click()
    }
  }

  const onDragOver = (e: DragEvent): void => {
    if (local.disabled) return
    e.preventDefault()
  }

  const onDragEnter = (e: DragEvent): void => {
    if (local.disabled) return
    e.preventDefault()
    setDragCount((c) => c + 1)
    setDragOver(true)
  }

  const onDragLeave = (): void => {
    if (local.disabled) return
    setDragCount((c) => Math.max(0, c - 1))
    if (dragCount() === 0) setDragOver(false)
  }

  const onDrop = (e: DragEvent): void => {
    if (local.disabled) return
    e.preventDefault()
    setDragCount(0)
    setDragOver(false)
    const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : []
    applyFiles(files)
  }

  const removeAt = (index: number): void => {
    const next = [...current()]
    next.splice(index, 1)
    if (!isControlled()) setInternal(next)
    local.onChange?.(next)
  }

  return (
    <div
      {...rest}
      data-iris-file-upload=""
      data-drag-over={dragOver() ? 'true' : undefined}
      data-disabled={local.disabled ? 'true' : undefined}
    >
      <input
        ref={(el) => {
          inputRef = el
        }}
        id={local.id}
        type="file"
        accept={local.accept || undefined}
        multiple={local.multiple || undefined}
        disabled={local.disabled}
        data-iris-file-upload-input=""
        onChange={onInputChange}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          'white-space': 'nowrap',
          border: '0',
        }}
      />
      <div
        role="button"
        tabIndex={local.disabled ? -1 : 0}
        aria-disabled={local.disabled ? 'true' : undefined}
        data-iris-file-upload-zone=""
        onClick={onClickZone}
        onKeyDown={onKeyDownZone}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          display: 'flex',
          'flex-direction': 'column',
          'align-items': 'center',
          'justify-content': 'center',
          gap: '6px',
          padding: 'var(--iris-padding-lg, 20px)',
          border: `2px dashed ${dragOver() ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
          'border-radius': 'var(--iris-radius-md, 6px)',
          background: dragOver() ? 'var(--iris-surface-hover)' : 'var(--iris-surface)',
          color: 'var(--iris-foreground)',
          cursor: local.disabled ? 'not-allowed' : 'pointer',
          opacity: local.disabled ? 0.6 : 1,
          transition: 'border-color 120ms ease, background-color 120ms ease',
          outline: 'none',
          ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
        }}
      >
        <div data-iris-file-upload-label="" style={{ 'font-size': '14px', 'font-weight': '500' }}>
          {local.label ?? t('fileUpload.label')}
        </div>
        <Show when={local.accept}>
          <div style={{ 'font-size': '12px', color: 'var(--iris-muted)' }}>{local.accept}</div>
        </Show>
      </div>
      <Show when={current().length > 0}>
        <ul
          data-iris-file-upload-list=""
          style={{
            'list-style': 'none',
            margin: '8px 0 0 0',
            padding: '0',
            display: 'flex',
            'flex-direction': 'column',
            gap: '4px',
          }}
        >
          <For each={current()}>
            {(item, i) => (
              <li
                data-iris-file-upload-item=""
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  background: 'var(--iris-surface)',
                  border: '1px solid var(--iris-border)',
                  'border-radius': 'var(--iris-radius-sm, 4px)',
                  'font-size': '13px',
                }}
              >
                <span style={{ flex: '1', 'min-width': '0' }}>{item.name}</span>
                <span style={{ color: 'var(--iris-muted)', 'font-size': '12px' }}>
                  {formatBytes(item.size)}
                </span>
                <button
                  type="button"
                  aria-label={t('fileUpload.remove', { name: item.name })}
                  disabled={local.disabled}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeAt(i())
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--iris-muted)',
                    cursor: local.disabled ? 'not-allowed' : 'pointer',
                    'font-size': '16px',
                    'line-height': '1',
                    padding: '0 4px',
                  }}
                >
                  ×
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}
