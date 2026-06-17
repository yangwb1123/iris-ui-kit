<script lang="ts">
  import { getStepperContext, type IrisStepStatus } from './context'

  const STATUS_COLOR: Record<IrisStepStatus, string> = {
    pending: 'var(--iris-muted)',
    active: 'var(--iris-primary)',
    completed: 'var(--iris-success)',
    error: 'var(--iris-danger)',
  }

  let {
    title = '',
    description = '',
    status: statusProp,
    disabled = false,
    titleSnippet,
    descriptionSnippet,
    style,
    ...rest
  }: {
    title?: string
    description?: string
    status?: IrisStepStatus
    disabled?: boolean
    titleSnippet?: import('svelte').Snippet
    descriptionSnippet?: import('svelte').Snippet
    style?: string
    [key: string]: unknown
  } = $props()

  const ctx = getStepperContext('IrisStepperStep')

  // Register synchronously at component instantiation — same as Vue's onBeforeMount.
  // svelte-ignore state_referenced_locally
  const index = ctx.registerStep()

  const status = $derived<IrisStepStatus>(statusProp ?? ctx.computeStatus(index))
  const isLast = $derived(index === ctx.total - 1)
  const isHorizontal = $derived(ctx.orientation === 'horizontal')
  const color = $derived(STATUS_COLOR[status])
  const clickable = $derived(!disabled && (!ctx.linear || index <= ctx.current))

  function onClick(): void {
    if (disabled) return
    ctx.goTo(index)
  }
</script>

<li
  {...rest}
  data-iris-stepper-step
  data-iris-stepper-step-status={status}
  data-iris-stepper-step-disabled={disabled ? 'true' : undefined}
  aria-current={status === 'active' ? 'step' : undefined}
  style="{isHorizontal
    ? `display:flex; align-items:flex-start; flex:${isLast ? '0 0 auto' : '1 1 0'}; gap:8px; min-width:0;`
    : 'display:flex; flex-direction:column; gap:4px;'}{style ? ' ' + style : ''}"
>
  <button
    type="button"
    disabled={!clickable || undefined}
    data-iris-stepper-step-trigger
    onclick={onClick}
    style="display:inline-flex; align-items:{isHorizontal
      ? 'center'
      : 'flex-start'}; gap:8px; background:transparent; border:none; padding:0; cursor:{clickable
      ? 'pointer'
      : 'default'}; color:inherit; font:inherit; text-align:start;"
  >
    <span
      data-iris-stepper-indicator
      data-iris-stepper-status={status}
      aria-hidden="true"
      style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; min-width:28px; border-radius:50%; background:{status ===
      'completed'
        ? color
        : 'var(--iris-background)'}; color:{status === 'completed'
        ? 'var(--iris-primary-foreground,#fff)'
        : color}; border:2px solid {color}; font-size:13px; font-weight:600; line-height:1; transition:background-color 120ms ease,color 120ms ease,border-color 120ms ease;"
    >
      {status === 'completed' ? '✓' : status === 'error' ? '!' : String(index + 1)}
    </span>
    <div>
      {#if title || titleSnippet}
        <div
          data-iris-stepper-title
          style="font-size:13px; font-weight:{status === 'active'
            ? '600'
            : '500'}; color:{status === 'pending'
            ? 'var(--iris-muted)'
            : 'var(--iris-foreground)'};"
        >
          {#if titleSnippet}{@render titleSnippet()}{:else}{title}{/if}
        </div>
      {/if}
      {#if description || descriptionSnippet}
        <div data-iris-stepper-description style="font-size:12px; color:var(--iris-muted);">
          {#if descriptionSnippet}{@render descriptionSnippet()}{:else}{description}{/if}
        </div>
      {/if}
    </div>
  </button>
  {#if !isLast}
    <span
      data-iris-stepper-connector
      aria-hidden="true"
      style={isHorizontal
        ? `flex:1; height:1px; background:${index < ctx.current ? STATUS_COLOR.completed : 'var(--iris-border)'}; margin:0 8px; align-self:center;`
        : `width:1px; min-height:24px; background:${index < ctx.current ? STATUS_COLOR.completed : 'var(--iris-border)'}; margin-inline-start:13px; margin-top:4px; margin-bottom:4px;`}
    ></span>
  {/if}
</li>
