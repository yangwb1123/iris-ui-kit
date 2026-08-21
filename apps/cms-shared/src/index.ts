/** Public CMS shared contract. Runtime domains live in focused modules. */
export type { KeyValueStorage } from './storage'
export * from './auth'
export * from './users'
export * from './settings'
export * from './workspaces'

import { createCmsUserRepository } from './users'

// Preserve the package-level convenience API used by all four CMS demos.
const users = createCmsUserRepository()

export const fetchUsers = users.fetchUsers
export const userCount = users.userCount
export const createUser = users.createUser
export const updateUser = users.updateUser
export const removeUser = users.removeUser
export const removeUsers = users.removeUsers
export const pendingUserWrites = users.pendingWrites
export const flushUserWrites = users.flushWrites
export const userRepositoryEvents = users.events
