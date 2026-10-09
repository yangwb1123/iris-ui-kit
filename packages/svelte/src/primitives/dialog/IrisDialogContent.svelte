<script lang="ts">
  import { resolveDialogLayout, type DialogSize, type LayoutLength } from '@iris-ui-kit/core'
  import { getDialogContext } from './context'
  import { useBodyScrollLock } from '../modal-utils/useBodyScrollLock.svelte'
  import { useFocusTrap } from '../modal-utils/useFocusTrap.svelte'
  import { portal } from '../../internal/portal'

  interface Props {
    style?: string
    /** Portal target — pass `false` to render in place. */
    portalTarget?: HTMLElement | false
    /** Surface preset — `sm` 32rem · `md` 40rem · `lg` 50rem · `xl` 60rem. */
    size?: DialogSize
    /** Explicit surface width (a number is read as px); wins over `size`. */
    width?: LayoutLength
    /** Surface height cap; defaults to `85vh`. */
    maxHeight?: LayoutLength
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { style, portalTarget, size, width, maxHeight, children, ...rest }: Props = $props()
  const ctx = getDialogContext('IrisDialogContent')

  // Sizing is decided in core so every adapter clamps to the viewport the same
  // way; without these props the surface renders exactly as before.
  const layout = $derived(resolveDialogLayout({ size, width, maxHeight }))
  const surfaceStyle = $derived(
    [
      'background: var(--iris-surface-floating)',
      'animation: var(--iris-anim-dialog)',
      'color: var(--iris-foreground)',
      'border: 1px solid var(--iris-border)',
      'border-radius: var(--iris-radius-lg, 8px)',
      'padding: var(--iris-padding-lg, 24px)',
      'box-shadow: var(--iris-shadow-xl)',
      layout.width === undefined ? '' : `box-sizing: border-box; width: ${layout.width}`,
      `max-width: ${layout.maxWidth}`,
      `max-height: ${layout.maxHeight}`,
      'overflow: auto',
      'outline: none',
    ].join('; ') + (style ? `; ${style}` : ''),
  )

  let contentEl = $state<HTMLElement | undefined>(undefined)

  function setContentRef(node: HTMLElement): { destroy: () => void } {
    contentEl = node
    ctx.setContent(node)
    return {
      destroy: () => {
        contentEl = undefined
        ctx.setContent(undefined)
      },
    }
  }

  const { lockScroll, unlockScroll } = useBodyScrollLock()

  $effect(() => {
    if (ctx.open) lockScroll()
    else unlockScroll()
    return () => unlockScroll()
  })

  useFocusTrap({
    container: () => contentEl,
    active: () => ctx.open,
    returnFocusTo: () => ctx.trigger,
  })

  $effect(() => {
    if (!ctx.open || !ctx.closeOnEscape) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        ctx.setOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  function handleBackdropPointerDown(e: PointerEvent): void {
    if (!ctx.closeOnOutsideClick) return
    if (e.target === e.currentTarget) ctx.setOpen(false)
  }

  function stopPropagation(e: Event): void {
    e.stopPropagation()
  }
</script>

{#if ctx.open}
  <!-- backdrop -->
  <div
    role="presentation"
    use:portal={portalTarget}
    data-iris-dialog-backdrop
    onpointerdown={handleBackdropPointerDown}
    style="position: fixed; inset: 0; background: var(--iris-backdrop, rgba(0, 0, 0, 0.5)); z-index: var(--iris-z-modal, 1200); display: flex; align-items: center; justify-content: center; padding: 24px"
  >
    <!-- content -->
    <div
      {...rest}
      use:setContentRef
      id={ctx.contentId}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ctx.hasTitle ? ctx.titleId : undefined}
      aria-describedby={ctx.hasDescription ? ctx.descriptionId : undefined}
      tabindex={-1}
      data-iris-dialog-content
      data-state="open"
      data-iris-dialog-size={layout.size}
      onpointerdown={stopPropagation}
      style={surfaceStyle}
    >
      {@render children?.()}
    </div>
  </div>
{/if}
