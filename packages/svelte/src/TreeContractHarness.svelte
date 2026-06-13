<script lang="ts">
  // Dedicated cross-framework contract harness for IrisTree's keyboard pattern.
  //
  // Why a separate harness (and not the shared ContractsHarness.svelte): the
  // Tree renders many `role="treeitem"` elements, each carrying a roving
  // `tabindex`. Co-locating it in the shared harness would put those elements in
  // the same container as the other contracts, risking selector-count
  // interactions (other scenarios that count role-based elements). Keeping the
  // tree in its own container — exactly like TableSortContractHarness /
  // RatingContractHarness — mirrors how the React harness renders each contract
  // in isolation.
  //
  // Expansion is UNCONTROLLED here (no `expanded`/`defaultExpanded` prop): the
  // tree seeds `internalExpanded` empty so both roots start COLLAPSED, and
  // ArrowRight on the active node toggles its expansion internally. activeId
  // starts null, so the first item is roving-active via the
  // `idx === 0 && !activeId` tabindex fallback — exactly what the shared
  // treeScenario asserts. Same `{ id, label, children }` node shape as the
  // React reference harness.
  import IrisTree from './primitives/tree/IrisTree.svelte'
</script>

<IrisTree
  nodes={[
    {
      id: 'a',
      label: 'A',
      children: [
        { id: 'a1', label: 'A1' },
        { id: 'a2', label: 'A2' },
      ],
    },
    { id: 'b', label: 'B' },
  ]}
/>
