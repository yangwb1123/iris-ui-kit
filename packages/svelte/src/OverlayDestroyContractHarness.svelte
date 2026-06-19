<script lang="ts">
  // Dedicated cross-framework contract harness for the overlay DESTROY/CLEANUP
  // contract (overlayDestroyScenario), mirroring the React reference's
  // OverlayDestroyContractHarness.
  //
  // The overlay PORTALS to document.body (its default — NO portalTarget={false}),
  // so the document-scoped (`global: true`) `[role="dialog"]` count assertions
  // genuinely exercise portal cleanup on unmount. The `use:portal` action's
  // destroy() removes the relocated node, and the `{#if ctx.open}` block unmounts
  // it, so no role-bearing node should leak in document.body after teardown.
  import IrisDialog from './primitives/dialog/IrisDialog.svelte'
  import IrisDialogTrigger from './primitives/dialog/IrisDialogTrigger.svelte'
  import IrisDialogContent from './primitives/dialog/IrisDialogContent.svelte'
</script>

<div>
  <IrisDialog defaultOpen={false} closeOnOutsideClick={false}>
    <IrisDialogTrigger data-iris-dialog-trigger>Open</IrisDialogTrigger>
    <IrisDialogContent>
      <p>Dialog body</p>
    </IrisDialogContent>
  </IrisDialog>
</div>
