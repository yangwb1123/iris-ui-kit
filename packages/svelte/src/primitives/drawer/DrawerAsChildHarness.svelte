<script lang="ts">
  import IrisDrawer from './IrisDrawer.svelte'
  import IrisDrawerTrigger from './IrisDrawerTrigger.svelte'
  import IrisDrawerContent from './IrisDrawerContent.svelte'
  import IrisDrawerTitle from './IrisDrawerTitle.svelte'
  import IrisDrawerClose from './IrisDrawerClose.svelte'
  import IrisButton from '../button/IrisButton.svelte'
</script>

<IrisDrawer>
  <IrisDrawerTrigger asChild id="drawer-trigger" data-trigger-rest="kept">
    {#snippet children(props)}
      <IrisButton variant="outline" {...props.attrs}>Open custom drawer</IrisButton>
    {/snippet}
  </IrisDrawerTrigger>
  <IrisDrawerContent>
    <IrisDrawerTitle>Custom Drawer</IrisDrawerTitle>
    <IrisDrawerClose asChild id="drawer-close" data-close-rest="kept">
      {#snippet children(props)}
        <IrisButton variant="solid" {...props}>Close custom drawer</IrisButton>
      {/snippet}
    </IrisDrawerClose>
  </IrisDrawerContent>
</IrisDrawer>
