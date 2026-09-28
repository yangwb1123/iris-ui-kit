<script lang="ts">
  import IrisMenu from './IrisMenu.svelte'
  import IrisMenuTrigger from './IrisMenuTrigger.svelte'
  import IrisMenuContent from './IrisMenuContent.svelte'
  import IrisMenuItem from './IrisMenuItem.svelte'
  import IrisButton from '../button/IrisButton.svelte'
</script>

<IrisMenu>
  <IrisMenuTrigger asChild id="menu-trigger" class="trigger-rest" data-trigger-rest="kept">
    {#snippet children(props)}
      <IrisButton variant="outline" {...props.attrs.merge({})}>Open Menu</IrisButton>
    {/snippet}
  </IrisMenuTrigger>
  <IrisMenuContent>
    <IrisMenuItem>Copy</IrisMenuItem>
  </IrisMenuContent>
</IrisMenu>
