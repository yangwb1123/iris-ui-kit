import { describe, expect, it } from 'vitest'
import { identitySecurityProjection } from './identitySecurityProjection'

describe('identitySecurityProjection', () => {
  it('normalizes the four bounded Snaplink datasets', () => {
    const projection = identitySecurityProjection({
      snapshots: [
        {
          dataset: 'snaplink.identity',
          source_region: 'local',
          data: {
            username: 'admin',
            email: 'admin@example.test',
            display_name: 'Platform Admin',
            status: 'active',
          },
        },
        {
          dataset: 'snaplink.tenants',
          source_region: 'local',
          data: { items: ['platform-local', { id: 'tenant-b', role: 'member' }] },
        },
        {
          dataset: 'snaplink.permissions',
          source_region: 'local',
          data: { roles: ['platform-admin'], permissions: [{ code: 'account.read' }] },
        },
        { dataset: 'snaplink.security', source_region: 'local', data: { status: 'active' } },
      ],
    })

    expect(projection.identity.username).toBe('admin')
    expect(projection.tenants).toEqual([
      { tenant_id: 'platform-local' },
      { tenant_id: 'tenant-b', role: 'member' },
    ])
    expect(projection.roles).toEqual([{ role: 'platform-admin' }])
    expect(projection.permissions).toEqual([{ permission: 'account.read', code: 'account.read' }])
    expect(projection.sourceRegions).toEqual(['local'])
    expect(projection.sourceAccountStatus).toBe('active')
  })

  it('drops credential-shaped and unknown fields instead of rendering generic JSON', () => {
    const projection = identitySecurityProjection({
      snapshots: [
        {
          dataset: 'snaplink.identity',
          data: {
            username: 'admin',
            password: 'secret',
            api_key: 'key',
            nested: { token: 'token' },
          },
        },
        {
          dataset: 'snaplink.security',
          data: { status: 'active', mfa_secret: 'secret', session_token: 'token' },
        },
      ],
    })

    expect(projection.identity).toEqual({ username: 'admin' })
    expect(projection.security).toEqual({ status: 'active' })
    expect(JSON.stringify(projection)).not.toContain('secret')
    expect(JSON.stringify(projection)).not.toContain('session_token')
  })

  it('preserves the stable not-found account state', () => {
    const projection = identitySecurityProjection({
      snapshots: [
        { dataset: 'snaplink.identity', data: { status: 'not_found' } },
        { dataset: 'snaplink.security', data: { status: 'not_found' } },
      ],
    })

    expect(projection.sourceAccountStatus).toBe('not_found')
    expect(projection.roles).toEqual([])
    expect(projection.permissions).toEqual([])
  })
})
