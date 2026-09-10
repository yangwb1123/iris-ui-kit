import * as React from 'react'
import { IrisAlert, IrisBadge, IrisCard } from '@iris-ui-kit/react'
import type { AeroIdClient } from '../api/aeroId'
import { PageHeader } from '../components/PageHeader'
import { PageError, PageLoading, PageMore } from '../components/PageState'
import { RecordTable } from '../components/RecordTable'
import { useCursorResource } from '../hooks/useCursorResource'

export function ActivityPage({ client }: { client: AeroIdClient }): React.ReactElement {
  const load = React.useCallback(() => client.listActivity(), [client])
  const resource = useCursorResource(load)
  if (resource.loading) return <PageLoading />
  if (resource.error) return <PageError error={resource.error} retry={resource.reload} />
  const page = resource.data!
  return (
    <section>
      <PageHeader title="近期活动" description="来自本地脱敏活动投影，不读取消息正文或文件内容。" />
      {page.partial ? (
        <IrisAlert tone="warning" title="活动投影不完整">
          部分来源暂不可用；已返回的活动仍会保留，缺失来源不会被解释为空数据。
        </IrisAlert>
      ) : null}
      {page.staleDatasets?.length ? (
        <IrisAlert tone="warning" title="活动投影已过期">
          {page.staleDatasets.join('、')}
        </IrisAlert>
      ) : null}
      {Object.keys(page.sourceErrors ?? {}).length || page.generatedAt ? (
        <IrisCard variant="outline" header="投影新鲜度">
          {page.generatedAt ? (
            <div className="status-row">
              <span>生成时间</span>
              <span>{new Date(page.generatedAt).toLocaleString()}</span>
            </div>
          ) : null}
          {Object.entries(page.sourceErrors ?? {}).map(([source, error]) => (
            <div className="status-row" key={source}>
              <span>{source}</span>
              <IrisBadge tone="danger">{error}</IrisBadge>
            </div>
          ))}
        </IrisCard>
      ) : null}
      <IrisCard variant="outline">
        <RecordTable
          records={page.items}
          columns={[
            { key: 'occurred_at', label: '时间', aliases: ['created_at'], kind: 'date' },
            { key: 'source', label: '来源', aliases: ['source_system'] },
            { key: 'event_type', label: '事件', aliases: ['type', 'action'] },
            { key: 'status', label: '状态', aliases: ['outcome'], kind: 'status' },
            { key: 'operation_id', label: '操作 ID' },
          ]}
          empty="暂无近期活动"
        />
        <PageMore
          available={Boolean(page.nextCursor)}
          loading={resource.loadingMore}
          error={resource.loadMoreError}
          load={resource.loadMore}
        />
      </IrisCard>
    </section>
  )
}
