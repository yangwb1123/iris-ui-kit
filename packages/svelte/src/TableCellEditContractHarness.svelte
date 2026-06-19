<script lang="ts">
  // Dedicated cross-framework contract harness for IrisTable's inline cell-edit.
  import IrisTable from './primitives/table/IrisTable.svelte'
</script>

<IrisTable
  columns={[
    { key: 'name', title: 'Name', editable: true },
    { key: 'age', title: 'Age' },
  ]}
  data={[
    { id: '1', name: 'Charlie', age: 30 },
    { id: '2', name: 'Alpha', age: 25 },
    { id: '3', name: 'Bravo', age: 35 },
  ]}
/>
