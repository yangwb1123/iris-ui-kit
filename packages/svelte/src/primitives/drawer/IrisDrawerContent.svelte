<script lang="ts">
  import { getDrawerContext } from './context'
  import { useBodyScrollLock } from '../modal-utils/useBodyScrollLock.svelte'
  import { useFocusTrap } from '../modal-utils/useFocusTrap.svelte'
  import { portal } from '../../internal/portal'

  interface Props {
    style?: string
    /** Portal target — pass `false` to render in place. */
    portalTarget?: HTMLElement | false
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { style, portalTarget, children, ...rest }: Props = $props()
  const ctx = getDrawerContext('IrisDrawerContent')

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
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
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

  // Safe-area padding for the screen edges the panel actually touches, so its
  // content clears the notch / home indicator on mobile webviews (Cordova). The
  // insets resolve to 0 on devices/orientations without a cutout, and the whole
  // declaration is simply ignored on engines without env() support.
  // (Host must set <meta name="viewport" content="...,viewport-fit=cover">.)
  function safeAreaPadding(side: import('./context').IrisDrawerSide): string {
    const top = 'padding-top: max(0px, env(safe-area-inset-top)); '
    const right = 'padding-right: max(0px, env(safe-area-inset-right)); '
    const bottom = 'padding-bottom: max(0px, env(safe-area-inset-bottom)); '
    const left = 'padding-left: max(0px, env(safe-area-inset-left)); '
    if (side === 'left') return top + bottom + left
    if (side === 'right') return top + bottom + right
    if (side === 'top') return top + left + right
    return bottom + left + right
  }

  // Compute drawer panel position based on side
  const panelStyle = $derived(() => {
    const s = ctx.side
    const sz = ctx.size
    const base = `position: fixed; z-index: 1200; background: var(--iris-background); color: var(--iris-foreground); border: 1px solid var(--iris-border); box-shadow: var(--iris-shadow-md, 0 24px 48px -16px rgba(0,0,0,0.32)); overflow: auto; outline: none; ${safeAreaPadding(s)}`
    // `100vh` is the fallback; `max-height: 100dvh` clamps the full-height side
    // panels to the DYNAMIC viewport (dvh <= vh) so they don't overflow under
    // mobile browser chrome. Separate property, so it's simply ignored where dvh
    // is unsupported, leaving the 100vh fallback.
    if (s === 'left')
      return `${base}top: 0; left: 0; bottom: 0; width: ${sz}; height: 100vh; max-height: 100dvh; border-left: none;`
    if (s === 'right')
      return `${base}top: 0; right: 0; bottom: 0; width: ${sz}; height: 100vh; max-height: 100dvh; border-right: none;`
    if (s === 'top') return `${base}top: 0; left: 0; right: 0; height: ${sz}; border-top: none;`
    return `${base}bottom: 0; left: 0; right: 0; height: ${sz}; border-bottom: none;`
  })
</script>

{#if ctx.open}
  <!-- backdrop -->
  <div
    use:portal={portalTarget}
    role="presentation"
    data-iris-drawer-backdrop
    onpointerdown={handleBackdropPointerDown}
    style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1199"
  ></div>
  <!-- panel -->
  <div
    {...rest}
    use:setContentRef
    use:portal={portalTarget}
    id={ctx.contentId}
    role="dialog"
    aria-modal="true"
    aria-labelledby={ctx.hasTitle ? ctx.titleId : undefined}
    tabindex={-1}
    data-iris-drawer-content
    data-iris-drawer-side={ctx.side}
    data-state="open"
    onpointerdown={stopPropagation}
    style="{panelStyle()}{style ? ' ' + style : ''}"
  >
    {@render children?.()}
  </div>
{/if}
