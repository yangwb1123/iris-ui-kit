/**
 * The four CMS shells intentionally share one framework-agnostic, persistent
 * repository. This file preserves the app-local import path used by the pages.
 */
export {
  createUser,
  fetchUsers,
  removeUser,
  removeUsers,
  updateUser,
  userColumns,
  userCount,
  USER_ROLES,
  USER_STATUSES,
  type User,
  type UserDraft,
  type UserRole,
  type UserStatus,
} from '@iris-ui-kit/cms-shared'
