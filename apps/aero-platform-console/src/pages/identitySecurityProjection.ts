import type { AggregateView, JsonRecord } from '../types'

export const identitySecurityDatasets = [
  'snaplink.identity',
  'snaplink.tenants',
  'snaplink.permissions',
  'snaplink.security',
] as const

export interface IdentitySecurityProjection {
  identity: JsonRecord
  security: JsonRecord
  tenants: JsonRecord[]
  roles: JsonRecord[]
  permissions: JsonRecord[]
  snapshots: JsonRecord[]
  sourceRegions: string[]
  sourceAccountStatus: string
  view: AggregateView
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function dataFor(view: AggregateView, dataset: string): JsonRecord {
  const snapshot = view.snapshots?.find((item) => item.dataset === dataset)
  return isRecord(snapshot?.data) ? snapshot.data : {}
}

function safeRecord(value: unknown, keys: readonly string[]): JsonRecord {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    keys.flatMap((key) => {
      const item = value[key]
      return typeof item === 'string' || typeof item === 'boolean' ? [[key, item]] : []
    }),
  )
}

function namedRecords(value: unknown, key: string): JsonRecord[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [{ [key]: item.trim() }]
    if (!isRecord(item)) return []
    const name = item[key] ?? item.code ?? item.name ?? item.id
    if (typeof name !== 'string' || !name.trim()) return []
    return [safeRecord({ ...item, [key]: name.trim() }, [key, 'code', 'name', 'status'])]
  })
}

function tenantRecords(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [{ tenant_id: item.trim() }]
    if (!isRecord(item)) return []
    const tenantID = item.tenant_id ?? item.id
    if (typeof tenantID !== 'string' || !tenantID.trim()) return []
    return [
      safeRecord({ ...item, tenant_id: tenantID.trim() }, ['tenant_id', 'name', 'role', 'status']),
    ]
  })
}

function snapshotMetadata(value: JsonRecord): JsonRecord {
  const result: JsonRecord = {}
  for (const key of [
    'id',
    'source',
    'source_region',
    'dataset',
    'status',
    'version',
    'generated_at',
    'last_synced_at',
    'expires_at',
    'error_code',
  ]) {
    const item = value[key]
    if (typeof item === 'string' || (typeof item === 'number' && Number.isSafeInteger(item))) {
      result[key] = item
    }
  }
  return result
}

export function identitySecurityProjection(view: AggregateView): IdentitySecurityProjection {
  const identityData = dataFor(view, identitySecurityDatasets[0])
  const tenantData = dataFor(view, identitySecurityDatasets[1])
  const permissionData = dataFor(view, identitySecurityDatasets[2])
  const securityData = dataFor(view, identitySecurityDatasets[3])
  const identity = safeRecord(identityData, ['email', 'username', 'name', 'display_name', 'status'])
  const security = safeRecord(securityData, ['status'])
  const snapshots = (view.snapshots ?? [])
    .filter((item) =>
      identitySecurityDatasets.includes(
        String(item.dataset) as (typeof identitySecurityDatasets)[number],
      ),
    )
    .map(snapshotMetadata)
  const sourceRegions = Array.from(
    new Set(
      snapshots.flatMap((snapshot) =>
        typeof snapshot.source_region === 'string' && snapshot.source_region
          ? [snapshot.source_region]
          : [],
      ),
    ),
  )
  const status = String(identity.status ?? security.status ?? 'unknown')
  return {
    identity,
    security,
    tenants: tenantRecords(tenantData.items),
    roles: namedRecords(permissionData.roles, 'role'),
    permissions: namedRecords(permissionData.permissions, 'permission'),
    snapshots,
    sourceRegions,
    sourceAccountStatus: status,
    view: {
      consistency: view.consistency,
      partial: view.partial,
      stale_datasets: view.stale_datasets?.filter((dataset) =>
        identitySecurityDatasets.includes(dataset as (typeof identitySecurityDatasets)[number]),
      ),
      generated_at: view.generated_at,
      snapshots,
    },
  }
}
