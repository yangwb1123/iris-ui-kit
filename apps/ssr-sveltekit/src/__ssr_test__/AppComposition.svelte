<!--
  App-level iris composition reproduced from src/routes/+page.svelte, WITHOUT the
  SvelteKit router / $app machinery, so it can be server-rendered and hydrated in
  a vitest module graph. Kept structurally identical to the page so this test
  guards the page's actual component tree (ThemeProvider + Button/Input/Badge +
  closed Dialog trigger + Table).
-->
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
    </header>
    <section style="display:grid;gap:24px">
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
        <!--
          Mirrors the live page (src/routes/+page.svelte): an <IrisButton> is the
          dialog trigger/close via `asChild`. The Svelte IrisDialogTrigger/Close
          now implement `asChild` (the child snippet receives the trigger props
          to spread onto its own element), so this renders a SINGLE <button> with
          no wrapper — no <button>-in-<button>, no `node_invalid_placement_ssr`,
          no hydration mismatch. This pass guards exactly that.
        -->
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
        <h2 style="font-size:16px;margin:0 0 8px">Team</h2>
        <IrisTable {columns} data={rows as unknown as Record<string, unknown>[]} rowKey="id" />
      </div>
    </section>
  </main>
</ThemeProvider>
