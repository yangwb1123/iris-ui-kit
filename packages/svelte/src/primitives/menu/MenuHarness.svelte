<script lang="ts">
  import IrisMenu from './IrisMenu.svelte'
  import IrisMenuTrigger from './IrisMenuTrigger.svelte'
  import IrisMenuContent from './IrisMenuContent.svelte'
  import IrisMenuItem from './IrisMenuItem.svelte'
  import IrisMenuSeparator from './IrisMenuSeparator.svelte'

  interface Props {
    onSelect?: () => void
  }

  let { onSelect }: Props = $props()
</script>

<IrisMenu>
  <IrisMenuTrigger>Menu</IrisMenuTrigger>
  <IrisMenuContent>
    <IrisMenuItem onclick={onSelect}>Item 1</IrisMenuItem>
    <IrisMenuSeparator />
    <IrisMenuItem>Item 2</IrisMenuItem>
  </IrisMenuContent>
</IrisMenu>
