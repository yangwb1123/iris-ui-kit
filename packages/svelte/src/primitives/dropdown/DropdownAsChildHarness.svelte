<script lang="ts">
  import IrisDropdown from './Dropdown.svelte'
  import IrisDropdownTrigger from './DropdownTrigger.svelte'
  import IrisDropdownMenu from './DropdownMenu.svelte'
  import IrisDropdownItem from './DropdownItem.svelte'

  let { childClick }: { childClick?: () => void } = $props()

  function handleChildClick(event: MouseEvent): void {
    event.preventDefault()
    childClick?.()
  }
</script>

<IrisDropdown>
  <IrisDropdownTrigger asChild id="custom-trigger" class="parent">
    {#snippet children(slotProps)}
      <a {...slotProps} href="/actions" class="child" onclick={handleChildClick}>
        Custom actions
      </a>
    {/snippet}
  </IrisDropdownTrigger>
  <IrisDropdownMenu portalTarget={false}>
    <IrisDropdownItem>Copy</IrisDropdownItem>
  </IrisDropdownMenu>
</IrisDropdown>
