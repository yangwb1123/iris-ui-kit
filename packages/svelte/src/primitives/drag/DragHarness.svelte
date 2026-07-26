<script lang="ts">
  // Test fixture: binds `useDrag` to a handle element and forwards the
  // lifecycle callbacks so the spec can drive pointer events on `.handle`.
  import { useDrag, type DragState } from './useDrag.svelte'

  let {
    onStart,
    onDrag,
    onEnd,
    disabled = false,
  }: {
    onStart?: (s: DragState) => boolean | void
    onDrag?: (s: DragState) => void
    onEnd?: (s: DragState) => void
    disabled?: boolean
  } = $props()

  let handleEl = $state<HTMLElement | undefined>(undefined)

  useDrag({
    handle: () => handleEl,
    disabled: () => disabled,
    onStart,
    onDrag,
    onEnd,
  })

  function setHandle(node: HTMLElement): { destroy: () => void } {
    handleEl = node
    return {
      destroy: () => {
        handleEl = undefined
      },
    }
  }
</script>
<!-- svelte-ignore a11y_role_supports_aria_props_implicit -->

<div class="handle" use:setHandle style="width: 40px; height: 40px"></div>
