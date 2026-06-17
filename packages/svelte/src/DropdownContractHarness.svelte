<script lang="ts">
  // Dedicated cross-framework contract harness for IrisDropdown.
  //
  // Why a separate harness: the Dropdown contract needs portalTarget={false} on
  // the menu (inline rendering so the contract driver's queryAll is
  // container-scoped). The shared ContractsHarness uses defaults for all
  // components and doesn't expose fine-grained prop control per contract, so a
  // dedicated harness is the clearest approach — mirroring how Dialog, Popover,
  // Drawer, Calendar, Tree, DataSource, Table*, RangeSlider, and Rating each
  // use their own harness.
  //
  // IrisDropdown is uncontrolled (no `open` prop) so it uses defaultOpen={false}
  // internally. The trigger TOGGLES — clicking it opens AND closes; Escape is
  // the keyboard dismiss mechanism.
  import { IrisDropdown, IrisDropdownTrigger, IrisDropdownMenu } from './index.js'
</script>

<div>
  <IrisDropdown defaultOpen={false}>
    <IrisDropdownTrigger data-iris-dropdown-trigger>Open</IrisDropdownTrigger>
    <IrisDropdownMenu portalTarget={false}>
      <p>Dropdown content</p>
    </IrisDropdownMenu>
  </IrisDropdown>
</div>
