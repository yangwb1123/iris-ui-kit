<script lang="ts">
  import { useDataSource, createClientDataSource } from '@iris-ui/svelte'
  import { adminDataViewColumns, type AdminDataPage } from '../core'

  let { page }: { page: AdminDataPage } = $props()

  // Columns + controller are constructed once per mounted instance. The parent
  // keys this component on `page.key`, so a page switch remounts it — mirroring
  // the React `DataPageView` (keyed by `page.key`) where the data hook is stable
  // across page switches.
  // svelte-ignore state_referenced_locally — one-time init read of the page prop.
  const cols = adminDataViewColumns(page.columns)
  // svelte-ignore state_referenced_locally — construct the data source once.
  const ds = useDataSource({
    fetcher: createClientDataSource(page.data, cols),
    pageSize: page.pageSize ?? 10,
  })

  function readCell(row: Record<string, unknown>, dataIndex: string): string {
    return String(row[dataIndex] ?? '')
  }
</script>

<div data-iris-admin-data-page={page.key}>
  {#if page.title}<h2 data-iris-admin-page-title="">{page.title}</h2>{/if}
  <table data-iris-admin-table="">
    <thead>
      <tr>
        {#each page.columns as c (c.key)}
          <th scope="col">{c.title}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each ds.state.rows as row, i (i)}
        <tr>
          {#each page.columns as c (c.key)}
            <td>{readCell(row as Record<string, unknown>, c.dataIndex ?? c.key)}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
  <div data-iris-admin-pager="">
    <button
      type="button"
      disabled={ds.state.page <= 1}
      onclick={() => ds.setPage(ds.state.page - 1)}
    >
      Prev
    </button>
    <span data-iris-admin-page-info="">{ds.state.page} / {ds.pageCount()}</span>
    <button
      type="button"
      disabled={ds.state.page >= ds.pageCount()}
      onclick={() => ds.setPage(ds.state.page + 1)}
    >
      Next
    </button>
  </div>
</div>
