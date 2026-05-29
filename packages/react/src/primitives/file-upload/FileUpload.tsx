import * as React from 'react'
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export type IrisFileUploadRejectReason = 'size' | 'count' | 'type'

export interface IrisFileUploadRejection {
  file: IrisFileUploadFile
  reason: IrisFileUploadRejectReason
}

export interface IrisFileUploadProps {
  value?: IrisFileUploadFile[]
  defaultValue?: IrisFileUploadFile[]
  onValueChange?: (files: IrisFileUploadFile[]) => void
  onAccept?: (files: IrisFileUploadFile[]) => void
  onReject?: (entries: IrisFileUploadRejection[]) => void
  /** MIME type filter (forwarded + used to filter dropped files). */
  accept?: string
  multiple?: boolean
  /** Max file size in bytes. 0 = unlimited. */
  maxSize?: number
  /** Max simultaneous files. 0 = unlimited. */
  maxFiles?: number
  disabled?: boolean
  /** Idle dropzone label. */
  label?: string
  /** id forwarded to the hidden input. Set by `IrisFormField`. */
  id?: string
  /** Custom render for the file list. Receives `{ files, remove }`. */
  renderList?: (state: {
    files: IrisFileUploadFile[]
    remove: (index: number) => void
  }) => React.ReactNode
  style?: React.CSSProperties
  className?: string
}

/**
 * File-upload dropzone. Wraps a hidden `<input type="file">` with a
 * click-to-browse + drag-and-drop surface. Validates via `accept`, `maxSize`,
 * `maxFiles`; rejected files surface via `onReject`.
 */
export function IrisFileUpload({
  value: valueProp,
  defaultValue = [],
  onValueChange,
  onAccept,
  onReject,
  accept = '',
  multiple = false,
  maxSize = 0,
  maxFiles = 0,
  disabled = false,
  label,
  id,
  renderList,
  style,
  className,
}: IrisFileUploadProps): React.ReactElement {
  const { t } = useI18n()
  const resolvedLabel = label ?? t('fileUpload.label')
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState<IrisFileUploadFile[]>(defaultValue)
  const files = isControlled ? (valueProp as IrisFileUploadFile[]) : internal

  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const dragCountRef = React.useRef(0)
  const [dragOver, setDragOver] = React.useState(false)

  const acceptMatches = (file: File): boolean => {
    if (!accept) return true
    const tokens = accept
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (tokens.length === 0) return true
    return tokens.some((token) => {
      if (token.startsWith('.')) {
        return file.name.toLowerCase().endsWith(token.toLowerCase())
      }
      if (token.endsWith('/*')) {
        return file.type.startsWith(token.slice(0, -2) + '/')
      }
      return file.type === token
    })
  }

  const validate = (incoming: File[]) => {
    const accepted: IrisFileUploadFile[] = []
    const rejected: IrisFileUploadRejection[] = []
    const existing = files.length
    let acceptedCount = 0
    for (const f of incoming) {
      const wrapped = wrapFile(f)
      if (!acceptMatches(f)) {
        rejected.push({ file: wrapped, reason: 'type' })
        continue
      }
      if (maxSize > 0 && f.size > maxSize) {
        rejected.push({ file: wrapped, reason: 'size' })
        continue
      }
      if (maxFiles > 0 && (multiple ? existing + acceptedCount + 1 > maxFiles : false)) {
        rejected.push({ file: wrapped, reason: 'count' })
        continue
      }
      accepted.push(wrapped)
      acceptedCount += 1
    }
    return { accepted, rejected }
  }

  const applyFiles = (incoming: File[]) => {
    if (disabled) return
    const { accepted, rejected } = validate(incoming)
    const next = multiple ? [...files, ...accepted] : accepted.slice(0, 1)
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
    if (accepted.length > 0) onAccept?.(accepted)
    if (rejected.length > 0) onReject?.(rejected)
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const incoming = input.files ? Array.from(input.files) : []
    applyFiles(incoming)
    input.value = ''
  }

  const openPicker = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const onKeyDownZone = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openPicker()
    }
  }

  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return
    e.preventDefault()
    dragCountRef.current += 1
    setDragOver(true)
  }
  const onDragLeave = () => {
    if (disabled) return
    dragCountRef.current = Math.max(0, dragCountRef.current - 1)
    if (dragCountRef.current === 0) setDragOver(false)
  }
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return
    e.preventDefault()
  }
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return
    e.preventDefault()
    dragCountRef.current = 0
    setDragOver(false)
    const incoming = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : []
    applyFiles(incoming)
  }

  const removeAt = (index: number) => {
    const next = [...files]
    next.splice(index, 1)
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  const zoneStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 'var(--iris-padding-lg, 20px)',
    border: `2px dashed ${dragOver ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
    borderRadius: 'var(--iris-radius-md, 6px)',
    background: dragOver ? 'var(--iris-surface-hover)' : 'var(--iris-surface)',
    color: 'var(--iris-foreground)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'border-color 120ms ease, background-color 120ms ease',
    outline: 'none',
  }

  return (
    <div
      data-iris-file-upload=""
      data-drag-over={dragOver ? 'true' : undefined}
      data-disabled={disabled ? 'true' : undefined}
      className={className}
      style={style}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept || undefined}
        multiple={multiple || undefined}
        disabled={disabled || undefined}
        data-iris-file-upload-input=""
        onChange={onInputChange}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      />
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled ? 'true' : undefined}
        data-iris-file-upload-zone=""
        onClick={openPicker}
        onKeyDown={onKeyDownZone}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        style={zoneStyle}
      >
        <div data-iris-file-upload-label="" style={{ fontSize: 14, fontWeight: 500 }}>
          {resolvedLabel}
        </div>
        {accept ? <div style={{ fontSize: 12, color: 'var(--iris-muted)' }}>{accept}</div> : null}
      </div>
      {renderList ? (
        renderList({ files, remove: removeAt })
      ) : files.length > 0 ? (
        <ul
          data-iris-file-upload-list=""
          style={{
            listStyle: 'none',
            margin: '8px 0 0 0',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {files.map((item, idx) => (
            <li
              key={`${item.name}-${idx}`}
              data-iris-file-upload-item=""
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                background: 'var(--iris-surface)',
                border: '1px solid var(--iris-border)',
                borderRadius: 'var(--iris-radius-sm, 4px)',
                fontSize: 13,
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>{item.name}</span>
              <span style={{ color: 'var(--iris-muted)', fontSize: 12 }}>
                {formatBytes(item.size)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                disabled={disabled || undefined}
                onClick={(e) => {
                  e.stopPropagation()
                  removeAt(idx)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--iris-muted)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                  padding: '0 4px',
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
