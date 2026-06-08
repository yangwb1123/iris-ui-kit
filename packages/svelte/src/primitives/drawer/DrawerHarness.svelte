<script lang="ts">
  import IrisDrawer from './IrisDrawer.svelte'
  import IrisDrawerTrigger from './IrisDrawerTrigger.svelte'
  import IrisDrawerContent from './IrisDrawerContent.svelte'
  import IrisDrawerTitle from './IrisDrawerTitle.svelte'
  import IrisDrawerClose from './IrisDrawerClose.svelte'
</script>

<IrisDrawer>
  <IrisDrawerTrigger>Open Drawer</IrisDrawerTrigger>
  <IrisDrawerContent>
    <IrisDrawerTitle>Drawer Title</IrisDrawerTitle>
    <p>Drawer body</p>
    <IrisDrawerClose>Close</IrisDrawerClose>
  </IrisDrawerContent>
</IrisDrawer>
