import { createClientFetcher, type DataViewColumn } from '@iris-ui-kit/solid'

export type UserStatus = 'active' | 'invited' | 'suspended'
export type UserRole = 'Owner' | 'Admin' | 'Editor' | 'Viewer'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  status: UserStatus
}

export const USER_ROLES: UserRole[] = ['Owner', 'Admin', 'Editor', 'Viewer']
export const USER_STATUSES: UserStatus[] = ['active', 'invited', 'suspended']

/**
 * The session's mutable in-memory Users "table" — the real source of truth the
 * flagship CRUD operates on. Mutators (create/update/remove) mutate this array
 * in place so create/edit/delete persist across page navigations for the
 * session (no backend, no new deps). `createClientFetcher` reads it live, so
 * `controller.reload()` after a mutation reflects the change. Mirrors
 * cms-react/src/data/users.ts.
 */
const store: User[] = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@iris.dev', role: 'Owner', status: 'active' },
  { id: 2, name: 'Alan Turing', email: 'alan@iris.dev', role: 'Admin', status: 'active' },
  { id: 3, name: 'Grace Hopper', email: 'grace@iris.dev', role: 'Editor', status: 'invited' },
  { id: 4, name: 'Linus Torvalds', email: 'linus@iris.dev', role: 'Viewer', status: 'suspended' },
  { id: 5, name: 'Margaret Hamilton', email: 'margaret@iris.dev', role: 'Admin', status: 'active' },
  { id: 6, name: 'Dennis Ritchie', email: 'dennis@iris.dev', role: 'Editor', status: 'invited' },
  { id: 7, name: 'Barbara Liskov', email: 'barbara@iris.dev', role: 'Viewer', status: 'active' },
  { id: 8, name: 'Donald Knuth', email: 'donald@iris.dev', role: 'Editor', status: 'active' },
  {
    id: 9,
    name: 'Katherine Johnson',
    email: 'katherine@iris.dev',
    role: 'Admin',
    status: 'active',
  },
  { id: 10, name: 'Tim Berners-Lee', email: 'tim@iris.dev', role: 'Owner', status: 'active' },
]

let nextId = store.reduce((max, u) => Math.max(max, u.id), 0) + 1

/** Column accessors that drive the controller's client-side filter + sort. */
export const userColumns: DataViewColumn<User>[] = [
  { key: 'name', getValue: (u) => u.name, filterable: true },
  { key: 'email', getValue: (u) => u.email, filterable: true },
  { key: 'role', getValue: (u) => u.role },
  { key: 'status', getValue: (u) => u.status },
]

/** A fetcher over the live in-memory store (filter + sort + paginate). */
export const fetchUsers = createClientFetcher(store, userColumns)

export type UserDraft = Omit<User, 'id'>

/** Total rows currently in the store (for header counters / dashboards). */
export function userCount(): number {
  return store.length
}

/** Insert a new user; returns the created row (with its assigned id). */
export function createUser(draft: UserDraft): User {
  const user: User = { id: nextId++, ...draft }
  store.unshift(user)
  return user
}

/** Patch a user in place by id; returns the updated row (or undefined). */
export function updateUser(id: number, patch: UserDraft): User | undefined {
  const idx = store.findIndex((u) => u.id === id)
  if (idx < 0) return undefined
  store[idx] = { ...store[idx]!, ...patch }
  return store[idx]
}

/** Remove one user by id; returns true when a row was removed. */
export function removeUser(id: number): boolean {
  const idx = store.findIndex((u) => u.id === id)
  if (idx < 0) return false
  store.splice(idx, 1)
  return true
}

/** Remove every user whose id is in `ids`; returns how many were removed. */
export function removeUsers(ids: number[]): number {
  const set = new Set(ids)
  let removed = 0
  for (let i = store.length - 1; i >= 0; i -= 1) {
    if (set.has(store[i]!.id)) {
      store.splice(i, 1)
      removed += 1
    }
  }
  return removed
}
