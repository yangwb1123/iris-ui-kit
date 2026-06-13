<script lang="ts">
  // Dedicated cross-framework contract harness for IrisTable's MULTI row
  // selection a11y (aria-selected on selectable body rows).
  //
  // Why a separate harness (and not the shared ContractsHarness.svelte): the
  // Table is a complex, data-heavy component — it renders many header/row/cell
  // DOM elements. Co-locating it in the shared harness would put those elements
  // in the same container as the other contracts, risking selector-count
  // interactions. Keeping the table in its own container — exactly like
  // TableSortContractHarness / RatingContractHarness — mirrors how the React
  // harness renders each contract in isolation.
  //
  // Selection is UNCONTROLLED here (no `selection` prop): IrisTable seeds an
  // internal selection model and `toggleRow`/`toggleAll` flip it internally, so
  // the harness needs no local `$state`. With `selectable="multi"`, each body
  // row exposes `aria-selected` "false"/"true" and the selection checkboxes are
  // native `input[type="checkbox"]` (index 0 = master "select all", rows at
  // 1/2/3) — exactly what the shared tableSelectScenario asserts. Same
  // columns/data shape as the React reference harness.
  import IrisTable from './primitives/table/IrisTable.svelte'
</script>

<IrisTable
  selectable="multi"
  columns={[{ key: 'name', title: 'Name' }]}
  data={[
    { id: '1', name: 'Bravo' },
    { id: '2', name: 'Alpha' },
    { id: '3', name: 'Charlie' },
  ]}
/>
