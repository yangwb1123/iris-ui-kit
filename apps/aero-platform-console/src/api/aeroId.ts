import type {
  AccountView,
  AggregateView,
  ConsistencyMode,
  Dataset,
  JsonRecord,
  PageData,
  Profile,
  SourceHealth,
} from '../types'

const requestTimeoutMs = 15_000
const maxJsonResponseBytes = 2 * 1024 * 1024
const maxExportResponseBytes = 64 * 1024 * 1024

interface ErrorEnvelope {
  error?: { code?: string; message?: string; request_id?: string }
}

export interface RequestOptions {
  query?: Record<string, string | number | string[] | undefined>
  body?: unknown
  idempotencyKey?: string
}

export interface DownloadedFile {
  blob: Blob
  filename: string
}

export interface AuditEventFilters {
  source?: string
  actorUid?: string
  requestId?: string
  tenantId?: string
  action?: string
  resourceType?: string
  accountId?: string
  operationId?: string
  from?: string
  to?: string
}

export class AeroIdError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message)
    this.name = 'AeroIdError'
  }
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function dataOf(value: unknown): JsonRecord {
  if (!isRecord(value) || !isRecord(value.data)) return {}
  return value.data
}

function pageOf(data: JsonRecord, field: string): PageData<JsonRecord> {
  return {
    items: records(data[field]),
    nextCursor: typeof data.next_cursor === 'string' ? data.next_cursor : undefined,
  }
}

function activityPage(data: JsonRecord): PageData<JsonRecord> {
  if (Array.isArray(data.events)) {
    return {
      ...pageOf(data, 'events'),
      partial: data.partial === true,
      generatedAt: typeof data.generated_at === 'string' ? data.generated_at : undefined,
      sourceErrors: isRecord(data.source_errors)
        ? Object.fromEntries(
            Object.entries(data.source_errors).map(([key, value]) => [key, String(value)]),
          )
        : undefined,
      staleDatasets: Array.isArray(data.stale_datasets)
        ? data.stale_datasets.map(String)
        : undefined,
    }
  }
  const snapshot = records(data.snapshots).find(
    (item) => item.dataset === 'aero-im.activity_summary',
  )
  const projected = isRecord(snapshot?.data) ? snapshot.data : {}
  return {
    items: records(projected.events ?? projected.items),
    nextCursor: typeof projected.next_cursor === 'string' ? projected.next_cursor : undefined,
  }
}

