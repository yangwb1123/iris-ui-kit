<script lang="ts">
  // Dedicated cross-framework contract harness for IrisDialog.
  //
  // Why a separate harness: the Dialog contract needs closeOnOutsideClick={false}
  // (prevent backdrop-dismiss — the contract exercises Escape only) and
  // portalTarget={false} on the content (inline rendering so the contract
  // driver's queryAll is container-scoped). The shared ContractsHarness uses
  // defaults for all components and doesn't expose fine-grained prop control
  // per contract, so a dedicated harness is the clearest approach — mirroring
  // how Calendar, Tree, DataSource, Table*, RangeSlider, and Rating each use
  // their own harness.
  //
  // IrisDialog is uncontrolled (no `open` prop) so it uses defaultOpen={false}
  // internally. The trigger toggles it open; Escape closes it.
  import IrisDialog from './primitives/dialog/IrisDialog.svelte'
  import IrisDialogTrigger from './primitives/dialog/IrisDialogTrigger.svelte'
  import IrisDialogContent from './primitives/dialog/IrisDialogContent.svelte'
</script>

<IrisDialog closeOnOutsideClick={false}>
  <IrisDialogTrigger data-iris-dialog-trigger>Open</IrisDialogTrigger>
  <IrisDialogContent portalTarget={false}>
    <p>Dialog body</p>
  </IrisDialogContent>
</IrisDialog>
