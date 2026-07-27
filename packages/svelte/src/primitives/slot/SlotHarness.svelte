<script lang="ts">
  import IrisSlot from './IrisSlot.svelte'

  let {
    parentClick,
    childClick,
    parentRef,
    childRef,
    prevent = false,
  }: {
    parentClick?: () => void
    childClick?: () => void
    parentRef?: (element: HTMLElement) => void
    childRef?: (element: HTMLElement) => void
    prevent?: boolean
  } = $props()

  function handleParentClick(event: MouseEvent): void {
    parentClick?.()
    if (prevent) event.preventDefault()
  }

  function setChildRef(element: HTMLElement): void {
    childRef?.(element)
  }

  function handleChildClick(event: MouseEvent): void {
    event.preventDefault()
    childClick?.()
  }
</script>

<IrisSlot
  id="slot-id"
  class="slot-class"
  style="color: red; background: black"
  data-slot="yes"
  onclick={handleParentClick}
  ref={parentRef}
>
  {#snippet children(slotProps)}
    <a
      {...slotProps}
      href="/child"
      class="child-class"
      style="color: blue"
      data-child="yes"
      onclick={handleChildClick}
      use:setChildRef
    >
      slot child
    </a>
  {/snippet}
</IrisSlot>
