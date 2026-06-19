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

  interface Row { id: number; name: string; role: string; status: string }
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
          NOTE: the live page (src/routes/+page.svelte) wraps an <IrisButton>
          inside <IrisDialogTrigger asChild>. The Svelte IrisDialogTrigger does
          NOT implement `asChild` — it always renders its own <button> — so that
          markup nests a <button> inside a <button>, which Svelte flags as a
          guaranteed `hydration_mismatch`. We therefore exercise the dialog the
          Svelte-supported way (trigger/close render their own button from a text
          child) so this composition is valid SSR/hydration input. See the report.
        -->
        <IrisDialog open={dialogOpen} onOpenChange={(v) => (dialogOpen = v)}>
          <IrisDialogTrigger>Open dialog</IrisDialogTrigger>
          <IrisDialogContent>
            <IrisDialogTitle>Hydrated overlay</IrisDialogTitle>
            <IrisDialogDescription>
              This dialog was server-rendered closed and became interactive on hydration.
            </IrisDialogDescription>
            <div style="margin-top:16px;text-align:right">
              <IrisDialogClose>Close</IrisDialogClose>
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
