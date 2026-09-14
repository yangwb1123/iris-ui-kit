<script lang="ts">
  import {
    formatLocalYearMonth,
    isOutOfMonthRange,
    safeLocale,
    startOfMonth,
  } from '../calendar/dateUtils'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  interface MonthOption {
    date: Date
    index: number
    label: string
    value: string
  }

  export interface IrisMonthPickerProps {
    value?: Date | null
    /** Initial visible year when no value is selected. */
    defaultMonth?: Date | null
    /** Inclusive month bounds; individual days are ignored. */
    min?: Date
    max?: Date
    locale?: string
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    id?: string
    ariaDescribedby?: string
    onValueChange?: (date: Date | null) => void
    style?: string
    class?: string
  }

  let {
    value = null,
    defaultMonth = null,
    min,
    max,
    locale,
    placeholder,
    disabled = false,
    invalid = false,
    id,
    ariaDescribedby,
    onValueChange,
    style,
    class: className,
    ...rest
  }: IrisMonthPickerProps = $props()

  function isValidDate(candidate: Date | null | undefined): candidate is Date {
    return candidate instanceof Date && Number.isFinite(candidate.getTime())
  }

  function monthAt(year: number, index: number): Date {
    return new Date(year, index, 1)
  }

  function formatMonthLabel(date: Date): string {
    return new Intl.DateTimeFormat(safeLocale(locale), { month: 'short' }).format(date)
  }

  function formatDisplay(date: Date | null): string {
    if (!isValidDate(date)) return ''
    return new Intl.DateTimeFormat(safeLocale(locale), {
      month: 'long',
      year: 'numeric',
    }).format(startOfMonth(date))
  }

  function yearHasSelectableMonth(year: number): boolean {
    for (let index = 0; index < 12; index += 1) {
      if (!isOutOfMonthRange(monthAt(year, index), min, max)) return true
    }
    return false
  }

  function nextEnabledIndex(current: number, delta: number, year: number): number {
    let next = current + delta
    while (next >= 0 && next <= 11) {
      if (!isOutOfMonthRange(monthAt(year, next), min, max)) return next
      next += delta
    }
    return current
  }

  let visibleYear = $state(new Date().getFullYear())
  let focusedIndex = $state(0)
  let initialized = false
  let open = $state(false)
  let containerEl = $state<HTMLElement | undefined>(undefined)

  $effect(() => {
    const selected = value
    if (initialized) {
      if (isValidDate(selected)) {
        visibleYear = selected.getFullYear()
        focusedIndex = selected.getMonth()
      }
      return
    }
    const initialMonth = isValidDate(selected)
      ? selected
      : isValidDate(defaultMonth)
        ? defaultMonth
        : new Date()
    visibleYear = initialMonth.getFullYear()
    focusedIndex = isValidDate(selected) ? selected.getMonth() : 0
    initialized = true
  })

  $effect(() => {
    if (!open) return
    function onDocumentMouseDown(event: MouseEvent) {
      if (containerEl && !containerEl.contains(event.target as Node)) open = false
    }
    document.addEventListener('mousedown', onDocumentMouseDown)
    return () => document.removeEventListener('mousedown', onDocumentMouseDown)
  })

  const selectedValue = $derived(
    isValidDate(value) ? formatLocalYearMonth(startOfMonth(value)) : undefined,
  )
  const display = $derived(formatDisplay(value))
  const months = $derived<MonthOption[]>(
    Array.from({ length: 12 }, (_, index) => {
      const date = monthAt(visibleYear, index)
      return {
        date,
        index,
        label: formatMonthLabel(date),
        value: formatLocalYearMonth(date),
      }
    }),
  )
  const previousYearDisabled = $derived(!yearHasSelectableMonth(visibleYear - 1))
  const nextYearDisabled = $derived(!yearHasSelectableMonth(visibleYear + 1))

  function focusMonth(index: number) {
    focusedIndex = index
    queueMicrotask(() => {
      const target = containerEl?.querySelector<HTMLButtonElement>(
        `[data-iris-month-picker-month="${months[index]?.value ?? ''}"]`,
      )
      target?.focus()
    })
  }

  function selectMonth(index: number) {
    if (disabled) return
    const date = monthAt(visibleYear, index)
    if (isOutOfMonthRange(date, min, max)) return
    onValueChange?.(startOfMonth(date))
    open = false
  }

  function moveYear(offset: number) {
    if (disabled) return
    const nextYear = visibleYear + offset
    if (!yearHasSelectableMonth(nextYear)) return
    visibleYear = nextYear
    if (isOutOfMonthRange(monthAt(nextYear, focusedIndex), min, max)) {
      const first = Array.from({ length: 12 }, (_, index) => index).find(
        (index) => !isOutOfMonthRange(monthAt(nextYear, index), min, max),
      )
      if (first !== undefined) focusedIndex = first
    }
  }

  function onMonthKeydown(event: KeyboardEvent) {
    let delta = 0
    if (event.key === 'ArrowLeft') delta = -1
    if (event.key === 'ArrowRight') delta = 1
    if (event.key === 'ArrowUp') delta = -3
    if (event.key === 'ArrowDown') delta = 3
    if (event.key === 'Home') {
      event.preventDefault()
      const first = months.find((month) => !isOutOfMonthRange(month.date, min, max))
      if (first) focusMonth(first.index)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      const last = [...months].reverse().find((month) => !isOutOfMonthRange(month.date, min, max))
      if (last) focusMonth(last.index)
      return
    }
    if (!delta) return
    const next = nextEnabledIndex(focusedIndex, delta, visibleYear)
    if (next === focusedIndex) return
    event.preventDefault()
    focusMonth(next)
  }
