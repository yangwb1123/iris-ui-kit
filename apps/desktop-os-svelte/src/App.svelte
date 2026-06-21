<script lang="ts">
  import { serializeSession, restoreSession, type WindowSession } from '@iris-ui/core/window'
  import { type VfsState } from '@iris-ui/core/fs'
  import { barInsets } from './os'
  import { useOs } from './os-state.svelte'
  import { wm } from './wm.svelte'
  import { profile } from './profile.svelte'
  import { fs } from './fs.svelte'
  import { getManifest, registerCustomApps, type AppManifest } from './catalog'
  import Desktop from './Desktop.svelte'

  let rootEl: HTMLDivElement | undefined = $state()

  // ── Window-session persistence ─────────────────────────────────────────────
  // Open windows (geometry, state, stacking, focus) survive a reload: restored
  // ONCE after hydrate, then re-saved (debounced) on every WM change. Mirrors the
  // React shell (apps/desktop-os/src/App.tsx). `restored` is a plain (non-reactive)
  // guard so the debounced save can never overwrite the saved session before restore.
  let restored = false

  // ── Virtual file-system persistence ────────────────────────────────────────
  // User files survive a reload: hydrated ONCE from the profile `fs` pref (or
  // seeded with a starter set), then re-saved (debounced) on every fs change.
  // Mirrors the React shell (apps/desktop-os/src/App.tsx). `fsReady` is a plain
  // (non-reactive) guard so the debounced save can't overwrite the saved state
  // before hydrate runs.
  let fsReady = false

  /** Seed the fs from the saved `fs` pref, or a starter set of files. */
  function hydrateFs(): void {
    const saved = profile.getPref<VfsState>('fs')
    if (saved && Array.isArray(saved.folders) && saved.files) {
      fs.store.setState(() => saved)
    } else if (Object.keys(fs.getState().files).length === 0) {
      fs.write(
        '/Documents/Welcome.txt',
        'Welcome to Iris Desktop OS.\n\nThis Files app is a real virtual file system — create folders and text files, rename, delete. It persists to your profile and survives a reload.',
      )
      fs.write(
        '/Documents/notes.md',
        '# Notes\n\n- Backed by @iris-ui/core/fs\n- The same engine drives all four shells.',
      )
      fs.mkdir('/Pictures')
    }
  }

  /** The saved session, filtered to apps that still resolve (removed apps skipped). */
  function knownSession(): WindowSession {
    const raw = profile.getPref<WindowSession>('session')
    if (!Array.isArray(raw)) return []
    // Custom (URL-added) apps live in prefs — register them so getManifest resolves.
    registerCustomApps((profile.getPref<AppManifest[]>('customApps') ?? []) as AppManifest[])
    return raw.filter((e) => Boolean(getManifest(e.appId)))
  }

  // The live OS skin (Win11 / macOS). Its `chrome.vars` are written onto the
  // desktop root inline (replacing the hardcoded Win11 vars in style.css) so a
  // skin switch re-skins everything live, and its `barInsets` drive the WM work
  // area so maximize / snap track the taskbar vs. the menu-bar + dock.
  const osCtx = useOs()
  const chrome = $derived(osCtx.chrome)
  // The chrome's CSS custom properties as a `--key:value;…` inline-style string.
  const skinStyle = $derived(
    Object.entries(chrome.vars)
      .map(([k, v]) => `${k}:${v}`)
      .join(';'),
  )

  // Load the user profile (installed apps + custom web apps + prefs) from storage
  // once at startup. Hydration is async; the desktop renders immediately and the
  // installed/custom apps appear in the launchers when it lands. Once hydrated,
  // restore the saved window session (the work-area effect below has already run
  // synchronously on mount, so restored geometry clamps correctly).
  $effect(() => {
    void profile.hydrate().then(() => {
      if (!fsReady) {
        fsReady = true
        hydrateFs()
      }
      if (restored) return
      restored = true
      if (wm.getState().windows.length === 0) restoreSession(wm, knownSession())
    })
  })

  // Persist the window session (debounced) on every WM change, once restore ran.
  $effect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = wm.subscribe(() => {
      if (!restored) return
      clearTimeout(timer)
      timer = setTimeout(() => profile.setPref('session', serializeSession(wm.getState())), 400)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  })

  // Persist the virtual file system (debounced) on every fs change, once hydrate
  // ran — so user files (and folder structure) survive a reload.
  $effect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = fs.subscribe(() => {
      if (!fsReady) return
      clearTimeout(timer)
      timer = setTimeout(() => profile.setPref('fs', fs.getState()), 400)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  })

  // Reserve the top + bottom bars and feed the remaining rectangle to the WM as
  // its work area (drives maximize + snap). Re-measured on resize via a
  // ResizeObserver AND recomputed whenever the chrome (skin) changes — reading
  // `chrome` here makes the `$effect` re-run on every OS switch.
  $effect(() => {
    const el = rootEl
    if (!el) return
    const { top, bottom } = barInsets(chrome)
    const apply = () => {
      const r = el.getBoundingClientRect()
      wm.setWorkArea({
        x: 0,
        y: top,
        width: r.width,
        height: Math.max(240, r.height - top - bottom),
      })
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  })
</script>

<div bind:this={rootEl} class="os-root" style={skinStyle}>
  <Desktop />
</div>

<style>
  .os-root {
    position: fixed;
    inset: 0;
    overflow: hidden;
    font-family: var(--os-font);
    background: var(--os-wallpaper);
  }
</style>
