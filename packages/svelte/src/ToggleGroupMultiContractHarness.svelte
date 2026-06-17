<script lang="ts">
  // Dedicated cross-framework contract harness for the MULTIPLE-mode ToggleGroup.
  //
  // Why a separate harness (and not the shared ContractsHarness.svelte): the
  // shared harness already mounts a single-mode IrisToggleGroup with its own three
  // `[data-iris-toggle-group-item]` buttons. Adding a second (multiple-mode) group
  // there would make that selector match 6 elements, breaking BOTH the existing
  // single-mode ToggleGroup scenario's `count === 3` assertion AND this new
  // multiple-mode scenario's `count === 3`. So we isolate it here — exactly the
  // dedicated-harness pattern used by RatingContractHarness.svelte for its own
  // selector collision.
  //
  // IrisToggleGroup is value-prop-driven (true controlled): a press emits
  // `onchange` with the next value but the items' `aria-pressed` only flips when
  // the parent writes `value` back. In multiple mode the value shape is a
  // `string[]`. Seed to `[]` (NONE pressed — the initial the shared multiple-mode
  // contract expects) and write back from `onchange`, same controlled-`$state`
  // pattern as the other harness controls.
  import IrisToggleGroup from './primitives/toggle-group/IrisToggleGroup.svelte'
  import IrisToggleGroupItem from './primitives/toggle-group/IrisToggleGroupItem.svelte'

  let value = $state<string[]>([])
</script>

<IrisToggleGroup type="multiple" {value} onchange={(next) => (value = (next ?? []) as string[])}>
  <IrisToggleGroupItem value="a">A</IrisToggleGroupItem>
  <IrisToggleGroupItem value="b">B</IrisToggleGroupItem>
  <IrisToggleGroupItem value="c">C</IrisToggleGroupItem>
</IrisToggleGroup>
