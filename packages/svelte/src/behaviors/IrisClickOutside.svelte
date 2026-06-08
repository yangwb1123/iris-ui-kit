<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    disabled?: boolean
    onOutside?: (e: PointerEvent) => void
    children?: Snippet
  }

  let { disabled = false, onOutside, children }: Props = $props()

  let wrapperEl = $state<HTMLElement | undefined>(undefined)

  function onPointerDown(e: PointerEvent) {
    if (disabled || !wrapperEl) return
    const target = e.target as Node | null
    if (target && !wrapperEl.contains(target)) {
      onOutside?.(e)
    }
  }

  $effect(() => {
    if (disabled) return
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  })
</script>

<span
  bind:this={wrapperEl}
  data-iris-click-outside
  style:display="contents"
>
  {@render children?.()}
</span>
