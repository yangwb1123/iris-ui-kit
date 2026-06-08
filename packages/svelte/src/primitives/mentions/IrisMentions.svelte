<script lang="ts">
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
    value = '',
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

  function onInput(e: Event) {
    const ta = e.target as HTMLTextAreaElement
    const text = ta.value
    const caret = ta.selectionStart ?? text.length
    onValueChange?.(text)
    active = detect(text, caret)
    activeIndex = 0
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) return
    const list = filtered()
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        activeIndex = (activeIndex + 1) % list.length
        break
      case 'ArrowUp':
        e.preventDefault()
        activeIndex = (activeIndex - 1 + list.length) % list.length
        break
      case 'Enter':
        if (list[activeIndex]) {
          e.preventDefault()
          selectOption(list[activeIndex]!)
        }
        break
      case 'Escape':
        active = null
        break
    }
  }

  function selectOption(opt: IrisMentionOption) {
    if (!active || !textareaEl) return
    const before = value.slice(0, active.start)
    const after = value.slice(active.start + 1 + active.query.length)
    const newVal = `${before}${prefix}${opt.label} ${after}`
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
    {value}
    {placeholder}
    {rows}
    {disabled}
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
