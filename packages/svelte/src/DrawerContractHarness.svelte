<script lang="ts">
  // Dedicated cross-framework contract harness for IrisDrawer.
  //
  // Why a separate harness: the Drawer contract needs portalTarget={false} on
  // the content (inline rendering so the contract driver's queryAll is
  // container-scoped). The shared ContractsHarness uses defaults for all
  // components and doesn't expose fine-grained prop control per contract, so a
  // dedicated harness is the clearest approach — mirroring how Dialog, Popover,
  // Calendar, Tree, DataSource, Table*, RangeSlider, and Rating each use their
  // own harness.
  //
  // IrisDrawer is uncontrolled (no `open` prop) so it uses defaultOpen={false}
  // internally. The trigger only OPENS (it does not toggle); Escape closes it.
  import IrisDrawer from './primitives/drawer/IrisDrawer.svelte'
  import IrisDrawerTrigger from './primitives/drawer/IrisDrawerTrigger.svelte'
  import IrisDrawerContent from './primitives/drawer/IrisDrawerContent.svelte'
</script>

<div>
  <IrisDrawer defaultOpen={false}>
    <IrisDrawerTrigger data-iris-drawer-trigger>Open</IrisDrawerTrigger>
    <IrisDrawerContent portalTarget={false}>
      <p>Drawer content</p>
    </IrisDrawerContent>
  </IrisDrawer>
</div>
