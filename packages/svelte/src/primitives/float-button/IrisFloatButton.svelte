<script lang="ts">
  import { mergeStyle } from '../../internal/style'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  export type IrisFloatButtonShape = 'circle' | 'square'

  export interface IrisFloatButtonAction {
    key: string
    icon?: string
    label?: string
    ariaLabel?: string
    onclick?: () => void
  }

  interface Props {
    icon?: string
    ariaLabel?: string
    shape?: IrisFloatButtonShape
    actions?: IrisFloatButtonAction[]
    offset?: { bottom?: number; right?: number }
    style?: string
    children?: import('svelte').Snippet
    onclick?: () => void
    [key: string]: unknown
  }

  let {
    icon = '+',
    ariaLabel,
    shape = 'circle',
    actions,
    offset,
    style,
    children,
    onclick,
    ...rest
  }: Props = $props()

  let open = $state(false)
  let rootEl = $state<HTMLElement | undefined>(undefined)

  const hasActions = $derived(!!actions && actions.length > 0)
  const radius = $derived(shape === 'circle' ? '50%' : 'var(--iris-radius-md, 6px)')

  function fabStyle(size: number, primary: boolean): string {
    return `width: ${size}px; height: ${size}px; display: inline-flex; align-items: center; justify-content: center; border: ${primary ? 'none' : '1px solid var(--iris-border)'}; background: ${primary ? 'var(--iris-primary)' : 'var(--iris-background)'}; color: ${primary ? '#fff' : 'var(--iris-foreground)'}; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.18); font-size: ${size > 44 ? '22px' : '16px'}; line-height: 1; border-radius: ${radius};`
  }

  $effect(() => {
    function onDown(e: MouseEvent) {
      if (open && rootEl && !rootEl.contains(e.target as Node)) open = false
    }
    function onKey(e: KeyboardEvent) {
      if (open && e.key === 'Escape') open = false
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  })
</script>

<div
  bind:this={rootEl}
  {...rest}
  data-iris-float-button-root
  style={mergeStyle(
    `position: fixed; inset-block-end: ${offset?.bottom ?? 24}px; inset-inline-end: ${offset?.right ?? 24}px; z-index: 1000; display: flex; flex-direction: column; align-items: center; gap: 12px;`,
    style,
  )}
>
  {#if hasActions && open}
    <div
      data-iris-float-button-actions
      role="menu"
      style="display: flex; flex-direction: column-reverse; gap: 12px; align-items: center;"
    >
      {#each actions! as action (action.key)}
        <button
          type="button"
          role="menuitem"
          data-iris-float-button-action
          data-key={action.key}
          aria-label={action.ariaLabel ?? action.label}
          onclick={() => {
            action.onclick?.()
            open = false
          }}
          style={fabStyle(40, false)}>{action.icon ?? action.label}</button
        >
      {/each}
    </div>
  {/if}
  <button
    type="button"
    data-iris-float-button
    aria-label={ariaLabel ?? (hasActions ? t('floatButton.actions') : undefined)}
    aria-haspopup={hasActions ? 'menu' : undefined}
    aria-expanded={hasActions ? (open ? 'true' : 'false') : undefined}
    onclick={() => {
      if (hasActions) open = !open
      else onclick?.()
    }}
    style={fabStyle(48, true)}
  >
    {#if children}
      {@render children()}
    {:else}
      {icon}
    {/if}
  </button>
</div>
