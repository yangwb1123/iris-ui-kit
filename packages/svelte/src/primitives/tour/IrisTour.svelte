<script lang="ts">
  import { portal } from '../../internal/portal'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  export interface IrisTourStep {
    target?: () => HTMLElement | null
    title?: string
    description?: string
  }

  interface Rect {
    top: number
    left: number
    width: number
    height: number
  }

  interface Props {
    steps?: IrisTourStep[]
    open?: boolean
    onUpdateOpen?: (open: boolean) => void
    onChange?: (index: number) => void
    onClose?: () => void
    onFinish?: () => void
    style?: string
    [key: string]: unknown
  }

  let {
    steps = [],
    open = false,
    onUpdateOpen,
    onChange,
    onClose,
    onFinish,
    style,
    ...rest
  }: Props = $props()

  let step = $state(0)
  let spotlight = $state<Rect | null>(null)

  function computeSpotlight(currentStep: number): void {
    const data = steps[currentStep]
    const el = data?.target?.()
    if (el) {
      const r = el.getBoundingClientRect()
      spotlight = { top: r.top, left: r.left, width: r.width, height: r.height }
    } else {
      spotlight = null
    }
  }

  // Reset step when tour opens; track previous open value to only reset on rising edge
  let prevOpen = false
  $effect(() => {
    const isOpen = open
    if (isOpen && !prevOpen) {
      step = 0
      computeSpotlight(0)
    }
    prevOpen = isOpen
  })

  // Recompute spotlight when step changes
  $effect(() => {
    const s = step
    computeSpotlight(s)
  })

  function close(): void {
    onUpdateOpen?.(false)
    onClose?.()
  }

  $effect(() => {
    if (!open || typeof document === 'undefined') return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const btnBase =
    'padding: var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px); font-size: var(--iris-font-size-sm, 13px); border-radius: var(--iris-radius-sm, 4px); cursor: pointer'
  const btnGhost = `${btnBase}; border: 1px solid var(--iris-border); background: transparent; color: var(--iris-foreground)`
  const btnPrimary = `${btnBase}; border: none; background: var(--iris-primary); color: var(--iris-primary-foreground, #fff)`
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->

{#if open && steps.length > 0}
  {@const total = steps.length}
  {@const current = Math.min(step, total - 1)}
  {@const data = steps[current]}
  {@const isLast = current === total - 1}
  {@const sl = spotlight}
  {@const spotlit = !!sl && sl.width > 0}

  {#if data}
    <div {...rest} data-iris-tour use:portal style={style ?? ''}>
      <!-- Backdrop -->
      <div
        role="presentation"
        data-iris-tour-backdrop
        onpointerdown={close}
        style="position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1000"
      ></div>

      <!-- Spotlight -->
      {#if spotlit && sl}
        <div
          data-iris-tour-spotlight
          style="position: fixed; top: {sl.top - 4}px; inset-inline-start: {sl.left -
            4}px; width: {sl.width + 8}px; height: {sl.height +
            8}px; border: 2px solid var(--iris-primary); border-radius: var(--iris-radius-sm, 4px); box-shadow: 0 0 0 9999px var(--iris-mask, rgba(0,0,0,0.45)); z-index: 1001; pointer-events: none"
        ></div>
      {/if}

      <!-- Card -->
      <div
        data-iris-tour-card
        role="dialog"
        aria-modal="true"
        aria-label={data.title ?? t('tour.step', { current: current + 1, total })}
        style="position: fixed; z-index: 1002; max-width: 320px; padding: 16px; background: var(--iris-background); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); box-shadow: var(--iris-shadow-lg); {spotlit &&
        sl
          ? `top: ${sl.top + sl.height + 12}px; inset-inline-start: ${sl.left}px`
          : 'top: 50%; inset-inline-start: 50%; transform: translate(-50%, -50%)'}"
      >
        {#if data.title != null}
          <div data-iris-tour-title style="font-weight: 600; margin-block-end: 6px">
            {data.title}
          </div>
        {/if}
        {#if data.description != null}
          <div
            data-iris-tour-description
            style="font-size: var(--iris-font-size-md, 14px); color: var(--iris-foreground); margin-block-end: 12px"
          >
            {data.description}
          </div>
        {/if}
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px">
          <span
            data-iris-tour-indicator
            style="font-size: var(--iris-font-size-xs, 12px); color: var(--iris-muted)"
            >{current + 1} / {total}</span
          >
          <div style="display: flex; gap: 8px">
            <button type="button" data-iris-tour-skip onclick={close} style={btnGhost}
              >{t('tour.skip')}</button
            >
            {#if current > 0}
              <button
                type="button"
                data-iris-tour-prev
                onclick={() => {
                  step = current - 1
                  onChange?.(current - 1)
                }}
                style={btnGhost}>{t('tour.prev')}</button
              >
            {/if}
            <button
              type="button"
              data-iris-tour-next
              onclick={() => {
                if (!isLast) {
                  step = current + 1
                  onChange?.(current + 1)
                } else {
                  onFinish?.()
                  close()
                }
              }}
              style={btnPrimary}
            >
              {isLast ? t('tour.finish') : t('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
{/if}
