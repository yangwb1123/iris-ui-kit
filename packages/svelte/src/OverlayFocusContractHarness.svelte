<script lang="ts">
  // Dedicated cross-framework contract harness for the overlay FOCUS-LIFECYCLE
  // contract (overlayFocusScenario), mirroring the React reference's
  // OverlayFocusContractHarness.
  //
  // Renders an INLINE dialog (portalTarget={false}) so the container-scoped
  // `[role="dialog"]` count assertions work; the focus assertions read the
  // in-container trigger via the global document.activeElement, so inline vs.
  // portaled is irrelevant to them.
  //
  // IrisDialog is uncontrolled (defaultOpen defaults to false). The trigger
  // opens it and moves focus into the overlay; Escape closes it and restores
  // focus to the trigger (useFocusTrap's returnFocusTo).
  import IrisDialog from './primitives/dialog/IrisDialog.svelte'
  import IrisDialogTrigger from './primitives/dialog/IrisDialogTrigger.svelte'
  import IrisDialogContent from './primitives/dialog/IrisDialogContent.svelte'
</script>

<div>
  <IrisDialog defaultOpen={false} closeOnOutsideClick={false}>
    <IrisDialogTrigger data-iris-dialog-trigger>Open</IrisDialogTrigger>
    <IrisDialogContent portalTarget={false}>
      <p>Dialog body</p>
    </IrisDialogContent>
  </IrisDialog>
</div>
