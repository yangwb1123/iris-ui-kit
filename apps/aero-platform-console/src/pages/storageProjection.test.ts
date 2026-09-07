import { describe, expect, it } from 'vitest'
import { formatBytes, storageProjection, usagePercent } from './storageProjection'

describe('storageProjection', () => {
  it('normalizes bounded Aero Vault tenant, bucket and usage datasets', () => {
    const projection = storageProjection({
      snapshots: [
        {
          dataset: 'aero-vault.tenants',
          source_region: 'local',
          data: { items: [{ id: 'platform-local', status: 'active' }] },
        },
        {
          dataset: 'aero-vault.buckets',
          source_region: 'local',
          data: { items: ['documents', { bucket: 'images', versioning: true }, '', 42] },
        },
        {
          dataset: 'aero-vault.usage',
          source_region: 'local',
          data: {
            tenant_id: 'platform-local',
            used_bytes: 1536,
            used_objects: 3,
            max_bytes: 4096,
            max_objects: 20,
          },
        },
      ],
    })

    expect(projection.tenants).toEqual([{ id: 'platform-local', status: 'active' }])
    expect(projection.buckets).toEqual([
      { name: 'documents' },
      { bucket: 'images', versioning: true, name: 'images' },
    ])
    expect(projection.usage).toEqual({
      tenantId: 'platform-local',
      usedBytes: 1536,
      usedObjects: 3,
      maxBytes: 4096,
      maxObjects: 20,
    })
    expect(projection.sourceRegions).toEqual(['local'])
  })

  it('fails closed to empty and nonnegative display values for malformed projection data', () => {
    const projection = storageProjection({
      snapshots: [
        {
          dataset: 'aero-vault.usage',
          data: { used_bytes: -1, used_objects: '7', max_bytes: Number.NaN },
        },
      ],
    })

    expect(projection.buckets).toEqual([])
    expect(projection.usage.usedBytes).toBeUndefined()
    expect(projection.usage.usedObjects).toBeUndefined()
    expect(projection.usage.maxBytes).toBeUndefined()
  })

  it('formats quotas without overstating percentages', () => {
    expect(formatBytes(1536)).toBe('1.50 KiB')
    expect(formatBytes(1024 * 1024)).toBe('1.00 MiB')
    expect(formatBytes(undefined)).toBe('未提供')
    expect(usagePercent(1536, 4096)).toBe(37.5)
    expect(usagePercent(15, 10)).toBe(100)
    expect(usagePercent(1, 0)).toBeUndefined()
  })
})
