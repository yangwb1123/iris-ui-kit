<script lang="ts">
  import {
    IrisButton,
    IrisInput,
    IrisBadge,
    IrisDialog,
    IrisDialogTrigger,
    IrisDialogContent,
    IrisDialogTitle,
    IrisDialogDescription,
    IrisDialogClose,
    IrisTable,
  } from '@iris-ui-kit/svelte'

  let name = $state('')
  let dialogOpen = $state(false)

  interface Row {
    id: number
    name: string
    role: string
    status: string
  }
  const rows: Row[] = [
    { id: 1, name: 'Ada Lovelace', role: 'Engineer', status: 'active' },
    { id: 2, name: 'Alan Turing', role: 'Researcher', status: 'active' },
    { id: 3, name: 'Grace Hopper', role: 'Architect', status: 'away' },
  ]
  const columns = [
    { key: 'name', title: 'Name', sortable: true },
    { key: 'role', title: 'Role' },
    { key: 'status', title: 'Status' },
  ]
</script>

<header style="margin-bottom:28px">
  <IrisBadge tone="primary" variant="solid">SSR + hydration</IrisBadge>
  <h1 style="margin:12px 0 6px;font-size:28px">Iris UI SvelteKit reference</h1>
  <p style="margin:0;color:var(--iris-muted-foreground)">
    A file-routed SvelteKit application. This page is rendered on the server, then its Iris controls
    hydrate into an interactive experience.
  </p>
</header>

<section style="display:grid;gap:24px" data-hydration-demo="sveltekit">
  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <IrisButton variant="solid">Primary action</IrisButton>
    <IrisInput
      value={name}
      oninput={(e: Event) => (name = (e.target as HTMLInputElement).value)}
      placeholder="Type your name…"
      style="max-width:240px"
    />
    <IrisBadge tone="primary" variant="solid">{name ? `Hi, ${name}` : 'live badge'}</IrisBadge>
  </div>

  <div style="display:flex;gap:12px;flex-wrap:wrap">
    <IrisDialog open={dialogOpen} onOpenChange={(v) => (dialogOpen = v)}>
      <IrisDialogTrigger asChild>
        {#snippet children(props)}
          <IrisButton variant="outline" {...props.attrs}>Open dialog</IrisButton>
        {/snippet}
      </IrisDialogTrigger>
      <IrisDialogContent>
        <IrisDialogTitle>Hydrated overlay</IrisDialogTitle>
        <IrisDialogDescription>
          This dialog was server-rendered closed and became interactive on hydration.
        </IrisDialogDescription>
        <div style="margin-top:16px;text-align:right">
          <IrisDialogClose asChild>
            {#snippet children(props)}
              <IrisButton variant="solid" {...props}>Close</IrisButton>
            {/snippet}
          </IrisDialogClose>
        </div>
      </IrisDialogContent>
    </IrisDialog>
  </div>

  <div>
    <h2 style="font-size:16px;margin:0 0 8px">Hydrated team table</h2>
    <IrisTable {columns} data={rows as unknown as Record<string, unknown>[]} rowKey="id" />
  </div>
</section>
