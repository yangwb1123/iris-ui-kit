<script lang="ts">
  import IrisDrawer from './IrisDrawer.svelte'
  import IrisDrawerContent from './IrisDrawerContent.svelte'
  import type { IrisDrawerSide } from './context'

  interface Props {
    side?: IrisDrawerSide
  }

  let { side = 'bottom' }: Props = $props()
</script>

<IrisDrawer defaultOpen {side}>
  <IrisDrawerContent>
    <p>Drawer body</p>
  </IrisDrawerContent>
</IrisDrawer>
