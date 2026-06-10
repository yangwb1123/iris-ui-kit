<script lang="ts">
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  type RatingSize = 'sm' | 'md' | 'lg'

  const SIZE_MAP: Record<RatingSize, number> = { sm: 16, md: 22, lg: 28 }

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }

  function snap(value: number, step: number): number {
    return Math.round(value / step) * step
  }

  let {
    value: valueProp = 0,
    max = 5,
    allowHalf = false,
    readonly = false,
    disabled = false,
    clearable = true,
    size = 'md',
    invalid = false,
    label,
    id,
    ariaDescribedby,
    onchange,
    style,
    ...rest
  }: {
    value?: number
    max?: number
    allowHalf?: boolean
    readonly?: boolean
    disabled?: boolean
    clearable?: boolean
    size?: RatingSize
    invalid?: boolean
    label?: string
    id?: string
    ariaDescribedby?: string
    onchange?: (value: number) => void
    style?: string
    [key: string]: unknown
  } = $props()

  let hover = $state<number | null>(null)

  const step = $derived(allowHalf ? 0.5 : 1)
  const value = $derived(clamp(valueProp ?? 0, 0, max))
  const interactive = $derived(!readonly && !disabled)
  const display = $derived(hover !== null ? hover : value)
  const fillColor = $derived(invalid ? 'var(--iris-danger)' : 'var(--iris-warning, #f59e0b)')
  const px = $derived(SIZE_MAP[size])

  function setValue(next: number): void {
    const v = clamp(snap(next, step), 0, max)
    if (v === value) return
    onchange?.(v)
  }

  function valueAt(i: number, event: MouseEvent): number {
    if (!allowHalf) return i + 1
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const past = event.clientX - rect.left
    return past < rect.width / 2 ? i + 0.5 : i + 1
  }

  function onClick(i: number, event: MouseEvent): void {
    if (!interactive) return
    let next = valueAt(i, event)
    if (clearable && next === value) next = 0
    setValue(next)
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!interactive) return
    let next = value
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = value + step
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        next = value - step
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = max
        break
      default:
        return
    }
    event.preventDefault()
    setValue(next)
  }
</script>

<div
  {...rest}
  data-iris-rating
  data-iris-rating-size={size}
  data-state={invalid ? 'invalid' : 'idle'}
  role="slider"
  {id}
  tabindex={interactive ? 0 : -1}
  aria-label={label ?? t('rating.label')}
  aria-valuemin={0}
  aria-valuemax={max}
  aria-valuenow={value}
  aria-valuetext={t('rating.value', { value, max })}
  aria-readonly={readonly ? 'true' : undefined}
  aria-disabled={disabled ? 'true' : undefined}
  aria-invalid={invalid ? 'true' : undefined}
  aria-describedby={ariaDescribedby}
  onkeydown={onKeyDown}
  onmouseleave={() => { hover = null }}
  style="display:inline-flex; gap:{Math.round(px * 0.18)}px; line-height:1; color:var(--iris-border); cursor:{interactive ? 'pointer' : 'default'}; opacity:{disabled ? '0.6' : '1'}; outline:none; direction:inherit;{style ? ' ' + style : ''}"
>
  {#each Array.from({ length: max }, (_u, i) => i) as i (i)}
    {@const fill = clamp(display - i, 0, 1) * 100}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <span
      role="presentation"
      data-iris-rating-star
      data-filled={fill >= 100 ? 'true' : fill > 0 ? 'half' : undefined}
      onclick={(e) => onClick(i, e)}
      onmousemove={interactive ? (e: MouseEvent) => { hover = valueAt(i, e) } : undefined}
      style="position:relative; display:inline-block; width:{px}px; height:{px}px; font-size:{px}px;"
    >
      <span aria-hidden="true">★</span>
      <span
        aria-hidden="true"
        style="position:absolute; inset-block-start:0; inset-inline-start:0; overflow:hidden; width:{fill}%; color:{fillColor}; white-space:nowrap;"
      >★</span>
    </span>
  {/each}
</div>
