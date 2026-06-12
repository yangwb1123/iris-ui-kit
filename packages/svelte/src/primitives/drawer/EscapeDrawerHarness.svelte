<script lang="ts">
  import IrisDrawer from './IrisDrawer.svelte'
  import IrisDrawerContent from './IrisDrawerContent.svelte'

  interface Props {
    closeOnEscape?: boolean
  }

  let { closeOnEscape = true }: Props = $props()
</script>

<IrisDrawer defaultOpen {closeOnEscape}>
  <IrisDrawerContent>
    <p>Drawer body</p>
  </IrisDrawerContent>
</IrisDrawer>
