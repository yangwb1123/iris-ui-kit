import { createPlugin } from '@iris-ui-kit/core'
import { adminMessageDefaults } from './types'

export type { NavNode } from '@iris-ui-kit/core'
export {
  adminMessageDefaults,
  type AdminActionHandler,
  type AdminActionTone,
  type AdminAppSchema,
  type AdminColumn,
  type AdminCrudPermissions,
  type AdminCustomPage,
  type AdminDataFetcher,
  type AdminDataPage,
  type AdminEditorMode,
  type AdminEditorState,
  type AdminFieldType,
  type AdminMessageKey,
  type AdminMessages,
  type AdminMutationHandlers,
  type AdminOperationCapabilities,
  type AdminPage,
  type AdminPermission,
  type AdminRow,
  type AdminRowAction,
  type AdminSchemaIssue,
  type AdminSelectOption,
} from './types'
export {
  AdminSchemaError,
  assertAdminSchema,
  firstNavLeafKey,
  hasAdminPermission,
  normalizeAdminSchema,
  resolveAdminMessage,
  resolveAdminPage,
  validateAdminSchema,
  type AdminTranslate,
} from './schema'
export {
  adminDataViewColumns,
  adminFieldName,
  adminOperationCapabilities,
  coerceAdminFieldValue,
  createAdminDataController,
  formatAdminCell,
  validateAdminDraft,
  type AdminDataController,
} from './controller'

/** CSS custom properties the admin app reads; overridable by the host theme. */
export const adminTokens: Record<string, string> = {
  '--iris-admin-page-gap': 'var(--iris-gap-lg)',
}

const adminI18nMessages = Object.fromEntries(
  Object.entries(adminMessageDefaults).map(([key, value]) => [`admin.${key}`, value]),
)

/**
 * Schema-admin plugin. It contributes tokens and the English fallback
 * dictionary; adapters consume the active i18n provider and remain overrideable
 * per `IrisAdminApp.messages`.
 */
export const adminPlugin = createPlugin({
  name: 'admin',
  install(registry) {
    registry.registerTokens(adminTokens)
    registry.registerMessages('en-US', adminI18nMessages)
  },
})
