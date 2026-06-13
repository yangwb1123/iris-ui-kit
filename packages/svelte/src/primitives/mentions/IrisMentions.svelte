<script lang="ts">
  import { generateId } from '@iris-ui/core'

  export interface IrisMentionOption {
    label: string
    value: string
  }

  interface ActiveMention {
    start: number
    query: string
  }

  interface Props {
    value?: string
    defaultValue?: string
    options?: IrisMentionOption[]
    prefix?: string
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    rows?: number
    id?: string
    onValueChange?: (value: string) => void
    style?: string
    class?: string
  }

  let {
    value = undefined,
    defaultValue = '',
    options = [],
    prefix = '@',
    placeholder,
    disabled = false,
    invalid = false,
    rows = 3,
    id,
    onValueChange,
    style,
    class: className,
    ...rest
  }: Props = $props()

  // Controlled when `value` is supplied; otherwise self-manage from defaultValue
  // so an uncontrolled textarea actually updates as the user types (previously
  // it bound straight to the prop and froze without a parent write-back).
  const isControlled = $derived(value !== undefined)
  // svelte-ignore state_referenced_locally
  let internal = $state(defaultValue)
  const text = $derived(isControlled ? (value as string) : internal)

  const baseId = generateId()
  const listboxId = `${baseId}-listbox`

  let textareaEl = $state<HTMLTextAreaElement | undefined>(undefined)
  let activeIndex = $state(0)
  let active = $state<ActiveMention | null>(null)

  function detect(text: string, caret: number): ActiveMention | null {
    let i = caret - 1
    while (i >= 0 && text.charAt(i) !== prefix) {
      if (/\s/.test(text.charAt(i))) return null
      i--
    }
    if (i < 0) return null
    if (i === 0 || /\s/.test(text.charAt(i - 1))) {
      return { start: i, query: text.slice(i + 1, caret) }
    }
    return null
  }

  const filtered = $derived(() => {
    if (!active) return []
    const q = active.query.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  })

  const open = $derived(active !== null && filtered().length > 0)
  const activeId = $derived(open ? `${baseId}-opt-${activeIndex}` : undefined)

  function onInput(e: Event) {
    const ta = e.target as HTMLTextAreaElement
    const next = ta.value
    const caret = ta.selectionStart ?? next.length
    if (!isControlled) internal = next
    onValueChange?.(next)
    active = detect(next, caret)
    activeIndex = 0
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) return
    const list = filtered()
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        activeIndex = Math.min(list.length - 1, activeIndex + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        activeIndex = Math.max(0, activeIndex - 1)
        break
      case 'Enter':
        if (list[activeIndex]) {
          e.preventDefault()
          selectOption(list[activeIndex]!)
        }
        break
      case 'Escape':
        e.preventDefault()
        active = null
        break
    }
  }

  function selectOption(opt: IrisMentionOption) {
    if (!active || !textareaEl) return
    const before = text.slice(0, active.start)
    const after = text.slice(active.start + 1 + active.query.length)
    const newVal = `${before}${prefix}${opt.label} ${after}`
    if (!isControlled) internal = newVal
    onValueChange?.(newVal)
    active = null
    textareaEl.focus()
  }
</script>

<div
  data-iris-mentions
  style:position="relative"
  style:display="inline-flex"
  style:flex-direction="column"
  style={style}
  class={className}
>
  <textarea
    bind:this={textareaEl}
    {id}
    value={text}
    {placeholder}
    {rows}
    {disabled}
    role="combobox"
    aria-autocomplete="list"
    aria-expanded={open}
    aria-controls={listboxId}
    aria-activedescendant={activeId}
    aria-invalid={invalid ? 'true' : undefined}
    data-iris-mentions-textarea
    oninput={onInput}
    onkeydown={onKeyDown}
    style:box-sizing="border-box"
    style:width="100%"
    style:padding="8px 12px"
    style:font-size="14px"
    style:font-family="inherit"
    style:color="var(--iris-foreground)"
    style:background={invalid ? 'var(--iris-background)' : 'var(--iris-background)'}
    style:border={`1px solid ${invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`}
    style:border-radius="var(--iris-radius-md, 6px)"
    style:outline="none"
    style:resize="vertical"
    {...rest}
  ></textarea>

  {#if open}
    <ul
      id={listboxId}
      data-iris-mentions-list
      role="listbox"
      style:position="absolute"
      style:left="0"
      style:top="100%"
      style:margin-top="4px"
      style:max-height="200px"
      style:overflow-y="auto"
      style:min-width="160px"
      style:padding="4px"
      style:z-index="50"
      style:list-style="none"
      style:margin-block-start="0"
      style:margin-block-end="0"
      style:padding-inline-start="0"
      style:background="var(--iris-background)"
      style:border="1px solid var(--iris-border)"
      style:border-radius="var(--iris-radius-md, 6px)"
      style:box-shadow="0 8px 24px rgba(0,0,0,0.12)"
    >
      {#each filtered() as opt, i (opt.value)}
        <li
          id={`${baseId}-opt-${i}`}
          role="option"
          aria-selected={i === activeIndex}
          data-iris-mentions-item
          data-state={i === activeIndex ? 'active' : 'idle'}
          onclick={() => selectOption(opt)}
          style:padding="6px 12px"
          style:cursor="pointer"
          style:font-size="14px"
          style:border-radius="var(--iris-radius-sm, 4px)"
          style:background={i === activeIndex ? 'var(--iris-surface-hover)' : 'transparent'}
          style:color="var(--iris-foreground)"
        >{opt.label}</li>
      {/each}
    </ul>
  {/if}
</div>
