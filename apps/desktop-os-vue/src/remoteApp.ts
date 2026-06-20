/**
 * Runtime module-federation loader for `kind:'remote'` apps. A remote app is a
 * plain ESM module, hosted at a URL (same- or cross-origin), that the desktop
 * fetches + evaluates AT RUNTIME — no build-time coupling, no shared bundle.
 * The contract is a single named export `mount`, mirroring the micro-frontend
 * convention: the host hands the module a DOM node, the module renders into it
 * and returns a teardown function the host calls on unmount.
 */

/** What a remote ESM app module must look like. */
export interface RemoteAppModule {
  /**
   * Render the app into `el`. `ctx` carries optional host-provided context
   * (kept `unknown` — the host and module agree on its shape out of band).
   * Returns a teardown fn the host invokes on unmount (or nothing).
   */
  mount: (el: HTMLElement, ctx?: unknown) => (() => void) | void
}

/** A function that resolves a URL to a module (overridable for tests). */
export type RemoteImporter = (url: string) => Promise<unknown>

function isRemoteAppModule(mod: unknown): mod is RemoteAppModule {
  return (
    typeof mod === 'object' && mod !== null && typeof (mod as RemoteAppModule).mount === 'function'
  )
}

/**
 * Dynamic-import the remote app at `url` and return its `mount`. The default
 * importer is a real dynamic `import()` (Vite must not pre-bundle a runtime URL,
 * hence `@vite-ignore`). Throws if the URL fails to load or the module doesn't
 * export a `mount` function.
 */
export async function loadRemoteApp(
  url: string,
  importer: RemoteImporter = (u) => import(/* @vite-ignore */ u),
): Promise<RemoteAppModule['mount']> {
  const mod = await importer(url)
  if (!isRemoteAppModule(mod)) {
    throw new Error(`Remote app at ${url} does not export a mount() function`)
  }
  return mod.mount
}
