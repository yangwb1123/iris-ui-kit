<script lang="ts">
  import { getDialogContext } from './context'
  import { useBodyScrollLock } from '../modal-utils/useBodyScrollLock.svelte'
  import { useFocusTrap } from '../modal-utils/useFocusTrap.svelte'
  import { portal } from '../../internal/portal'

  interface Props {
    style?: string
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { style, children, ...rest }: Props = $props()
  const ctx = getDialogContext('IrisDialogContent')

  let contentEl = $state<HTMLElement | undefined>(undefined)

  function setContentRef(node: HTMLElement): { destroy: () => void } {
    contentEl = node
    ctx.setContent(node)
    return { destroy: () => { contentEl = undefined; ctx.setContent(undefined) } }
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
    use:portal
    data-iris-dialog-backdrop
    onpointerdown={handleBackdropPointerDown}
    style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1200; display: flex; align-items: center; justify-content: center; padding: 24px"
  >
    <!-- content -->
    <div
      {...rest}
      use:setContentRef
      id={ctx.contentId}
      role="dialog"
      aria-modal="true"
      tabindex={-1}
      data-iris-dialog-content
      data-state="open"
      onpointerdown={stopPropagation}
      style="background: var(--iris-surface); color: var(--iris-foreground); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-lg, 8px); padding: var(--iris-padding-lg, 24px); box-shadow: 0 24px 48px -16px rgba(0,0,0,0.32), 0 8px 16px -4px rgba(0,0,0,0.16); max-width: 90vw; max-height: 85vh; overflow: auto; outline: none;{style ? ' ' + style : ''}"
    >
      {@render children?.()}
    </div>
  </div>
{/if}
