import * as React from 'react'
import { IrisAlert, IrisBadge, IrisButton, IrisCard, IrisInput } from '@iris-ui-kit/react'
import type { AeroIdClient, AuditEventFilters } from '../api/aeroId'
import { PageHeader } from '../components/PageHeader'
import { PageError, PageLoading, PageMore } from '../components/PageState'
import { RecordTable } from '../components/RecordTable'
import { useCursorResource } from '../hooks/useCursorResource'
import type { JsonRecord } from '../types'

interface AuditFilterDraft {
  operationId: string
  requestId: string
  source: string
  action: string
  from: string
  to: string
}

const emptyFilters: AuditFilterDraft = {
  operationId: '',
  requestId: '',
  source: '',
  action: '',
  from: '',
  to: '',
}

function optional(value: string): string | undefined {
  return value.trim() || undefined
}

function toIso(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function appliedFilters(draft: AuditFilterDraft): AuditEventFilters {
  return {
    operationId: optional(draft.operationId),
    requestId: optional(draft.requestId),
    source: optional(draft.source),
    action: optional(draft.action),
    from: toIso(draft.from),
    to: toIso(draft.to),
  }
}

export function AuditPage({ client }: { client: AeroIdClient }): React.ReactElement {
  const [draft, setDraft] = React.useState<AuditFilterDraft>(emptyFilters)
  const [filters, setFilters] = React.useState<AuditEventFilters>({})
  const load = React.useCallback(
    (cursor?: string) => client.listAuditEvents(filters, cursor),
    [client, filters],
  )
  const resource = useCursorResource(load)
  const [selectedEvent, setSelectedEvent] = React.useState<JsonRecord>()
  const [verifying, setVerifying] = React.useState<string>()
  const [verification, setVerification] = React.useState<JsonRecord>()
  const [verifyError, setVerifyError] = React.useState<Error>()

  const update = (field: keyof AuditFilterDraft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }))

  const verify = async (event: JsonRecord) => {
    const source = String(event.source ?? '')
    const partition = String(event.partition_key ?? '')
    if (!source || !partition) return
    const key = `${source}:${partition}`
    setVerifying(key)
    setVerification(undefined)
    setVerifyError(undefined)
    try {
      setVerification(await client.verifyAuditChain(source, partition))
    } catch (reason) {
      setVerifyError(reason instanceof Error ? reason : new Error('审计链校验失败'))
    } finally {
      setVerifying(undefined)
    }
  }

  if (resource.loading) return <PageLoading />
  if (resource.error) return <PageError error={resource.error} retry={resource.reload} />

  return (
    <section>
      <PageHeader
        title="审计查询"
        description="查询 Audit Governance 写入 aero-id 的脱敏、追加式审计事实，并按来源分区校验哈希链。"
      />
      <IrisAlert tone="info" title="只读治理视图">
        载荷已由服务端脱敏；链校验以服务端持久记录为准，本页面不提供重放、保全或导出写操作。
      </IrisAlert>
      <IrisCard variant="outline" header="筛选条件">
        <form
          className="audit-filter-form"
          onSubmit={(event) => {
            event.preventDefault()
            setSelectedEvent(undefined)
            setVerification(undefined)
            setVerifyError(undefined)
            setFilters(appliedFilters(draft))
          }}
        >
          <label className="form-row">
            <span>Operation ID</span>
            <IrisInput
              value={draft.operationId}
              placeholder="精确匹配"
              onChange={(event) => update('operationId', event.target.value)}
            />
          </label>
          <label className="form-row">
            <span>Request ID</span>
            <IrisInput
              value={draft.requestId}
              placeholder="精确匹配"
              onChange={(event) => update('requestId', event.target.value)}
            />
          </label>
          <label className="form-row">
            <span>来源</span>
            <IrisInput
              value={draft.source}
              placeholder="例如 aero-id"
              onChange={(event) => update('source', event.target.value)}
            />
          </label>
          <label className="form-row">
            <span>动作</span>
            <IrisInput
              value={draft.action}
              placeholder="例如 operation.created"
              onChange={(event) => update('action', event.target.value)}
            />
          </label>
          <label className="form-row">
            <span>开始时间</span>
            <input
              type="datetime-local"
              value={draft.from}
              onChange={(event) => update('from', event.target.value)}
            />
          </label>
          <label className="form-row">
            <span>结束时间</span>
            <input
              type="datetime-local"
              value={draft.to}
              onChange={(event) => update('to', event.target.value)}
            />
          </label>
          <div className="form-actions audit-filter-actions">
            <IrisButton type="submit">应用筛选</IrisButton>
            <IrisButton
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(emptyFilters)
                setFilters({})
                setSelectedEvent(undefined)
                setVerification(undefined)
                setVerifyError(undefined)
              }}
            >
              清除
            </IrisButton>
          </div>
        </form>
      </IrisCard>
      {verifyError ? (
        <IrisAlert tone="danger" title="审计链校验失败">
          {verifyError.message}
        </IrisAlert>
      ) : null}
      {verification ? (
        <IrisAlert tone="success" title="审计链校验通过">
          {String(verification.source ?? '未知来源')} /{' '}
          {String(verification.partition ?? '未知分区')}
        </IrisAlert>
      ) : null}
      <IrisCard variant="outline" header="脱敏审计事实">
        <RecordTable
          records={resource.data!.items}
          columns={[
            { key: 'occurred_at', label: '时间', kind: 'date' },
            { key: 'action', label: '动作' },
            { key: 'source', label: '来源' },
            { key: 'partition_key', label: '分区' },
            { key: 'actor_uid', label: '操作者' },
            { key: 'resource_type', label: '资源类型' },
            { key: 'resource_id', label: '资源 ID' },
            { key: 'operation_id', label: 'Operation ID' },
            { key: 'request_id', label: 'Request ID' },
            { key: 'chain_sequence', label: '链序号' },
          ]}
          empty="当前条件下没有审计事实"
          actions={{
            render: (event) => {
              const source = String(event.source ?? '')
              const partition = String(event.partition_key ?? '')
              const key = `${source}:${partition}`
              return (
                <div className="table-actions">
                  <IrisButton size="sm" variant="ghost" onClick={() => setSelectedEvent(event)}>
                    详情
                  </IrisButton>
                  <IrisButton
                    size="sm"
                    variant="outline"
                    disabled={!source || !partition}
                    loading={verifying === key}
                    onClick={() => void verify(event)}
                  >
                    校验链
                  </IrisButton>
                </div>
              )
            },
          }}
        />
        <PageMore
          available={Boolean(resource.data!.nextCursor)}
          loading={resource.loadingMore}
          error={resource.loadMoreError}
          load={resource.loadMore}
        />
      </IrisCard>
      {selectedEvent ? (
        <IrisCard
          variant="outline"
          header={
            <span className="card-header-row">
              <span>审计事实详情</span>
              <IrisBadge tone="neutral">服务端脱敏</IrisBadge>
            </span>
          }
        >
          <pre className="json-viewer">{JSON.stringify(selectedEvent, null, 2)}</pre>
        </IrisCard>
      ) : null}
    </section>
  )
}
