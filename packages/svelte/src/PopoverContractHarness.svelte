<script lang="ts">
  // Dedicated cross-framework contract harness for IrisPopover.
  //
  // Why a separate harness: the Popover contract needs portalTarget={false} on
  // the content (inline rendering so the contract driver's queryAll is
  // container-scoped). The shared ContractsHarness uses defaults for all
  // components and doesn't expose fine-grained prop control per contract, so a
  // dedicated harness is the clearest approach — mirroring how Dialog, Calendar,
  // Tree, DataSource, Table*, RangeSlider, and Rating each use their own harness.
  //
  // IrisPopover is uncontrolled (no `open` prop) so it uses defaultOpen={false}
  // internally. The trigger toggles it open and closed; Escape closes it.
  import IrisPopover from './primitives/popover/IrisPopover.svelte'
  import IrisPopoverTrigger from './primitives/popover/IrisPopoverTrigger.svelte'
  import IrisPopoverContent from './primitives/popover/IrisPopoverContent.svelte'
</script>

<div>
  <IrisPopover defaultOpen={false}>
    <IrisPopoverTrigger data-iris-popover-trigger>Open</IrisPopoverTrigger>
    <IrisPopoverContent portalTarget={false}>
      <p>Popover content</p>
    </IrisPopoverContent>
  </IrisPopover>
</div>
