import * as React from 'react'
import { useI18n } from '../../i18n'

export interface IrisTagInputProps {
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  /** Max number of tags. 0 / undefined = unlimited. */
  max?: number
  allowDuplicates?: boolean
  /** id forwarded to the input. Set by `IrisFormField`. */
  id?: string
  ariaDescribedby?: string
  style?: React.CSSProperties
  className?: string
}

/**
 * Tag / token input: a field where typed text becomes removable chips. Commit
 * a tag with Enter or a comma (pasted comma lists split too); Backspace on an
 * empty input removes the last tag; each chip has a remove button.
 *
 * React port of {@link import('@iris-ui/vue').IrisTagInput}.
 */
export function IrisTagInput({
  value,
  defaultValue = [],
  onValueChange,
  placeholder,
  disabled = false,
  invalid = false,
  max,
  allowDuplicates = false,
  id,
  ariaDescribedby,
  style,
  className,
  ...rest
}: IrisTagInputProps): React.ReactElement {
  const { t } = useI18n()
  const isControlled = value !== undefined
  const [internal, setInternal] = React.useState<string[]>(defaultValue)
  const tags = isControlled ? (value as string[]) : internal
  const [input, setInput] = React.useState('')
  const [focused, setFocused] = React.useState(false)

  const setTags = (next: string[]) => {
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  const canAdd = (txt: string, list: string[]) =>
    !!txt && (allowDuplicates || !list.includes(txt)) && (!max || list.length < max)

  const addTag = () => {
    const txt = input.trim()
    if (txt && canAdd(txt, tags)) setTags([...tags, txt])
    setInput('')
  }

  const removeAt = (i: number) => {
    if (disabled) return
    setTags(tags.filter((_, k) => k !== i))
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw.includes(',')) {
      const parts = raw.split(',')
      const last = parts.pop() ?? ''
      let next = tags
      for (const p of parts) {
        const txt = p.trim()
        if (canAdd(txt, next)) next = [...next, txt]
      }
      if (next !== tags) setTags(next)
      setInput(last)
    } else {
      setInput(raw)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      e.preventDefault()
      removeAt(tags.length - 1)
    }
  }

  const borderColor = invalid
    ? 'var(--iris-danger)'
    : focused
      ? 'var(--iris-primary)'
      : 'var(--iris-border)'

  return (
    <div
      data-iris-tag-input=""
      data-state={invalid ? 'invalid' : focused ? 'focused' : 'idle'}
      className={className}
      {...rest}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        minHeight: 34,
        background: 'var(--iris-background)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--iris-radius-md, 6px)',
        opacity: disabled ? 0.6 : 1,
        boxShadow: focused ? `0 0 0 3px rgba(99, 102, 241, 0.18)` : 'none',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        ...style,
      }}
    >
      {tags.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          data-iris-tag-input-tag=""
          data-value={tag}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            fontSize: 13,
            background: 'var(--iris-surface)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-sm, 4px)',
            color: 'var(--iris-foreground)',
          }}
        >
          {tag}
          <button
            type="button"
            data-iris-tag-input-remove=""
            aria-label={t('tagInput.remove', { tag })}
            disabled={disabled}
            onClick={() => removeAt(i)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--iris-muted)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        data-iris-tag-input-field=""
        value={input}
        placeholder={tags.length === 0 ? placeholder : undefined}
        disabled={disabled}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={ariaDescribedby}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1,
          minWidth: 80,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--iris-foreground)',
          fontFamily: 'inherit',
          fontSize: 14,
          padding: '2px 0',
        }}
      />
    </div>
  )
}
