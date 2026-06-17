<script lang="ts">
  import {
    ThemeProvider,
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
  } from '@iris-ui/svelte'
  import { createThemeStore } from '@iris-ui/theme'
  import { lightTheme, darkTheme } from '@iris-ui/tokens'

  let name = $state('')
  let dialogOpen = $state(false)
  const themeStore = createThemeStore({
    themes: { light: lightTheme, dark: darkTheme },
    default: 'light',
  })

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

<ThemeProvider store={themeStore}>
  <main style="max-width:880px;margin:0 auto;padding:40px 24px">
    <header style="margin-bottom:24px">
      <h1 style="margin:0 0 4px;font-size:24px">Iris UI · SvelteKit SSR smoke</h1>
      <p style="margin:0;color:var(--iris-muted-foreground,#666)">
        Server-rendered page (<code>+page.svelte</code>) built from <code>@iris-ui/svelte</code>. A
        successful <code>vite build</code> is the SSR-compat proof.
      </p>
    </header>

    <section style="display:grid;gap:24px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <IrisButton variant="solid">Primary action</IrisButton>
        <IrisInput value={name} oninput={(e: Event) => name = (e.target as HTMLInputElement).value} placeholder="Type your name…" style="max-width:240px" />
        <IrisBadge tone="primary" variant="solid">{name ? `Hi, ${name}` : 'live badge'}</IrisBadge>
      </div>

      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <IrisDialog open={dialogOpen} onOpenChange={(v) => dialogOpen = v}>
          <IrisDialogTrigger asChild>
            <IrisButton variant="outline">Open dialog</IrisButton>
          </IrisDialogTrigger>
          <IrisDialogContent>
            <IrisDialogTitle>Hydrated overlay</IrisDialogTitle>
            <IrisDialogDescription>
              This dialog was server-rendered closed and became interactive on hydration.
            </IrisDialogDescription>
            <div style="margin-top:16px;text-align:right">
              <IrisDialogClose asChild>
                <IrisButton variant="solid">Close</IrisButton>
              </IrisDialogClose>
            </div>
          </IrisDialogContent>
        </IrisDialog>
      </div>

      <div>
        <h2 style="font-size:16px;margin:0 0 8px">Team</h2>
        <IrisTable {columns} data={rows as unknown as Record<string, unknown>[]} rowKey="id" />
      </div>
    </section>
  </main>
</ThemeProvider>