</script>

<div
  bind:this={containerEl}
  data-iris-month-picker
  style:position="relative"
  style:display="inline-block"
  {style}
  class={className}
  {...rest}
>
  <!-- svelte-ignore a11y_role_supports_aria_props_implicit -->
  <button
    type="button"
    {id}
    {disabled}
    aria-invalid={invalid ? 'true' : undefined}
    aria-describedby={ariaDescribedby}
    aria-haspopup="dialog"
    aria-expanded={open}
    data-iris-month-picker-trigger
    data-iris-month-picker-value={selectedValue}
    data-state={open ? 'open' : 'closed'}
    onclick={() => !disabled && (open = !open)}
    style:display="inline-flex"
    style:align-items="center"
    style:padding="var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)"
    style:background="var(--iris-background)"
    style:color={selectedValue ? 'var(--iris-foreground)' : 'var(--iris-muted)'}
    style:border={`1px solid ${invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`}
    style:border-radius="var(--iris-radius-md, 6px)"
    style:cursor={disabled ? 'not-allowed' : 'pointer'}
    style:opacity={disabled ? '0.6' : '1'}
    style:font-size="var(--iris-font-size-md, 14px)"
    style:font-family="inherit"
    style:min-height="var(--iris-control-height-md, 34px)"
    style:min-width="180px"
    style:text-align="start"
  >
    {display || placeholder || t('monthPicker.placeholder')}
  </button>

  {#if open}
    <div
      data-iris-month-picker-content
      role="dialog"
      aria-modal="true"
      style:position="absolute"
      style:top="calc(100% + 4px)"
      style:left="0"
      style:z-index="50"
      style:background="var(--iris-surface-floating)"
      style:color="var(--iris-foreground)"
      style:border="1px solid var(--iris-border)"
      style:border-radius="var(--iris-radius-md, 6px)"
      style:padding="var(--iris-padding-sm, 8px)"
      style:box-shadow="var(--iris-shadow-lg)"
      style:min-width="18rem"
      tabindex="-1"
      onmousedown={(event) => event.preventDefault()}
    >
      <div
        data-iris-month-picker-panel
        style:display="flex"
        style:flex-direction="column"
        style:gap="var(--iris-space-sm, 12px)"
      >
        <div
          data-iris-month-picker-header
          style:display="flex"
          style:align-items="center"
          style:justify-content="space-between"
          style:gap="var(--iris-space-xs, 8px)"
        >
          <button
            type="button"
            aria-label={t('monthPicker.previousYear')}
            data-iris-month-picker-prev
            disabled={disabled || previousYearDisabled}
            onclick={() => moveYear(-1)}
            style:width="32px"
            style:height="32px"
            style:padding="0"
            style:background="transparent"
            style:color="var(--iris-foreground)"
            style:border="1px solid transparent"
            style:border-radius="var(--iris-radius-sm, 4px)"
            style:cursor={disabled || previousYearDisabled ? 'not-allowed' : 'pointer'}
          >
            ‹
          </button>
          <strong data-iris-month-picker-year aria-live="polite">{visibleYear}</strong>
          <button
            type="button"
            aria-label={t('monthPicker.nextYear')}
            data-iris-month-picker-next
            disabled={disabled || nextYearDisabled}
            onclick={() => moveYear(1)}
            style:width="32px"
            style:height="32px"
            style:padding="0"
            style:background="transparent"
            style:color="var(--iris-foreground)"
            style:border="1px solid transparent"
            style:border-radius="var(--iris-radius-sm, 4px)"
            style:cursor={disabled || nextYearDisabled ? 'not-allowed' : 'pointer'}
          >
            ›
          </button>
        </div>
        <div
          role="radiogroup"
          aria-label={t('monthPicker.months', { year: visibleYear })}
          data-iris-month-picker-grid
          style:display="grid"
          style:grid-template-columns="repeat(3, minmax(0, 1fr))"
          style:gap="var(--iris-space-xs, 8px)"
        >
          {#each months as month (month.value)}
            {@const selected = month.value === selectedValue}
            {@const monthDisabled = isOutOfMonthRange(month.date, min, max)}
            <button
              type="button"
              role="radio"
              aria-checked={selected ? 'true' : 'false'}
              aria-label={month.label}
              data-iris-month-picker-month={month.value}
              disabled={disabled || monthDisabled}
              tabindex={month.index === focusedIndex ? 0 : -1}
              onfocus={() => (focusedIndex = month.index)}
              onkeydown={onMonthKeydown}
              onclick={() => selectMonth(month.index)}
              style:display="inline-flex"
              style:align-items="center"
              style:justify-content="center"
              style:width="100%"
              style:min-height="var(--iris-control-height-sm, 28px)"
              style:padding="var(--iris-space-xs, 8px)"
              style:background={selected ? 'var(--iris-primary)' : 'transparent'}
              style:color={selected ? 'var(--iris-primary-foreground)' : 'var(--iris-foreground)'}
              style:border="1px solid var(--iris-border)"
              style:border-radius="var(--iris-radius-sm, 4px)"
              style:cursor={disabled || monthDisabled ? 'not-allowed' : 'pointer'}
              style:opacity={monthDisabled ? '0.45' : '1'}
              style:font-family="inherit"
              style:white-space="nowrap"
            >
              {month.label}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
