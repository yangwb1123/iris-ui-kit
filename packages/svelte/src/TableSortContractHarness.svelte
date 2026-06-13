<script lang="ts">
  // Dedicated cross-framework contract harness for IrisTable's column sort.
  //
  // Why a separate harness (and not the shared ContractsHarness.svelte): the
  // Table is a complex, data-heavy component — it renders many header/row/cell
  // DOM elements (each header carries role="columnheader"). Co-locating it in
  // the shared harness would put those elements in the same container as the
  // other contracts, risking selector-count interactions (other scenarios that
  // count role-based elements). Keeping the table in its own container — exactly
  // like RatingContractHarness / ToggleGroupMultiContractHarness — mirrors how
  // the React harness renders each contract in isolation.
  //
  // Sort is UNCONTROLLED here (no `sort` prop): IrisTable seeds `internalSort` to
  // null and `handleHeaderClick` cycles it null → asc → desc → null internally,
  // so the harness needs no local state. The sortable `name` header exposes
  // `aria-sort` "none" when sortable-but-inactive and "ascending"/"descending"
  // when active — exactly what the shared tableSortScenario asserts. Same
  // columns/data shape as the React reference harness.
  import IrisTable from './primitives/table/IrisTable.svelte'
</script>

<IrisTable
  columns={[
    { key: 'name', title: 'Name', sortable: true },
    { key: 'age', title: 'Age', sortable: true },
  ]}
  data={[
    { id: '1', name: 'Bravo', age: 30 },
    { id: '2', name: 'Alpha', age: 25 },
    { id: '3', name: 'Charlie', age: 35 },
  ]}
/>
