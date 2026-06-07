<script lang="ts">
  // Test fixture: composes the dropdown parts, rendered in place (portalTarget=false)
  // so container.querySelector can find the menu surface.
  import IrisDropdown from './Dropdown.svelte'
  import IrisDropdownTrigger from './DropdownTrigger.svelte'
  import IrisDropdownMenu from './DropdownMenu.svelte'
  import IrisDropdownItem from './DropdownItem.svelte'

  let { onSelect }: { onSelect?: () => void } = $props()
</script>

<IrisDropdown>
  <IrisDropdownTrigger>Actions</IrisDropdownTrigger>
  <IrisDropdownMenu portalTarget={false}>
    <IrisDropdownItem {onSelect}>Copy</IrisDropdownItem>
    <IrisDropdownItem>Delete</IrisDropdownItem>
  </IrisDropdownMenu>
</IrisDropdown>
