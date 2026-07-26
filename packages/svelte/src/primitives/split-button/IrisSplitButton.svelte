<script lang="ts">
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  export type IrisSplitButtonVariant = 'primary' | 'default'
  export type IrisSplitButtonSize = 'sm' | 'md' | 'lg'

  export interface IrisSplitButtonAction {
    key: string
    label: string
    disabled?: boolean
    onclick?: () => void
  }

  interface Props {
    actions?: IrisSplitButtonAction[]
    variant?: IrisSplitButtonVariant
    size?: IrisSplitButtonSize
    disabled?: boolean
    menuAriaLabel?: string
    onclick?: () => void
    children?: import('svelte').Snippet
    style?: string
    [key: string]: unknown
  }

  let {
    actions,
    variant = 'primary',
    size = 'md',
    disabled = false,
    menuAriaLabel = undefined,
    onclick,
    children,
    style,
    ...rest
  }: Props = $props()

  let open = $state(false)
  let rootEl = $state<HTMLElement | undefined>(undefined)

  const SIZE_MAP: Record<
    IrisSplitButtonSize,
    { padding: string; fontSize: string; height: string }
  > = {
    sm: { padding: '4px 10px', fontSize: '12px', height: '28px' },
    md: { padding: '6px 14px', fontSize: '14px', height: '34px' },
    lg: { padding: '8px 18px', fontSize: '16px', height: '40px' },
  }

  const sz = $derived(SIZE_MAP[size])
  const isPrimary = $derived(variant === 'primary')
  const colors = $derived(
    isPrimary
      ? {
          background: 'var(--iris-primary)',
          color: '#fff',
          border: '1px solid var(--iris-primary)',
        }
      : {
          background: 'var(--iris-surface)',
          color: 'var(--iris-foreground)',
          border: '1px solid var(--iris-border)',
        },
  )

  const hasActions = $derived(!!actions && actions.length > 0)

  function setRootRef(node: HTMLElement): { destroy: () => void } {
    rootEl = node
    return {
      destroy: () => {
        rootEl = undefined
      },
    }
  }

  function handleMainClick(): void {
    if (!disabled) onclick?.()
  }

  function handleChevronClick(): void {
    if (!disabled) open = !open
  }

  function selectAction(action: IrisSplitButtonAction): void {
    if (action.disabled) return
    action.onclick?.()
    open = false
  }

  $effect(() => {
    if (!open || typeof document === 'undefined') return
    const onDown = (e: MouseEvent): void => {
      if (rootEl && !rootEl.contains(e.target as Node)) open = false
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') open = false
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  })
</script>
<!-- svelte-ignore a11y_role_supports_aria_props_implicit -->

<div
  {...rest}
  use:setRootRef
  data-iris-split-button
  data-state={open ? 'open' : 'closed'}
  style="position: relative; display: inline-flex;{style ? ' ' + style : ''}"
>
  <button
    type="button"
    data-iris-split-button-main
    disabled={disabled || undefined}
    onclick={handleMainClick}
    style="background: {colors.background}; color: {colors.color}; border: {colors.border}; padding: {sz.padding}; min-height: {sz.height}; font-size: {sz.fontSize}; font-family: inherit; border-start-start-radius: var(--iris-radius-md, 6px); border-end-start-radius: var(--iris-radius-md, 6px); cursor: {disabled
      ? 'not-allowed'
      : 'pointer'}; opacity: {disabled ? '0.6' : '1'}"
  >
    {@render children?.()}
  </button>

  {#if hasActions}
    <button
      type="button"
      data-iris-split-button-trigger
      aria-haspopup="menu"
      aria-expanded={open ? 'true' : 'false'}
      aria-label={menuAriaLabel ?? t('splitButton.more')}
      disabled={disabled || undefined}
      onclick={handleChevronClick}
      style="background: {colors.background}; color: {colors.color}; border-inline-start: {isPrimary
        ? '1px solid rgba(255,255,255,0.3)'
        : '1px solid var(--iris-border)'}; border-top: {colors.border}; border-right: {colors.border}; border-bottom: {colors.border}; padding: 0 8px; min-height: {sz.height}; font-size: 10px; border-start-end-radius: var(--iris-radius-md, 6px); border-end-end-radius: var(--iris-radius-md, 6px); cursor: {disabled
        ? 'not-allowed'
        : 'pointer'}; opacity: {disabled ? '0.6' : '1'}; display: inline-flex; align-items: center"
    >
      ▾
    </button>
  {/if}

  {#if open && hasActions}
    <ul
      role="menu"
      aria-label={menuAriaLabel ?? t('splitButton.more')}
      data-iris-split-button-menu
      style="position: absolute; inset-inline-end: 0; top: 100%; margin-block-start: 4px; min-width: 140px; list-style: none; margin-top: 4px; padding: 4px; z-index: 50; background: var(--iris-background); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); box-shadow: 0 8px 24px rgba(0,0,0,0.12)"
    >
      {#each actions! as action}
        <li
          role="menuitem"
          aria-disabled={action.disabled ? 'true' : undefined}
          data-iris-split-button-item
          data-key={action.key}
          onclick={() => selectAction(action)}
          style="padding: 6px 10px; font-size: 14px; border-radius: var(--iris-radius-sm, 4px); cursor: {action.disabled
            ? 'not-allowed'
            : 'pointer'}; color: {action.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)'}"
        >
          {action.label}
        </li>
      {/each}
    </ul>
  {/if}
</div>
