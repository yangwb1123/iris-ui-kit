import { computed, defineComponent, h, ref, type PropType } from 'vue'

export interface IrisFileUploadFile {
  /** The underlying File. */
  file: File
  /** Convenience: same as `file.name`. */
  name: string
  /** Convenience: same as `file.size` in bytes. */
  size: number
  /** Convenience: same as `file.type`. */
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

/**
 * File-upload dropzone. Wraps a native `<input type="file">` (hidden) with a
 * click-to-browse and drag-and-drop interaction surface. Two-way binds the
 * selected file list via `v-model`. Renders the file list as a default UI;
 * pass `#list` to fully customize.
 *
 * Validation:
 *   - `accept` is forwarded to the input and used to filter dropped files.
 *   - `maxSize` (bytes) and `maxFiles` enforce client-side constraints; over-
 *     limit files are surfaced via the `reject` event.
 */
export const IrisFileUpload = defineComponent({
  name: 'IrisFileUpload',
  inheritAttrs: false,
  props: {
    modelValue: {
      type: Array as PropType<IrisFileUploadFile[]>,
      default: () => [],
    },
    /** MIME type filter (forwarded to native input + drop validation). */
    accept: { type: String, default: '' },
    multiple: { type: Boolean, default: false },
    /** Max file size in bytes. 0 = unlimited. */
    maxSize: { type: Number, default: 0 },
    /** Max simultaneous files (only meaningful with `multiple`). 0 = unlimited. */
    maxFiles: { type: Number, default: 0 },
    disabled: { type: Boolean, default: false },
    /** Idle dropzone label. */
    label: { type: String, default: 'Click or drop files to upload' },
    /** id forwarded to the hidden input. Set by IrisFormField. */
    id: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_files: IrisFileUploadFile[]) => true,
    /** Files that passed validation. */
    accept: (_files: IrisFileUploadFile[]) => true,
    /** Files that failed validation, with reason. */
    reject: (_entries: { file: IrisFileUploadFile; reason: 'size' | 'count' | 'type' }[]) => true,
  },
  setup(props, { attrs, slots, emit }) {
    const inputRef = ref<HTMLInputElement | null>(null)
    const dragOver = ref(false)
    const dragCount = ref(0) // tracks nested dragenter/leave correctly

    const acceptMatches = (file: File): boolean => {
      if (!props.accept) return true
      const tokens = props.accept.split(',').map((t) => t.trim()).filter(Boolean)
      if (tokens.length === 0) return true
      return tokens.some((token) => {
        if (token.startsWith('.')) {
          return file.name.toLowerCase().endsWith(token.toLowerCase())
        }
        if (token.endsWith('/*')) {
          const prefix = token.slice(0, -2)
          return file.type.startsWith(prefix + '/')
        }
        return file.type === token
      })
    }

    const validate = (incoming: File[]): {
      accepted: IrisFileUploadFile[]
      rejected: { file: IrisFileUploadFile; reason: 'size' | 'count' | 'type' }[]
    } => {
      const accepted: IrisFileUploadFile[] = []
      const rejected: { file: IrisFileUploadFile; reason: 'size' | 'count' | 'type' }[] = []
      const existing = props.modelValue.length
      let acceptedCount = 0
      for (const f of incoming) {
        const wrapped = wrapFile(f)
        if (!acceptMatches(f)) {
          rejected.push({ file: wrapped, reason: 'type' })
          continue
        }
        if (props.maxSize > 0 && f.size > props.maxSize) {
          rejected.push({ file: wrapped, reason: 'size' })
          continue
        }
        if (
          props.maxFiles > 0 &&
          (props.multiple ? existing + acceptedCount + 1 > props.maxFiles : false)
        ) {
          rejected.push({ file: wrapped, reason: 'count' })
          continue
        }
        accepted.push(wrapped)
        acceptedCount += 1
      }
      return { accepted, rejected }
    }

    const applyFiles = (incoming: File[]) => {
      if (props.disabled) return
      const { accepted, rejected } = validate(incoming)
      const next = props.multiple ? [...props.modelValue, ...accepted] : accepted.slice(0, 1)
      emit('update:modelValue', next)
      if (accepted.length > 0) emit('accept', accepted)
      if (rejected.length > 0) emit('reject', rejected)
    }

    const onInputChange = (event: Event) => {
      const input = event.target as HTMLInputElement
      const files = input.files ? Array.from(input.files) : []
      applyFiles(files)
      // Reset so selecting the same file again still triggers a change.
      input.value = ''
    }

    const onClickZone = () => {
      if (props.disabled) return
      inputRef.value?.click()
    }

    const onKeyDownZone = (event: KeyboardEvent) => {
      if (props.disabled) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        inputRef.value?.click()
      }
    }

    const onDragOver = (event: DragEvent) => {
      if (props.disabled) return
      event.preventDefault()
    }

    const onDragEnter = (event: DragEvent) => {
      if (props.disabled) return
      event.preventDefault()
      dragCount.value += 1
      dragOver.value = true
    }

    const onDragLeave = () => {
      if (props.disabled) return
      dragCount.value = Math.max(0, dragCount.value - 1)
      if (dragCount.value === 0) dragOver.value = false
    }

    const onDrop = (event: DragEvent) => {
      if (props.disabled) return
      event.preventDefault()
      dragCount.value = 0
      dragOver.value = false
      const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : []
      applyFiles(files)
    }

    const removeAt = (index: number) => {
      const next = [...props.modelValue]
      next.splice(index, 1)
      emit('update:modelValue', next)
    }

    const zoneStyle = computed<Record<string, string>>(() => ({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      padding: 'var(--iris-padding-lg, 20px)',
      border: `2px dashed ${
        dragOver.value ? 'var(--iris-primary)' : 'var(--iris-border)'
      }`,
      borderRadius: 'var(--iris-radius-md, 6px)',
      background: dragOver.value
        ? 'var(--iris-surface-hover)'
        : 'var(--iris-surface)',
      color: 'var(--iris-foreground)',
      cursor: props.disabled ? 'not-allowed' : 'pointer',
      opacity: props.disabled ? '0.6' : '1',
      transition: 'border-color 120ms ease, background-color 120ms ease',
      outline: 'none',
      ...((attrs.style as Record<string, string> | undefined) ?? {}),
    }))

    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-file-upload': '',
          'data-drag-over': dragOver.value ? 'true' : undefined,
          'data-disabled': props.disabled ? 'true' : undefined,
        },
        [
          // Hidden native input
          h('input', {
            ref: (el: unknown) => {
              inputRef.value = (el ?? null) as HTMLInputElement | null
            },
            id: props.id,
            type: 'file',
            accept: props.accept || undefined,
            multiple: props.multiple || undefined,
            disabled: props.disabled || undefined,
            'data-iris-file-upload-input': '',
            onChange: onInputChange,
            style: {
              position: 'absolute',
              width: '1px',
              height: '1px',
              padding: '0',
              margin: '-1px',
              overflow: 'hidden',
              clip: 'rect(0,0,0,0)',
              whiteSpace: 'nowrap',
              border: '0',
            },
          }),
          // Drop zone
          h(
            'div',
            {
              role: 'button',
              tabindex: props.disabled ? -1 : 0,
              'aria-disabled': props.disabled ? 'true' : undefined,
              'data-iris-file-upload-zone': '',
              onClick: onClickZone,
              onKeydown: onKeyDownZone,
              onDragover: onDragOver,
              onDragenter: onDragEnter,
              onDragleave: onDragLeave,
              onDrop,
              style: zoneStyle.value,
            },
            [
              h(
                'div',
                {
                  'data-iris-file-upload-label': '',
                  style: { fontSize: '14px', fontWeight: '500' },
                },
                props.label,
              ),
              props.accept
                ? h(
                    'div',
                    {
                      style: {
                        fontSize: '12px',
                        color: 'var(--iris-muted)',
                      },
                    },
                    props.accept,
                  )
                : null,
            ],
          ),
          // File list (or custom slot)
          slots.list
            ? slots.list({ files: props.modelValue, remove: removeAt })
            : props.modelValue.length > 0
              ? h(
                  'ul',
                  {
                    'data-iris-file-upload-list': '',
                    style: {
                      listStyle: 'none',
                      margin: '8px 0 0 0',
                      padding: '0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    },
                  },
                  props.modelValue.map((item, idx) =>
                    h(
                      'li',
                      {
                        key: `${item.name}-${idx}`,
                        'data-iris-file-upload-item': '',
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 10px',
                          background: 'var(--iris-surface)',
                          border: '1px solid var(--iris-border)',
                          borderRadius: 'var(--iris-radius-sm, 4px)',
                          fontSize: '13px',
                        },
                      },
                      [
                        h('span', { style: { flex: '1', minWidth: '0' } }, item.name),
                        h(
                          'span',
                          { style: { color: 'var(--iris-muted)', fontSize: '12px' } },
                          formatBytes(item.size),
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            'aria-label': `Remove ${item.name}`,
                            disabled: props.disabled || undefined,
                            onClick: (e: MouseEvent) => {
                              e.stopPropagation()
                              removeAt(idx)
                            },
                            style: {
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--iris-muted)',
                              cursor: props.disabled ? 'not-allowed' : 'pointer',
                              fontSize: '16px',
                              lineHeight: '1',
                              padding: '0 4px',
                            },
                          },
                          '×',
                        ),
                      ],
                    ),
                  ),
                )
              : null,
        ],
      )
  },
})

export { formatBytes }
