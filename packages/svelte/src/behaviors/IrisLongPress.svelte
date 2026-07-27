<script lang="ts">
  import { createLongPress } from '@iris-ui-kit/core'
  import type { Snippet } from 'svelte'

  interface Props {
    holdDelay?: number
    onLongPress: () => void
    disabled?: boolean
    children?: Snippet
  }

  let { holdDelay = 500, onLongPress, disabled = false, children }: Props = $props()

  // Recreated only when `holdDelay` changes (mirrors the React reference's
  // `useMemo(..., [holdDelay])`); `onLongPress` is read lazily inside the
  // closure so a changed callback identity never resets an in-flight press.
  let ctrl = $derived(createLongPress({ holdDelay, onLongPress: () => onLongPress() }))

  function handlePointerDown(_e: PointerEvent) {
    if (disabled) return
    ctrl.press()
  }

  function handlePointerUp() {
    ctrl.release()
  }

  function handlePointerLeave() {
    ctrl.cancel()
  }
</script>

<span
  role="presentation"
  data-iris-long-press
  style:display="contents"
  onpointerdown={handlePointerDown}
  onpointerup={handlePointerUp}
  onpointerleave={handlePointerLeave}
>
  {@render children?.()}
</span>
