<script lang="ts">
  import IrisTable from './IrisTable.svelte'

  let { kind }: { kind: 'empty' | 'loading' | 'error' } = $props()
  const columns = [{ key: 'name', title: 'Name' }]
</script>

{#snippet emptyState()}<span>Nothing</span>{/snippet}
{#snippet loadingState()}<span>Fetching</span>{/snippet}
{#snippet errorState()}<span>Boom</span>{/snippet}

<IrisTable
  {columns}
  data={[]}
  loading={kind === 'loading'}
  error={kind === 'error'}
  {emptyState}
  {loadingState}
  {errorState}
/>
