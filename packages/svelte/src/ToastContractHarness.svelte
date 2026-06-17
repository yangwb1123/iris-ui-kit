<script lang="ts">
  // Dedicated cross-framework contract harness for Toast notifications.
  //
  // Why a separate harness: the Toast contract needs portalTarget={false} on
  // the viewport (inline rendering so the contract driver's queryAll is
  // container-scoped), plus a button that bridges the programmatic push API
  // into a clickable DOM interaction. The shared ContractsHarness uses defaults
  // for all components and doesn't expose fine-grained prop control per
  // contract, so a dedicated harness is the clearest approach — mirroring how
  // Dialog, Popover, Drawer, Dropdown, Calendar, Tree, DataSource, Table*,
  // RangeSlider, and Rating each use their own harness.
  //
  // The scenario: empty viewport → click push → toast appears → click dismiss
  // → toast gone.
  import IrisToastViewport from './primitives/toast/IrisToastViewport.svelte'
  import { pushToast } from './primitives/toast/toastStore'
</script>

<div>
  <button type="button" data-iris-toast-push onclick={() => pushToast({ title: 'Hello Toast' })}>
    Push Toast
  </button>
  <IrisToastViewport portalTarget={false} />
</div>
