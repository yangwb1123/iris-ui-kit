/** Data and resilience foundation primitives kept behind the public core barrel. */
export * from './disposable'
export * from './query-cache'
export * from './realtime'
export * from './outbox'
export * from './event-bus'
export * from './circuit-breaker'
export * from './rate-limiter'
export * from './resilient-fetcher'
export {
  composeFeatures,
  hasComposableFeatures,
  COMPOSE_ORDER,
  type ComposableFeature,
} from './compose'
export {
  validateEditRules,
  validateEditRulesAsync,
  type EditRule,
  type EditRuleContext,
  type EditRules,
} from './edit-rules'
export { createUndoStack, type UndoStack, type UndoStackOptions } from './undo'
export {
  createAuditLog,
  type AuditLog,
  type AuditLogEntry,
  type AuditLogOptions,
  type AuditLogType,
} from './audit-log'
export {
  createVersionHistory,
  type VersionHistory,
  type VersionHistoryEntry,
  type VersionHistoryOptions,
} from './version-history'
export { createPerfStats, nowMs, type PerfSample, type PerfStats } from './perf-stats'
export { setCellValue } from './cell-edit'
