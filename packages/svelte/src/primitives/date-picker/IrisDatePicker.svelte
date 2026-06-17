<script lang="ts">
  import IrisCalendar from '../calendar/IrisCalendar.svelte'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  interface Props {
    value?: Date | null
    min?: Date
    max?: Date
    weekStartsOn?: number
    locale?: string
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    id?: string
    onValueChange?: (date: Date | null) => void
    style?: string
    class?: string
  }

  let {
    value = null,
    min,
    max,
    weekStartsOn = 0,
    locale,
    placeholder,
    disabled = false,
    invalid = false,
    id,
    onValueChange,
    style,
    class: className,
    ...rest
  }: Props = $props()

  let open = $state(false)
  let containerEl = $state<HTMLElement | undefined>(undefined)

  function formatISODate(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  function formatDisplay(date: Date | null): string {
    if (!date) return ''
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
  }

  const display = $derived(formatDisplay(value))

  function toggle() {
    if (!disabled) open = !open
  }

  function onSelect(date: Date | null) {
    onValueChange?.(date)
    if (date) open = false
  }

  function onDocDown(e: MouseEvent) {
    if (open && containerEl && !containerEl.contains(e.target as Node)) {
      open = false
    }
  }

  $effect(() => {
    if (open) {
      document.addEventListener('mousedown', onDocDown)
    } else {
      document.removeEventListener('mousedown', onDocDown)
    }
    return () => document.removeEventListener('mousedown', onDocDown)
  })
</script>

<div
  bind:this={containerEl}
  data-iris-date-picker
  style:position="relative"
  style:display="inline-flex"
  {style}
  class={className}
>
  <button
    type="button"
    {id}
    {disabled}
    aria-invalid={invalid ? 'true' : undefined}
    aria-expanded={open}
    aria-haspopup="dialog"
    data-iris-date-picker-trigger
    data-iris-date-picker-iso={value ? formatISODate(value) : undefined}
    data-state={open ? 'open' : 'closed'}
    onclick={toggle}
    style:display="inline-flex"
    style:align-items="center"
    style:gap="6px"
    style:padding="6px 12px"
    style:background="var(--iris-background)"
    style:color={value ? 'var(--iris-foreground)' : 'var(--iris-muted)'}
    style:border={`1px solid ${invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`}
    style:border-radius="var(--iris-radius-md, 6px)"
    style:cursor={disabled ? 'not-allowed' : 'pointer'}
    style:opacity={disabled ? '0.6' : '1'}
    style:font-size="14px"
    style:font-family="inherit"
    style:min-height="34px"
    style:min-width="180px"
    style:text-align="start"
    {...rest}
  >
    {display || (placeholder ?? t('datePicker.placeholder'))}
  </button>

  {#if open}
    <div
      data-iris-date-picker-content
      role="dialog"
      aria-modal="true"
      style:position="absolute"
      style:top="calc(100% + 4px)"
      style:left="0"
      style:z-index="50"
    >
      <IrisCalendar
        {value}
        {min}
        {max}
        {weekStartsOn}
        {locale}
        {disabled}
        onValueChange={onSelect}
        style="border: none; background: transparent;"
      />
    </div>
  {/if}
</div>
