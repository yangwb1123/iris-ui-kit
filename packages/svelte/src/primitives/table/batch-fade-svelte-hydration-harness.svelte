<script lang="ts">
  import IrisTable from './IrisTable.svelte'

  const columns = [
    { key: 'name', title: 'Name', width: 100 },
    { key: 'age', title: 'Age', width: 120 },
  ]
  const data = [{ id: 1, name: 'Alice', age: 25 }]
  let visibility = $state<Record<string, boolean>>({ age: false })

  export function showAge(): void {
    visibility = { age: true }
  }
</script>

<IrisTable {columns} {data} rowKey="id" columnVisibility={visibility} columnFade />
