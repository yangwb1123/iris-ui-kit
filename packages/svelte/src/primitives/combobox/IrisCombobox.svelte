<script lang="ts">
  import { generateId } from '@iris-ui/core'
  import { useI18n } from '../../i18n'

  export type IrisComboboxSize = 'sm' | 'md' | 'lg'

  export interface IrisComboboxOption {
    label: string
    value: string
    disabled?: boolean
  }

  interface Props {
    value?: string
    options?: IrisComboboxOption[]
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    size?: IrisComboboxSize
    emptyText?: string
    id?: string
    onValueChange?: (value: string) => void
    style?: string
    [key: string]: unknown
  }

  let {
    value = '',
    options = [],
    placeholder,
    disabled = false,
    invalid = false,
    size = 'md',
    emptyText,
    id,
    onValueChange,
    style,
    ...rest
  }: Props = $props()

  const { t } = useI18n()

  const baseId = generateId()
  const listboxId = `${baseId}-listbox`
  const optionId = (i: number) => `${baseId}-opt-${i}`

  let query = $state('')
  let filtering = $state(false)
  let open = $state(false)
  let activeIndex = $state(-1)
  let focused = $state(false)

  const selected = $derived(options.find((o) => o.value === value))
  const display = $derived(filtering ? query : (selected?.label ?? ''))
  const filtered = $derived(() => {
    const needle = query.trim().toLowerCase()
    return filtering && needle
      ? options.filter((o) => o.label.toLowerCase().startsWith(needle))
      : options
  })

  const SIZE_MAP: Record<
    IrisComboboxSize,
    { padding: string; fontSize: string; minHeight: string }
  > = {
    sm: { padding: '4px 8px', fontSize: '12px', minHeight: '28px' },
    md: { padding: '6px 12px', fontSize: '14px', minHeight: '34px' },
    lg: { padding: '8px 12px', fontSize: '16px', minHeight: '40px' },
  }
  const sz = $derived(SIZE_MAP[size])

  function close(): void {
    open = false
    filtering = false
    activeIndex = -1
  }

  function selectOption(opt: IrisComboboxOption): void {
    if (opt.disabled) return
    onValueChange?.(opt.value)
    query = ''
    close()
  }

  function handleInput(e: Event): void {
    query = (e.target as HTMLInputElement).value
    filtering = true
    open = true
    activeIndex = 0
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (disabled) return
    const list = filtered()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        open = true
        filtering = false
        activeIndex = 0
        return
      }
      activeIndex = Math.min(list.length - 1, activeIndex + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (open) activeIndex = Math.max(0, activeIndex - 1)
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && list[activeIndex]) {
        e.preventDefault()
        selectOption(list[activeIndex])
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        close()
      }
    } else if (e.key === 'Home') {
      if (open) {
        e.preventDefault()
        activeIndex = 0
      }
    } else if (e.key === 'End') {
      if (open) {
        e.preventDefault()
        activeIndex = list.length - 1
      }
    }
  }

  const borderColor = $derived(
    invalid ? 'var(--iris-danger)' : focused ? 'var(--iris-primary)' : 'var(--iris-border)',
  )
  const activeId = $derived(
    open && activeIndex >= 0 && filtered()[activeIndex] ? optionId(activeIndex) : undefined,
  )
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->

<div
  {...rest}
  data-iris-combobox
  data-iris-combobox-size={size}
  data-state={open ? 'open' : 'closed'}
  style="position: relative; display: inline-block; min-width: 200px;{style ? ' ' + style : ''}"
>
  <input
    {id}
    type="text"
    role="combobox"
    autocomplete="off"
    spellcheck={false}
    value={display}
    {placeholder}
    disabled={disabled || undefined}
    aria-expanded={open ? 'true' : 'false'}
    aria-controls={listboxId}
    aria-autocomplete="list"
    aria-activedescendant={activeId}
    aria-invalid={invalid ? 'true' : undefined}
    data-iris-combobox-input
    oninput={handleInput}
    onkeydown={handleKeyDown}
    onfocus={() => {
      if (disabled) return
      focused = true
      open = true
      filtering = false
    }}
    onblur={() => {
      focused = false
      close()
    }}
    style="box-sizing: border-box; width: 100%; padding: {sz.padding}; min-height: {sz.minHeight}; font-size: {sz.fontSize}; font-family: inherit; color: var(--iris-foreground); background: var(--iris-background); border: 1px solid {borderColor}; border-radius: var(--iris-radius-md, 6px); outline: none; opacity: {disabled
      ? '0.6'
      : '1'}; box-shadow: {focused
      ? `0 0 0 3px ${invalid ? 'rgba(239,68,68,0.18)' : 'rgba(99,102,241,0.18)'}`
      : 'none'}; transition: border-color 120ms ease, box-shadow 120ms ease"
  />
  {#if open}
    <ul
      id={listboxId}
      role="listbox"
      data-iris-combobox-listbox
      style="position: absolute; inset-inline-start: 0; inset-inline-end: 0; top: 100%; margin-block-start: 4px; max-height: 240px; overflow-y: auto; list-style: none; margin: 0; padding: 4px; z-index: 50; background: var(--iris-background); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); box-shadow: 0 8px 24px rgba(0,0,0,0.12)"
    >
      {#if filtered().length === 0}
        <li
          data-iris-combobox-empty
          aria-disabled="true"
          style="padding: 6px 10px; color: var(--iris-muted); font-size: {sz.fontSize}"
        >
          {emptyText ?? t('combobox.empty')}
        </li>
      {:else}
        {#each filtered() as opt, i}
          <li
            id={optionId(i)}
            role="option"
            aria-selected={opt.value === value ? 'true' : 'false'}
            aria-disabled={opt.disabled ? 'true' : undefined}
            data-iris-combobox-option
            data-active={i === activeIndex ? 'true' : undefined}
            onmousedown={(e) => e.preventDefault()}
            onmouseenter={() => {
              activeIndex = i
            }}
            onclick={() => selectOption(opt)}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                selectOption(opt)
              }
            }}
            style="padding: 6px 10px; font-size: {sz.fontSize}; border-radius: var(--iris-radius-sm, 4px); cursor: {opt.disabled
              ? 'not-allowed'
              : 'pointer'}; color: {opt.disabled
              ? 'var(--iris-muted)'
              : 'var(--iris-foreground)'}; background: {i === activeIndex
              ? 'var(--iris-surface-hover, rgba(99,102,241,0.1))'
              : 'transparent'}; font-weight: {opt.value === value ? '600' : '400'}"
          >
            {opt.label}
          </li>
        {/each}
      {/if}
    </ul>
  {/if}
</div>
