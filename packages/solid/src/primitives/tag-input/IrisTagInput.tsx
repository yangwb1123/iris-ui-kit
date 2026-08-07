import { createSignal, For, mergeProps, splitProps, type JSX } from 'solid-js'
import { useI18n } from '../../i18n'

export interface IrisTagInputProps {
  value?: string[]
  defaultValue?: string[]
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  max?: number
  allowDuplicates?: boolean
  id?: string
  ariaDescribedby?: string
  onChange?: (tags: string[]) => void
  style?: JSX.CSSProperties | string
  class?: string
}

/** Solid port of IrisTagInput — text + removable tags; Enter/comma creates tags. */
export function IrisTagInput(props: IrisTagInputProps): JSX.Element {
  const merged = mergeProps({ allowDuplicates: false }, props)
  const [local, rest] = splitProps(merged, [
    'value',
    'defaultValue',
    'placeholder',
    'disabled',
    'invalid',
    'max',
    'allowDuplicates',
    'id',
    'ariaDescribedby',
    'onChange',
    'style',
  ])

  const { t } = useI18n()

  const isControlled = (): boolean => local.value !== undefined
  const [internal, setInternal] = createSignal<string[]>(local.defaultValue ?? [])
  const current = (): string[] => (isControlled() ? (local.value as string[]) : internal())

  const [inputText, setInputText] = createSignal('')
  const [focused, setFocused] = createSignal(false)

  const canAdd = (txt: string, list: string[]): boolean =>
    !!txt &&
    (local.allowDuplicates || !list.includes(txt)) &&
    (!local.max || list.length < local.max)

  const updateTags = (next: string[]): void => {
    if (!isControlled()) setInternal(next)
    local.onChange?.(next)
  }

  const addTag = (): void => {
    const txt = inputText().trim()
    if (txt && canAdd(txt, current())) updateTags([...current(), txt])
    setInputText('')
  }

  const removeAt = (i: number): void => {
    if (local.disabled) return
    updateTags(current().filter((_, k) => k !== i))
  }

  const onInput = (e: Event): void => {
    const raw = (e.target as HTMLInputElement).value
    if (raw.includes(',')) {
      const parts = raw.split(',')
      const last = parts.pop() ?? ''
      let next = current()
      for (const p of parts) {
        const txt = p.trim()
        if (canAdd(txt, next)) next = [...next, txt]
      }
      if (next !== current()) updateTags(next)
      setInputText(last)
    } else {
      setInputText(raw)
    }
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && inputText() === '' && current().length > 0) {
      e.preventDefault()
      removeAt(current().length - 1)
    }
  }

  const borderColor = (): string =>
    local.invalid ? 'var(--iris-danger)' : focused() ? 'var(--iris-primary)' : 'var(--iris-border)'

  return (
    <div
      {...rest}
      data-iris-tag-input=""
      data-state={local.invalid ? 'invalid' : focused() ? 'focused' : 'idle'}
      style={{
        display: 'flex',
        'flex-wrap': 'wrap',
        'align-items': 'center',
        gap: 'var(--iris-space-xs, 8px)',
        padding: '4px 8px',
        'min-height': '34px',
        background: 'var(--iris-background)',
        border: `1px solid ${borderColor()}`,
        'border-radius': 'var(--iris-radius-md, 6px)',
        opacity: local.disabled ? 0.6 : 1,
        'box-shadow': focused() ? '0 0 0 3px rgba(99,102,241,0.18)' : 'none',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
      }}
    >
      <For each={current()}>
        {(tag, i) => (
          <span
            data-iris-tag-input-tag=""
            data-value={tag}
            style={{
              display: 'inline-flex',
              'align-items': 'center',
              gap: '4px',
              padding: 'var(--iris-space-xxs, 4px) var(--iris-padding-sm, 6px)',
              'font-size': 'var(--iris-font-size-sm, 13px)',
              background: 'var(--iris-surface)',
              border: '1px solid var(--iris-border)',
              'border-radius': 'var(--iris-radius-sm, 4px)',
              color: 'var(--iris-foreground)',
            }}
          >
            {tag}
            <button
              type="button"
              data-iris-tag-input-remove=""
              aria-label={t('tagInput.remove', { tag })}
              disabled={local.disabled}
              onClick={() => removeAt(i())}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--iris-muted)',
                cursor: local.disabled ? 'not-allowed' : 'pointer',
                'font-size': 'var(--iris-font-size-md, 14px)',
                'line-height': '1',
                padding: '0',
              }}
            >
              ×
            </button>
          </span>
        )}
      </For>
      <input
        id={local.id}
        type="text"
        data-iris-tag-input-field=""
        value={inputText()}
        placeholder={current().length === 0 ? local.placeholder : undefined}
        disabled={local.disabled}
        aria-invalid={local.invalid ? 'true' : undefined}
        aria-describedby={local.ariaDescribedby}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: '1',
          'min-width': '80px',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--iris-foreground)',
          'font-family': 'inherit',
          'font-size': 'var(--iris-font-size-md, 14px)',
          padding: 'var(--iris-space-xxs, 4px) 0',
        }}
      />
    </div>
  )
}
