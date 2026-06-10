<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  interface Props {
    value?: string[]
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    max?: number
    allowDuplicates?: boolean
    id?: string
    ariaDescribedby?: string
    style?: string
    onchange?: (tags: string[]) => void
    [key: string]: unknown
  }

  let {
    value = [],
    placeholder,
    disabled = false,
    invalid = false,
    max,
    allowDuplicates = false,
    id,
    ariaDescribedby,
    style,
    onchange,
    ...rest
  }: Props = $props()

  let inputText = $state('')
  let focused = $state(false)

  function canAdd(txt: string, list: string[]) {
    return (
      !!txt &&
      (allowDuplicates || !list.includes(txt)) &&
      (!max || list.length < max)
    )
  }

  function addTag() {
    const txt = inputText.trim()
    if (txt && canAdd(txt, value)) {
      onchange?.([...value, txt])
    }
    inputText = ''
  }

  function removeAt(i: number) {
    if (disabled) return
    onchange?.(value.filter((_, k) => k !== i))
  }

  function handleInput(e: Event) {
    const raw = (e.target as HTMLInputElement).value
    if (raw.includes(',')) {
      const parts = raw.split(',')
      const last = parts.pop() ?? ''
      let next = value
      for (const p of parts) {
        const txt = p.trim()
        if (canAdd(txt, next)) next = [...next, txt]
      }
      if (next !== value) onchange?.(next)
      inputText = last
    } else {
      inputText = raw
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && inputText === '' && value.length > 0) {
      e.preventDefault()
      removeAt(value.length - 1)
    }
  }

  const wrapperStyle = $derived.by(() => {
    const borderColor = invalid
      ? 'var(--iris-danger)'
      : focused
        ? 'var(--iris-primary)'
        : 'var(--iris-border)'
    return styleToString({
      display: 'flex',
      'flex-wrap': 'wrap',
      'align-items': 'center',
      gap: '6px',
      padding: '4px 8px',
      'min-height': '34px',
      background: 'var(--iris-background)',
      border: `1px solid ${borderColor}`,
      'border-radius': 'var(--iris-radius-md, 6px)',
      opacity: disabled ? '0.6' : '1',
      'box-shadow': focused ? '0 0 0 3px rgba(99, 102, 241, 0.18)' : 'none',
      transition: 'border-color 120ms ease, box-shadow 120ms ease',
    })
  })

  const tagStyle = styleToString({
    display: 'inline-flex',
    'align-items': 'center',
    gap: '4px',
    padding: '2px 6px',
    'font-size': '13px',
    background: 'var(--iris-surface)',
    border: '1px solid var(--iris-border)',
    'border-radius': 'var(--iris-radius-sm, 4px)',
    color: 'var(--iris-foreground)',
  })
</script>

<div
  {...rest}
  data-iris-tag-input
  data-state={invalid ? 'invalid' : focused ? 'focused' : 'idle'}
  style={mergeStyle(wrapperStyle, style)}
>
  {#each value as tag, i (tag + '-' + i)}
    <span data-iris-tag-input-tag data-value={tag} style={tagStyle}>
      {tag}
      <button
        type="button"
        data-iris-tag-input-remove
        aria-label={t('tagInput.remove', { tag })}
        {disabled}
        onclick={() => removeAt(i)}
        style="border: none; background: transparent; color: var(--iris-muted); cursor: {disabled ? 'not-allowed' : 'pointer'}; font-size: 14px; line-height: 1; padding: 0;"
      >×</button>
    </span>
  {/each}
  <input
    {id}
    type="text"
    data-iris-tag-input-field
    value={inputText}
    placeholder={value.length === 0 ? placeholder : undefined}
    {disabled}
    aria-invalid={invalid ? 'true' : undefined}
    aria-describedby={ariaDescribedby}
    oninput={handleInput}
    onkeydown={handleKeyDown}
    onfocus={() => { focused = true }}
    onblur={() => { focused = false }}
    style="flex: 1; min-width: 80px; border: none; outline: none; background: transparent; color: var(--iris-foreground); font-family: inherit; font-size: 14px; padding: 2px 0;"
  />
</div>
