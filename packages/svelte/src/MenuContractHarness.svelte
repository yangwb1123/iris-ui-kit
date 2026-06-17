<script lang="ts">
  // Dedicated cross-framework contract harness for IrisMenu.
  //
  // Why a separate harness: the Menu contract needs portalTarget={false} on
  // the content (inline rendering so the contract driver's queryAll is
  // container-scoped). The shared ContractsHarness uses defaults for all
  // components and doesn't expose fine-grained prop control per contract, so a
  // dedicated harness is the clearest approach — mirroring how Dropdown,
  // Dialog, Popover, Drawer, Calendar, Tree, DataSource, Table*, RangeSlider,
  // and Rating each use their own harness.
  //
  // IrisMenu is uncontrolled (no `open` prop) so it uses defaultOpen={false}
  // internally. The trigger TOGGLES — clicking it opens AND closes; Escape is
  // the keyboard dismiss mechanism.
  import { IrisMenu, IrisMenuTrigger, IrisMenuContent, IrisMenuItem } from './primitives/menu'
</script>

<IrisMenu>
  <IrisMenuTrigger>Menu</IrisMenuTrigger>
  <IrisMenuContent portalTarget={false}>
    <IrisMenuItem onclick={() => {}}>Item1</IrisMenuItem>
  </IrisMenuContent>
</IrisMenu>
