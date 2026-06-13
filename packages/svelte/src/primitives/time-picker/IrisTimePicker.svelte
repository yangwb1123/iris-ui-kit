<script lang="ts">
  import { useI18n } from '../../i18n'

  export type IrisTimePickerFormat = '12h' | '24h'

  export interface IrisTimeValue {
    hours: number
    minutes: number
  }

  interface Props {
    value?: IrisTimeValue | null
    defaultValue?: IrisTimeValue
    onValueChange?: (value: IrisTimeValue) => void
    format?: IrisTimePickerFormat
    /** Step in minutes for the minute input (1, 5, 10, 15, 30). */
    minuteStep?: number
    disabled?: boolean
    invalid?: boolean
    /** id forwarded to the hours input. Set by IrisFormField. */
    id?: string
    /** Forwarded as aria-describedby on the hours input. Set by IrisFormField. */
    ariaDescribedby?: string
    style?: string
    class?: string
    [key: string]: unknown
  }

  let {
    value = undefined,
    defaultValue = { hours: 0, minutes: 0 },
    onValueChange,
    format = '24h',
    minuteStep = 1,
    disabled = false,
    invalid = false,
    id,
    ariaDescribedby,
    style,
    class: className,
    ...rest
  }: Props = $props()

  const { t } = useI18n()

  function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n))
  }
  function pad2(n: number): string {
    return n.toString().padStart(2, '0')
  }

  // Controlled when `value` is supplied; otherwise self-manage from defaultValue.
  // Internal value is ALWAYS 24-hour { hours, minutes } (matches React/Vue/Solid).
  const isControlled = $derived(value !== undefined)
  // svelte-ignore state_referenced_locally
  let internal = $state<IrisTimeValue>(defaultValue)
  const current = $derived(isControlled ? (value ?? defaultValue) : internal)

  const meridiem = $derived(current.hours >= 12 ? 'PM' : 'AM')
  const displayH = $derived(
    format === '24h' ? current.hours : current.hours % 12 === 0 ? 12 : current.hours % 12,
  )

  function setValue(next: IrisTimeValue): void {
    if (!isControlled) internal = next
    onValueChange?.(next)
  }

  function setHours24(h24: number): void {
    setValue({ hours: clamp(h24, 0, 23), minutes: current.minutes })
  }
  function setMinutes(m: number): void {
    setValue({
      hours: current.hours,
      minutes: clamp(Math.round(m / minuteStep) * minuteStep, 0, 59),
    })
  }
  function toggleMeridiem(): void {
    if (disabled) return
    const h12 = current.hours % 12
    const newH24 = meridiem === 'PM' ? h12 : h12 + 12
    setValue({ hours: newH24, minutes: current.minutes })
  }

  function onHoursInput(e: Event): void {
    const v = parseInt((e.target as HTMLInputElement).value || '0', 10)
    if (Number.isNaN(v)) return
    if (format === '12h') {
      const h12 = clamp(v, 1, 12)
      const wrap = h12 === 12 ? 0 : h12
      setHours24(meridiem === 'PM' ? wrap + 12 : wrap)
    } else {
      setHours24(v)
    }
  }
  function onMinutesInput(e: Event): void {
    const v = parseInt((e.target as HTMLInputElement).value || '0', 10)
    if (Number.isNaN(v)) return
    setMinutes(v)
  }

  function stepHours(delta: number): void {
    const max = format === '12h' ? 12 : 23
    const min = format === '12h' ? 1 : 0
    let next = displayH + delta
    if (next < min) next = max
    if (next > max) next = min
    if (format === '12h') {
      const wrap = next === 12 ? 0 : next
      setHours24(meridiem === 'PM' ? wrap + 12 : wrap)
    } else {
      setHours24(next)
    }
  }
  function stepMinutes(delta: number): void {
    let next = current.minutes + delta * minuteStep
    if (next < 0) next = 60 - minuteStep
    if (next >= 60) next = 0
    setMinutes(next)
  }

  function onHoursKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      stepHours(1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      stepHours(-1)
    }
  }
  function onMinutesKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      stepMinutes(1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      stepMinutes(-1)
    }
  }

  const fieldStyle =
    'width:48px;height:34px;padding:4px 6px;background:var(--iris-background);color:var(--iris-foreground);' +
    'border-radius:var(--iris-radius-sm, 4px);font-size:15px;font-family:inherit;text-align:center;outline:none;'
  const borderColor = $derived(invalid ? 'var(--iris-danger)' : 'var(--iris-border)')
</script>

<div
  {...rest}
  data-iris-time-picker
  data-disabled={disabled ? 'true' : undefined}
  class={className}
  style="display:inline-flex;align-items:center;gap:4px;{style ? ' ' + style : ''}"
>
  <input
    {id}
    type="number"
    inputmode="numeric"
    min={format === '12h' ? 1 : 0}
    max={format === '12h' ? 12 : 23}
    value={pad2(displayH)}
    {disabled}
    aria-label={t('timePicker.hours')}
    aria-describedby={ariaDescribedby}
    aria-invalid={invalid ? 'true' : undefined}
    data-iris-time-picker-hours
    oninput={onHoursInput}
    onkeydown={onHoursKey}
    style="{fieldStyle}border:1px solid {borderColor};"
  />
  <span aria-hidden="true" style="color:var(--iris-muted);font-size:15px;">:</span>
  <input
    type="number"
    inputmode="numeric"
    min={0}
    max={59}
    step={minuteStep}
    value={pad2(current.minutes)}
    {disabled}
    aria-label={t('timePicker.minutes')}
    data-iris-time-picker-minutes
    oninput={onMinutesInput}
    onkeydown={onMinutesKey}
    style="{fieldStyle}border:1px solid {borderColor};"
  />
  {#if format === '12h'}
    <button
      type="button"
      {disabled}
      aria-label={t('timePicker.togglePeriod')}
      data-iris-time-picker-meridiem={meridiem}
      onclick={toggleMeridiem}
      style="height:34px;padding:4px 8px;background:var(--iris-background);color:var(--iris-foreground);border:1px solid var(--iris-border);border-radius:var(--iris-radius-sm, 4px);cursor:{disabled ? 'not-allowed' : 'pointer'};font-size:13px;font-family:inherit;font-weight:600;"
    >{meridiem}</button>
  {/if}
</div>
