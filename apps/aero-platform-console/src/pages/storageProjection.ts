import type { AggregateView, JsonRecord } from '../types'

export const storageDatasets = [
  'aero-vault.tenants',
  'aero-vault.buckets',
  'aero-vault.usage',
] as const

export interface StorageUsage {
  tenantId?: string
  usedBytes?: number
  usedObjects?: number
  maxBytes?: number
  maxObjects?: number
}

export interface StorageProjection {
  tenants: JsonRecord[]
  buckets: JsonRecord[]
  usage: StorageUsage
  snapshots: JsonRecord[]
  sourceRegions: string[]
  view: AggregateView
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function dataFor(view: AggregateView, dataset: string): JsonRecord {
  const snapshot = view.snapshots?.find((item) => item.dataset === dataset)
  return isRecord(snapshot?.data) ? snapshot.data : {}
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function nonnegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

function bucketRecords(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [{ name: item.trim() }]
    if (!isRecord(item)) return []
    const name = item.name ?? item.bucket ?? item.id
    if (typeof name !== 'string' || !name.trim()) return []
    return [{ ...item, name: name.trim() }]
  })
}

export function storageProjection(view: AggregateView): StorageProjection {
  const snapshots = (view.snapshots ?? []).filter((item) =>
    storageDatasets.includes(String(item.dataset) as (typeof storageDatasets)[number]),
  )
  const tenantData = dataFor(view, storageDatasets[0])
  const bucketData = dataFor(view, storageDatasets[1])
  const usageData = dataFor(view, storageDatasets[2])
  const sourceRegions = Array.from(
    new Set(
      snapshots.flatMap((snapshot) =>
        typeof snapshot.source_region === 'string' && snapshot.source_region
          ? [snapshot.source_region]
          : [],
      ),
    ),
  )
  return {
    tenants: records(tenantData.items),
    buckets: bucketRecords(bucketData.items),
    usage: {
      tenantId: typeof usageData.tenant_id === 'string' ? usageData.tenant_id : undefined,
      usedBytes: nonnegativeNumber(usageData.used_bytes),
      usedObjects: nonnegativeNumber(usageData.used_objects),
      maxBytes: nonnegativeNumber(usageData.max_bytes),
      maxObjects: nonnegativeNumber(usageData.max_objects),
    },
    snapshots,
    sourceRegions,
    view,
  }
}

export function usagePercent(used?: number, maximum?: number): number | undefined {
  if (used === undefined || maximum === undefined || maximum <= 0) {
    return undefined
  }
  return Math.min(100, Math.round((used / maximum) * 1000) / 10)
}

export function formatBytes(value?: number): string {
  if (value === undefined || !Number.isSafeInteger(value) || value < 0) return '未提供'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let amount = value
  let unit = 0
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024
    unit += 1
  }
  const digits = unit === 0 || amount >= 100 ? 0 : amount >= 10 ? 1 : 2
  return `${amount.toFixed(digits)} ${units[unit]}`
}
