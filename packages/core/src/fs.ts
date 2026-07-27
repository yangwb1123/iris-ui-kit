import { createStore, type Store } from './store'

/**
 * `@iris-ui-kit/core/fs` — a framework-agnostic VIRTUAL FILE SYSTEM: the state engine
 * behind a desktop "Files" manager and any app that opens/saves documents. A flat
 * map of absolute paths → text content, plus a set of explicit (possibly empty)
 * folders; directory structure is derived from path prefixes. Pure + persistable
 * (the shell mirrors the state into the user profile, gating writes on the
 * `storage` permission). Off the core path (own subpath).
 */

export interface VfsState {
  /** Absolute file path (e.g. `/Documents/note.txt`) → text content. */
  files: Record<string, string>
  /** Explicitly-created directories (so empty folders persist). Always includes `/`. */
  folders: string[]
}

/** A directory listing entry. */
export interface VfsEntry {
  /** Absolute, normalized path. */
  path: string
  /** Last path segment (display name). */
  name: string
  type: 'file' | 'folder'
}

export interface VirtualFs {
  store: Store<VfsState>
  getState(): VfsState
  subscribe(listener: (state: VfsState) => void): () => void
  /** Create/overwrite a file (parent dirs are implied). */
  write(path: string, content: string): void
  /** Read a file's content (undefined if missing). */
  read(path: string): string | undefined
  /** Create an (empty) directory. */
  mkdir(path: string): void
  /** Delete a file, or a folder and everything under it. */
  remove(path: string): void
  /** Move/rename a file or a whole folder subtree. */
  rename(from: string, to: string): void
  /** Immediate children of `dir` (folders first, then files; each sorted by name). */
  list(dir?: string): VfsEntry[]
  /** Does a file OR directory exist at `path`? */
  exists(path: string): boolean
}

/** Normalize to an absolute, slash-collapsed path with no trailing slash (`/` for root). */
export function normalizePath(path: string): string {
  const parts = path.split('/').filter((s) => s && s !== '.')
  return '/' + parts.join('/')
}
function dirOf(path: string): string {
  const p = normalizePath(path)
  if (p === '/') return '/'
  const i = p.lastIndexOf('/')
  return i === 0 ? '/' : p.slice(0, i)
}
function nameOf(path: string): string {
  const p = normalizePath(path)
  return p === '/' ? '' : p.slice(p.lastIndexOf('/') + 1)
}
/** Every directory implied by files + explicit folders (incl. all ancestors + `/`). */
function allDirs(state: VfsState): Set<string> {
  const dirs = new Set<string>(['/'])
  const addAncestors = (p: string) => {
    let d = dirOf(p)
    while (d !== '/') {
      dirs.add(d)
      d = dirOf(d)
    }
  }
  for (const f of Object.keys(state.files)) addAncestors(f)
  for (const folder of state.folders) {
    const n = normalizePath(folder)
    if (n !== '/') {
      dirs.add(n)
      addAncestors(n)
    }
  }
  return dirs
}

export function createVirtualFs(options: { initial?: Partial<VfsState> } = {}): VirtualFs {
  const store = createStore<VfsState>({
    files: { ...(options.initial?.files ?? {}) },
    folders: [...new Set(['/', ...(options.initial?.folders ?? [])].map(normalizePath))],
  })

  const exists: VirtualFs['exists'] = (path) => {
    const p = normalizePath(path)
    return p in store.getState().files || allDirs(store.getState()).has(p)
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    write(path, content) {
      const p = normalizePath(path)
      if (p === '/') return
      store.setState((s) => ({ ...s, files: { ...s.files, [p]: content } }))
    },
    read: (path) => store.getState().files[normalizePath(path)],
    mkdir(path) {
      const p = normalizePath(path)
      if (p === '/') return
      store.setState((s) => (s.folders.includes(p) ? s : { ...s, folders: [...s.folders, p] }))
    },
    remove(path) {
      const p = normalizePath(path)
      if (p === '/') return
      const prefix = p + '/'
      store.setState((s) => {
        const files: Record<string, string> = {}
        for (const [k, v] of Object.entries(s.files)) {
          if (k !== p && !k.startsWith(prefix)) files[k] = v
        }
        const folders = s.folders.filter((f) => f !== p && !f.startsWith(prefix))
        return { files, folders }
      })
    },
    rename(from, to) {
      const a = normalizePath(from)
      const b = normalizePath(to)
      if (a === '/' || b === '/' || a === b) return
      const prefix = a + '/'
      store.setState((s) => {
        const files: Record<string, string> = {}
        for (const [k, v] of Object.entries(s.files)) {
          if (k === a) files[b] = v
          else if (k.startsWith(prefix)) files[b + k.slice(a.length)] = v
          else files[k] = v
        }
        const folders = s.folders.map((f) =>
          f === a ? b : f.startsWith(prefix) ? b + f.slice(a.length) : f,
        )
        return { files, folders }
      })
    },
    list(dir = '/') {
      const d = normalizePath(dir)
      const state = store.getState()
      const folders = [...allDirs(state)]
        .filter((p) => p !== '/' && dirOf(p) === d)
        .map((p): VfsEntry => ({ path: p, name: nameOf(p), type: 'folder' }))
        .sort((x, y) => x.name.localeCompare(y.name))
      const files = Object.keys(state.files)
        .filter((p) => dirOf(p) === d)
        .map((p): VfsEntry => ({ path: p, name: nameOf(p), type: 'file' }))
        .sort((x, y) => x.name.localeCompare(y.name))
      return [...folders, ...files]
    },
    exists,
  }
}
