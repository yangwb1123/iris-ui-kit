import { describe, expect, it, vi } from 'vitest'
import { AeroIdClient, AeroIdError } from './aeroId'

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  })
}

describe('AeroIdClient', () => {
  it('sends bearer, request, idempotency and read-your-writes headers', async () => {
    const requests: Array<{ url: string; headers: Headers; body?: BodyInit | null }> = []
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        url: String(input),
        headers: new Headers(init?.headers),
        body: init?.body,
      })
      if (requests.length === 1) {
        return json(
          { data: { id: 'job-1', status: 'pending' } },
          { status: 201, headers: { 'X-Aero-Write-Epoch': 'local:7' } },
        )
      }
      return json({
        data: { datasets: [{ name: 'aero-im.workspaces', source: 'aero-im', pii: false }] },
      })
    })
    const client = new AeroIdClient(
      'https://accounts.example.test/v1',
      () => 'access-token',
      fetcher as typeof fetch,
    )

    await client.createSyncJob(['aero-im.workspaces'])
    await client.listDatasets()

    expect(requests[0].headers.get('Authorization')).toBe('Bearer access-token')
    expect(requests[0].headers.get('Idempotency-Key')).toBeTruthy()
    expect(requests[0].headers.get('X-Request-ID')).toBeTruthy()
    expect(requests[1].headers.get('X-Aero-Write-Epoch')).toBe('local:7')
    const body = JSON.parse(String(requests[0].body))
    expect(body.idempotency_key).toBe(requests[0].headers.get('Idempotency-Key'))
  })

  it('encodes datasets as repeated allow-listed query parameters', async () => {
    let requested = new URL('https://invalid.test')
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      requested = new URL(String(input))
      return json({ data: { snapshots: [], partial: false } })
    })
    const client = new AeroIdClient(
      'https://accounts.example.test/v1',
      () => 'token',
      fetcher as typeof fetch,
    )

    await client.getOverview(['aero-im.workspaces', 'aero-vault.usage'])

    expect(requested.searchParams.getAll('dataset')).toEqual([
      'aero-im.workspaces',
      'aero-vault.usage',
    ])
    expect(requested.searchParams.get('consistency')).toBe('eventual')
  })

  it('reads public source health outside the versioned API without forwarding bearer', async () => {
    let requested = new URL('https://invalid.test')
    let headers = new Headers()
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requested = new URL(String(input))
      headers = new Headers(init?.headers)
      return json({
        data: {
          sources: [
            { source: 'snaplink', status: 'ok' },
            { source: 'aero-im', status: 'degraded', error: 'source unreachable' },
          ],
        },
      })
    })
    const client = new AeroIdClient(
      'https://accounts.example.test/api/aero-id/v1',
      () => 'must-not-be-forwarded',
      fetcher as typeof fetch,
    )

    await expect(client.getSourceHealth()).resolves.toEqual([
      { source: 'snaplink', status: 'ok', error: undefined },
      { source: 'aero-im', status: 'degraded', error: 'source unreachable' },
    ])
    expect(requested.pathname).toBe('/api/aero-id/health/sources')
    expect(headers.get('Authorization')).toBeNull()
    expect(headers.get('X-Request-ID')).toBeTruthy()
  })

  it('adapts the shipped activity snapshot envelope', async () => {
    const fetcher = vi.fn(async () =>
      json({
        data: {
          snapshots: [
            {
              dataset: 'aero-im.activity_summary',
              data: {
                events: [{ event_id: 'event-1', event_type: 'message.sent' }],
                next_cursor: 'event-1',
              },
            },
          ],
        },
      }),
    )
    const client = new AeroIdClient(
      'https://accounts.example.test/v1',
      () => 'token',
      fetcher as typeof fetch,
    )

    await expect(client.listActivity()).resolves.toEqual({
      items: [{ event_id: 'event-1', event_type: 'message.sent' }],
      nextCursor: 'event-1',
    })
  })

  it('preserves activity degradation metadata from the canonical envelope', async () => {
    const fetcher = vi.fn(async () =>
      json({
        data: {
          events: [{ event_id: 'event-2' }],
          next_cursor: 'event-2',
          partial: true,
          generated_at: '2026-08-23T00:00:00Z',
          source_errors: { 'aero-im': 'source.unavailable' },
          stale_datasets: ['aero-im.activity_summary'],
        },
      }),
    )
    const client = new AeroIdClient(
      'https://accounts.example.test/v1',
      () => 'token',
      fetcher as typeof fetch,
    )

    await expect(client.listActivity('event-3')).resolves.toEqual({
      items: [{ event_id: 'event-2' }],
      nextCursor: 'event-2',
      partial: true,
      generatedAt: '2026-08-23T00:00:00Z',
      sourceErrors: { 'aero-im': 'source.unavailable' },
      staleDatasets: ['aero-im.activity_summary'],
    })
  })

  it('queries only allow-listed data selections with explicit consistency', async () => {
    let requested = new URL('https://invalid.test')
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      requested = new URL(String(input))
      return json({ data: { snapshots: [], consistency: 'bounded' } })
    })
    const client = new AeroIdClient(
      'https://accounts.example.test/v1',
      () => 'token',
      fetcher as typeof fetch,
    )

    await client.getData(['aero-vault.usage'], 'bounded', '5m')

    expect(requested.pathname).toBe('/v1/me/data')
    expect(requested.searchParams.getAll('dataset')).toEqual(['aero-vault.usage'])
    expect(requested.searchParams.get('consistency')).toBe('bounded')
    expect(requested.searchParams.get('max_age')).toBe('5m')
  })

  it('creates an erase job with one idempotency key in header and body', async () => {
    let headerKey = ''
    let bodyKey = ''
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      headerKey = new Headers(init?.headers).get('Idempotency-Key') ?? ''
      bodyKey = String(JSON.parse(String(init?.body)).idempotency_key)
      return json({ data: { job_id: 'erase-1', job_type: 'erase', status: 'pending' } })
    })
    const client = new AeroIdClient(
      'https://accounts.example.test/v1',
      () => 'token',
      fetcher as typeof fetch,
    )

    await expect(client.createEraseJob()).resolves.toMatchObject({ job_id: 'erase-1' })
    expect(headerKey).not.toBe('')
    expect(bodyKey).toBe(headerKey)
  })

  it('preserves stable API error metadata without exposing the bearer token', async () => {
    const fetcher = vi.fn(async () =>
      json(
        {
          error: {
            code: 'account.projection_stale',
            message: 'Projection is stale',
            request_id: 'req-7',
          },
        },
        { status: 503 },
      ),
    )
    const client = new AeroIdClient(
      'https://accounts.example.test/v1',
      () => 'secret-token',
      fetcher as typeof fetch,
    )

    const error = await client.getMe().catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(AeroIdError)
    expect(error).toMatchObject({
      status: 503,
      code: 'account.projection_stale',
      requestId: 'req-7',
    })
    expect(String(error)).not.toContain('secret-token')
  })

  it('loads and reconciles a sync job through the documented job endpoints', async () => {
    const requests: Array<{ url: string; method?: string }> = []
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), method: init?.method })
      return json({ data: { job_id: 'job/1', status: 'completed' } })
    })
    const client = new AeroIdClient(
      'https://accounts.example.test/v1',
      () => 'token',
      fetcher as typeof fetch,
    )

    await expect(client.getSyncJob('job/1')).resolves.toMatchObject({ job_id: 'job/1' })
    await expect(client.reconcileSyncJob('job/1')).resolves.toMatchObject({ status: 'completed' })

    expect(requests).toEqual([
      { url: 'https://accounts.example.test/v1/sync/jobs/job%2F1', method: 'GET' },
      {
        url: 'https://accounts.example.test/v1/sync/jobs/job%2F1/reconcile',
        method: 'POST',
      },
    ])
  })

  it('downloads an authorized export into a bounded private browser blob', async () => {
    let requestHeaders = new Headers()
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestHeaders = new Headers(init?.headers)
      return new Response('{"schema_version":1}', {
        headers: { 'Content-Type': 'application/json', 'Content-Length': '20' },
      })
    })
    const client = new AeroIdClient(
      'https://accounts.example.test/v1',
      () => 'download-token',
      fetcher as typeof fetch,
    )

    const file = await client.downloadExport('job-7', true)

    expect(fetcher).toHaveBeenCalledWith(
      new URL('https://accounts.example.test/v1/sync/jobs/job-7/export/download?one_time=true'),
      expect.objectContaining({ method: 'GET', credentials: 'omit' }),
    )
    expect(requestHeaders.get('Authorization')).toBe('Bearer download-token')
    expect(file.filename).toBe('aero-id-export.json')
    expect(file.blob).toMatchObject({ size: 20, type: 'application/json' })
  })

  it('rejects an export whose declared size exceeds the UI safety cap', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('{}', {
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': String(65 * 1024 * 1024),
          },
        }),
    )
    const client = new AeroIdClient(
      'https://accounts.example.test/v1',
      () => 'token',
      fetcher as typeof fetch,
    )

    await expect(client.downloadExport('job-8')).rejects.toMatchObject({
      code: 'response.too_large',
    })
  })

  it('loads and reconciles an unknown operation without creating a new command', async () => {
    const requests: Array<{ url: string; method?: string }> = []
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), method: init?.method })
      return json({ data: { operation_id: 'operation/1', status: 'completed', steps: [] } })
    })
    const client = new AeroIdClient(
      'https://accounts.example.test/v1',
      () => 'token',
      fetcher as typeof fetch,
    )

    await expect(client.getOperation('operation/1')).resolves.toMatchObject({
      operation_id: 'operation/1',
    })
    await expect(client.reconcileOperation('operation/1')).resolves.toMatchObject({
      status: 'completed',
    })

    expect(requests).toEqual([
      { url: 'https://accounts.example.test/v1/operations/operation%2F1', method: 'GET' },
      {
        url: 'https://accounts.example.test/v1/operations/operation%2F1/reconcile',
        method: 'POST',
      },
    ])
  })

  it('loads the cursor-paged redacted audit timeline for one operation', async () => {
    let requested = new URL('https://invalid.test')
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      requested = new URL(String(input))
      return json({
        data: {
          operation_id: 'operation-7',
          events: [{ id: 'audit-1', action: 'operation.reconciled', payload: { status: 'ok' } }],
          next_cursor: 'audit-1',
        },
      })
    })
    const client = new AeroIdClient(
      'https://accounts.example.test/v1',
      () => 'token',
      fetcher as typeof fetch,
    )

    await expect(client.getOperationTimeline('operation/7', 'audit-0')).resolves.toEqual({
      items: [{ id: 'audit-1', action: 'operation.reconciled', payload: { status: 'ok' } }],
      nextCursor: 'audit-1',
    })
    expect(requested.pathname).toBe('/v1/audit/operations/operation%2F7')
    expect(requested.searchParams.get('cursor')).toBe('audit-0')
    expect(requested.searchParams.get('limit')).toBe('50')
  })

  it('lists redacted audit events with encoded filters and cursor pagination', async () => {
    let requested = new URL('https://invalid.test')
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      requested = new URL(String(input))
      return json({
        data: {
          events: [{ id: 'audit-2', action: 'account.updated' }],
          next_cursor: 'audit-2',
        },
      })
    })
    const client = new AeroIdClient(
      'https://accounts.example.test/v1',
      () => 'token',
      fetcher as typeof fetch,
    )

    await expect(
      client.listAuditEvents(
        {
          operationId: 'operation/7',
          requestId: 'request 8',
          source: 'aero-id',
          action: 'account.updated',
          from: '2026-08-22T00:00:00.000Z',
          to: '2026-08-23T00:00:00.000Z',
        },
        'audit/1',
      ),
    ).resolves.toEqual({
      items: [{ id: 'audit-2', action: 'account.updated' }],
      nextCursor: 'audit-2',
    })
    expect(requested.pathname).toBe('/v1/audit/events')
    expect(Object.fromEntries(requested.searchParams)).toMatchObject({
      operation_id: 'operation/7',
      request_id: 'request 8',
      source: 'aero-id',
      action: 'account.updated',
      from: '2026-08-22T00:00:00.000Z',
      to: '2026-08-23T00:00:00.000Z',
      cursor: 'audit/1',
      limit: '50',
    })
  })

  it('verifies one audit source partition through the read-only endpoint', async () => {
    let requested = new URL('https://invalid.test')
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      requested = new URL(String(input))
      return json({ data: { source: 'aero/id', partition: 'tenant 7', verified: true } })
    })
    const client = new AeroIdClient(
      'https://accounts.example.test/v1',
      () => 'token',
      fetcher as typeof fetch,
    )

    await expect(client.verifyAuditChain('aero/id', 'tenant 7')).resolves.toEqual({
      source: 'aero/id',
      partition: 'tenant 7',
      verified: true,
    })
    expect(requested.pathname).toBe('/v1/audit/verify')
    expect(requested.searchParams.get('source')).toBe('aero/id')
    expect(requested.searchParams.get('partition')).toBe('tenant 7')
  })
})
