<script lang="ts">
  import IrisMenu from './IrisMenu.svelte'
  import IrisMenuTrigger from './IrisMenuTrigger.svelte'
  import IrisMenuContent from './IrisMenuContent.svelte'
  import IrisMenuItem from './IrisMenuItem.svelte'
  import IrisMenuSeparator from './IrisMenuSeparator.svelte'
  import IrisMenuSub from './IrisMenuSub.svelte'

  interface Props {
    onSelect?: () => void
    withSub?: boolean
  }

  let { onSelect, withSub = false }: Props = $props()
</script>

<IrisMenu>
  <IrisMenuTrigger>Menu</IrisMenuTrigger>
  <IrisMenuContent>
    <IrisMenuItem onclick={onSelect}>Item 1</IrisMenuItem>
    <IrisMenuSeparator />
    <IrisMenuItem>Item 2</IrisMenuItem>
    {#if withSub}
      <IrisMenuSub label="More">
        <IrisMenuItem>Sub 1</IrisMenuItem>
        <IrisMenuItem>Sub 2</IrisMenuItem>
      </IrisMenuSub>
    {/if}
  </IrisMenuContent>
</IrisMenu>