export class AeroIdClient {
  private writeEpoch?: string

  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: () => string,
    private readonly fetcher: typeof fetch = window.fetch.bind(window),
  ) {}

  async listDatasets(): Promise<Dataset[]> {
    const data = dataOf(await this.request('GET', '/account-datasets'))
    return records(data.datasets).flatMap((item) => {
      if (typeof item.name !== 'string' || typeof item.source !== 'string') return []
      return [{ name: item.name, source: item.source, pii: item.pii === true }]
    })
  }

  async getSourceHealth(): Promise<SourceHealth[]> {
    const url = this.buildServiceURL('/health/sources')
    const headers = new Headers({
      Accept: 'application/json',
      'X-Request-ID': crypto.randomUUID(),
    })
    const response = await this.performRequest(url, 'GET', headers, undefined)
    const data = dataOf(await this.readResponse(response))
    return records(data.sources).flatMap((item) => {
      if (typeof item.source !== 'string') return []
      const status = item.status === 'ok' ? 'ok' : 'degraded'
      return [
        {
          source: item.source,
          status,
          error: typeof item.error === 'string' ? item.error : undefined,
        },
      ]
    })
  }

  async getMe(): Promise<AccountView> {
    return dataOf(await this.request('GET', '/me')) as AccountView
  }

  async getProfile(): Promise<Profile> {
    return dataOf(await this.request('GET', '/me/profile')) as Profile
  }

  async updateProfile(profile: Partial<Profile>): Promise<Profile> {
    return dataOf(await this.request('PATCH', '/me/profile', { body: profile })) as Profile
  }

  async getOverview(datasets: string[] = []): Promise<AggregateView> {
    return dataOf(
      await this.request('GET', '/me/overview', {
        query: { dataset: datasets, consistency: 'eventual' },
      }),
    ) as AggregateView
  }

  async getData(
    datasets: string[],
    consistency: ConsistencyMode = 'eventual',
    maxAge?: string,
  ): Promise<AggregateView> {
    return dataOf(
      await this.request('GET', '/me/data', {
        query: { dataset: datasets, consistency, max_age: maxAge },
      }),
    ) as AggregateView
  }

  async listSources(cursor?: string): Promise<PageData<JsonRecord>> {
    return pageOf(
      dataOf(await this.request('GET', '/me/sources', { query: { cursor, limit: 50 } })),
      'sources',
    )
  }

  async listMemberships(cursor?: string): Promise<PageData<JsonRecord>> {
    return pageOf(
      dataOf(await this.request('GET', '/me/memberships', { query: { cursor, limit: 50 } })),
      'memberships',
    )
  }

  async listActivity(cursor?: string): Promise<PageData<JsonRecord>> {
    return activityPage(
      dataOf(await this.request('GET', '/me/activity', { query: { cursor, limit: 50 } })),
    )
  }

  async listSyncJobs(cursor?: string): Promise<PageData<JsonRecord>> {
    return pageOf(
      dataOf(await this.request('GET', '/sync/jobs', { query: { cursor, limit: 50 } })),
      'jobs',
    )
  }

  async getSyncJob(id: string): Promise<JsonRecord> {
    return dataOf(await this.request('GET', `/sync/jobs/${encodeURIComponent(id)}`))
  }

  async reconcileSyncJob(id: string): Promise<JsonRecord> {
    return dataOf(await this.request('POST', `/sync/jobs/${encodeURIComponent(id)}/reconcile`))
  }

  async downloadExport(id: string, oneTime = false): Promise<DownloadedFile> {
    const token = this.accessToken().trim()
    if (!token) throw new AeroIdError(401, 'auth.required', '登录状态已失效')
    const url = this.buildURL(`/sync/jobs/${encodeURIComponent(id)}/export/download`, {
      one_time: oneTime ? 'true' : undefined,
    })
    const response = await this.performRequest(url, 'GET', this.buildHeaders(token, {}), undefined)
    if (!response.ok) {
      await this.readResponse(response)
      throw new AeroIdError(response.status, 'request.failed', '下载失败')
    }
    const contentType = response.headers.get('Content-Type')?.split(';', 1)[0].trim()
    if (contentType !== 'application/json') {
      throw new AeroIdError(response.status, 'response.invalid', 'aero-id 返回了无效导出文件')
    }
    const blob = await this.readExport(response)
    return { blob, filename: 'aero-id-export.json' }
  }

  async createSyncJob(datasets: string[]): Promise<JsonRecord> {
    const key = crypto.randomUUID()
    return dataOf(
      await this.request('POST', '/me/sync', {
        idempotencyKey: key,
        body: { datasets, idempotency_key: key },
      }),
    )
  }

  async createExportJob(datasets: string[]): Promise<JsonRecord> {
    const key = crypto.randomUUID()
    return dataOf(
      await this.request('POST', '/me/export', {
        idempotencyKey: key,
        body: { datasets, idempotency_key: key },
      }),
    )
  }

  async createEraseJob(): Promise<JsonRecord> {
    const key = crypto.randomUUID()
    return dataOf(
      await this.request('POST', '/me/erase', {
        idempotencyKey: key,
        body: { idempotency_key: key },
      }),
    )
  }

  async listOperations(cursor?: string): Promise<PageData<JsonRecord>> {
    return pageOf(
      dataOf(await this.request('GET', '/operations', { query: { cursor, limit: 50 } })),
      'operations',
    )
  }

  async getOperation(id: string): Promise<JsonRecord> {
    return dataOf(await this.request('GET', `/operations/${encodeURIComponent(id)}`))
  }

  async reconcileOperation(id: string): Promise<JsonRecord> {
    return dataOf(await this.request('POST', `/operations/${encodeURIComponent(id)}/reconcile`))
  }

  async getOperationTimeline(id: string, cursor?: string): Promise<PageData<JsonRecord>> {
    return pageOf(
      dataOf(
        await this.request('GET', `/audit/operations/${encodeURIComponent(id)}`, {
          query: { cursor, limit: 50 },
        }),
      ),
      'events',
    )
  }

  async listAuditEvents(
    filters: AuditEventFilters = {},
    cursor?: string,
  ): Promise<PageData<JsonRecord>> {
    return pageOf(
      dataOf(
        await this.request('GET', '/audit/events', {
          query: {
            source: filters.source,
            actor_uid: filters.actorUid,
            request_id: filters.requestId,
            tenant_id: filters.tenantId,
            action: filters.action,
            resource_type: filters.resourceType,
            account_id: filters.accountId,
            operation_id: filters.operationId,
            from: filters.from,
            to: filters.to,
            cursor,
            limit: 50,
          },
        }),
      ),
      'events',
    )
  }

  async verifyAuditChain(source: string, partition: string): Promise<JsonRecord> {
    return dataOf(
      await this.request('GET', '/audit/verify', {
        query: { source, partition },
      }),
    )
  }

  private async request(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<unknown> {
    const token = this.accessToken().trim()
    if (!token) throw new AeroIdError(401, 'auth.required', '登录状态已失效')
    const url = this.buildURL(path, options.query)
    const headers = this.buildHeaders(token, options)
    const response = await this.performRequest(url, method, headers, options.body)
    this.writeEpoch = response.headers.get('X-Aero-Write-Epoch') ?? this.writeEpoch
    return this.readResponse(response)
  }

  private buildURL(path: string, query: RequestOptions['query']): URL {
    const url = new URL(`${this.baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`)
    for (const [name, raw] of Object.entries(query ?? {})) {
      if (raw === undefined || raw === '') continue
      for (const value of Array.isArray(raw) ? raw : [raw])
        url.searchParams.append(name, String(value))
    }
    return url
  }

  private buildServiceURL(path: string): URL {
    const normalized = this.baseUrl.replace(/\/+$/, '')
    const serviceBase = normalized.endsWith('/v1') ? normalized.slice(0, -3) : normalized
    return new URL(`${serviceBase}/${path.replace(/^\/+/, '')}`)
  }

  private buildHeaders(token: string, options: RequestOptions): Headers {
    const headers = new Headers({
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Request-ID': crypto.randomUUID(),
    })
    if (options.body !== undefined) headers.set('Content-Type', 'application/json')
    if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey)
    if (this.writeEpoch) headers.set('X-Aero-Write-Epoch', this.writeEpoch)
    return headers
  }

  private async performRequest(
    url: URL,
    method: string,
    headers: Headers,
    body: unknown,
  ): Promise<Response> {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs)
    let response: Response
    try {
      response = await this.fetcher(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'omit',
        signal: controller.signal,
      })
    } catch {
      if (controller.signal.aborted) {
        throw new AeroIdError(0, 'network.timeout', 'aero-id 请求超时')
      }
      throw new AeroIdError(0, 'network.unavailable', '无法连接 aero-id')
    } finally {
      window.clearTimeout(timeout)
    }
    return response
  }

  private async readResponse(response: Response): Promise<unknown> {
    if (response.status === 204) return undefined
    const text = await response.text()
    if (text.length > maxJsonResponseBytes) {
      throw new AeroIdError(response.status, 'response.too_large', 'aero-id 响应过大')
    }
    let payload: unknown
    try {
      payload = text ? JSON.parse(text) : {}
    } catch {
      throw new AeroIdError(response.status, 'response.invalid', 'aero-id 返回了无效响应')
    }
    if (!response.ok) {
      const envelope = isRecord(payload) ? (payload as ErrorEnvelope) : {}
      throw new AeroIdError(
        response.status,
        envelope.error?.code ?? 'request.failed',
        envelope.error?.message ?? '请求失败',
        envelope.error?.request_id ?? response.headers.get('X-Request-ID') ?? undefined,
      )
    }
    return payload
  }

  private async readExport(response: Response): Promise<Blob> {
    const declaredLength = Number(response.headers.get('Content-Length'))
    if (Number.isFinite(declaredLength) && declaredLength > maxExportResponseBytes) {
      throw new AeroIdError(response.status, 'response.too_large', 'aero-id 导出文件过大')
    }
    if (!response.body) {
      const bytes = await response.arrayBuffer()
      if (bytes.byteLength > maxExportResponseBytes) {
        throw new AeroIdError(response.status, 'response.too_large', 'aero-id 导出文件过大')
      }
      return new Blob([bytes], { type: 'application/json' })
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxExportResponseBytes) {
        await reader.cancel()
        throw new AeroIdError(response.status, 'response.too_large', 'aero-id 导出文件过大')
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return new Blob([bytes.buffer], { type: 'application/json' })
  }
}
