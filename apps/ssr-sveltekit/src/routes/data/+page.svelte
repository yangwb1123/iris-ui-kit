<script lang="ts">
  import { IrisBadge, IrisTable } from '@iris-ui-kit/svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  const columns = [
    { key: 'name', title: 'Name', sortable: true },
    { key: 'role', title: 'Role' },
    { key: 'status', title: 'Status' },
  ]
</script>

<header style="margin-bottom:28px">
  <IrisBadge tone="success" variant="solid">SvelteKit server load</IrisBadge>
  <h1 style="margin:12px 0 6px;font-size:28px">Server data</h1>
  <p style="margin:0;color:var(--iris-muted-foreground)">
    The page loader ran during SSR and SvelteKit serialized its result for hydration.
  </p>
</header>

<section aria-labelledby="team-heading" data-ssr-source={data.source}>
  <div
    style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px"
  >
    <h2 id="team-heading" style="font-size:18px;margin:0">Loaded on the server</h2>
    <span style="color:var(--iris-muted-foreground);font-size:13px">{data.generatedAt}</span>
  </div>
  <IrisTable {columns} data={data.rows as Record<string, unknown>[]} rowKey="id" />
</section>
