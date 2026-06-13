<script lang="ts">
  // Dedicated cross-framework contract harness for IrisTable's row EXPANSION
  // (expandable detail panels).
  //
  // Why a separate harness (and not the shared ContractsHarness.svelte): the
  // Table is a complex, data-heavy component — it renders many header/row/cell
  // DOM elements. Co-locating it in the shared harness would put those elements
  // in the same container as the other contracts, risking selector-count
  // interactions. Keeping the table in its own container — exactly like
  // TableSortContractHarness / TableSelectContractHarness — mirrors how the
  // React harness renders each contract in isolation.
  //
  // Expansion is UNCONTROLLED here (no `defaultExpandedRowKeys`, no controlled
  // expanded prop): IrisTable seeds the framework-agnostic createExpansion model
  // empty and each row's `data-iris-table-expand-toggle` button flips its own
  // expanded key internally, so the harness needs no local `$state`. Providing
  // `renderDetail` adds the leading expand-toggle column; clicking a toggle
  // mounts/unmounts that row's `[data-iris-table-detail-cell]`. In Svelte
  // `renderDetail` is a plain FUNCTION prop (`(row, rowIndex) => unknown`) whose
  // return value the table renders into the detail cell — not a Svelte snippet —
  // so a simple string return is all the contract needs. Same columns/data shape
  // as the React reference harness.
  import IrisTable from './primitives/table/IrisTable.svelte'

  const renderDetail = (row: Record<string, unknown>): string => `Detail ${String(row.name)}`
</script>

<IrisTable
  columns={[{ key: 'name', title: 'Name' }]}
  data={[
    { id: '1', name: 'Bravo' },
    { id: '2', name: 'Alpha' },
    { id: '3', name: 'Charlie' },
  ]}
  {renderDetail}
/>
