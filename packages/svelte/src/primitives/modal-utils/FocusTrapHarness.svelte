<script lang="ts">
  import { useFocusTrap } from './useFocusTrap.svelte'

  interface Props {
    active?: boolean
    returnFocusTo?: HTMLElement | null
  }

  let { active = true, returnFocusTo = null }: Props = $props()

  let containerEl = $state<HTMLElement | undefined>(undefined)

  useFocusTrap({
    container: () => containerEl,
    active: () => active,
    returnFocusTo: () => returnFocusTo,
    // Avoid stealing focus on activation so the test controls the focused node.
    initialFocus: false,
  })
</script>

<div bind:this={containerEl}>
  <button type="button">inside</button>
</div>
