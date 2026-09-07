import * as React from 'react'
import { IrisAlert, IrisBadge, IrisButton, IrisCard } from '@iris-ui-kit/react'
import type { AeroIdClient } from '../api/aeroId'
import { PageError, PageLoading } from '../components/PageState'
import { PageHeader } from '../components/PageHeader'
import { useAsyncResource } from '../hooks/useAsyncResource'
import type { AccountView, AggregateView, Dataset, SourceHealth } from '../types'
import { ProjectionSyncAlert, useOverviewProjectionSync } from './OverviewProjectionSync'
import { staleAllowListedDatasets } from './overviewSync'

function SourceHealthCard({
  sources,
  error,
}: {
  sources: SourceHealth[]
  error?: Error
}): React.ReactElement {
  return (
    <IrisCard variant="outline" header="来源连接器">
      {error ? (
        <IrisAlert tone="warning" title="健康状态暂不可用">
          {error.message}
        </IrisAlert>
      ) : null}
      {sources.map((source) => (
        <div className="status-row" key={source.source}>
          <span>{source.source}</span>
          <IrisBadge tone={source.status === 'ok' ? 'success' : 'danger'}>
            {source.status === 'ok' ? '可用' : source.error || '不可用'}
          </IrisBadge>
        </div>
      ))}
      {!error && sources.length === 0 ? (
        <span className="muted">服务未配置来源连接器。</span>
      ) : null}
    </IrisCard>
  )
}

function overviewMetrics(me: AccountView, datasets: Dataset[], overview: AggregateView) {
  return [
    ['来源账户', me.sources?.length ?? 0],
    ['成员关系', me.memberships?.length ?? 0],
    ['可用数据集', datasets.length],
    ['聚合快照', overview.snapshots?.length ?? 0],
  ] as const
}

export function OverviewPage({ client }: { client: AeroIdClient }): React.ReactElement {
  const load = React.useCallback(async () => {
    const [me, datasets, overview, sourceHealth] = await Promise.all([
      client.getMe(),
      client.listDatasets(),
      client.getOverview(),
      client.getSourceHealth().then(
        (sources) => ({ sources, error: undefined }),
        (reason: unknown) => ({
          sources: [],
          error: reason instanceof Error ? reason : new Error('来源健康状态读取失败'),
        }),
      ),
    ])
    return { me, datasets, overview, sourceHealth }
  }, [client])
  const resource = useAsyncResource(load)
  const staleDatasets = resource.data
    ? staleAllowListedDatasets(resource.data.overview, resource.data.datasets)
    : []
  const projectionSync = useOverviewProjectionSync(client, staleDatasets, resource.reload)
  if (resource.loading) return <PageLoading />
  if (resource.error) return <PageError error={resource.error} retry={resource.reload} />
  const { me, datasets, overview, sourceHealth } = resource.data!
  const metrics = overviewMetrics(me, datasets, overview)
  return (
    <section>
      <PageHeader
        title="账户概览"
        description="本地区域聚合投影及其来源新鲜度。"
        actions={
          staleDatasets.length > 0 ? (
            <IrisButton
              loading={projectionSync.syncing}
              onClick={() => void projectionSync.refresh()}
            >
              刷新过期投影（{staleDatasets.length}）
            </IrisButton>
          ) : undefined
        }
      />
      {overview.partial ? (
        <IrisAlert tone="warning" title="聚合结果不完整">
          部分来源暂时不可用；页面保留了其余来源结果，不会把缺失数据解释为空数据。
        </IrisAlert>
      ) : null}
      <ProjectionSyncAlert job={projectionSync.job} error={projectionSync.error} />
      <div className="metric-grid">
        {metrics.map(([label, value]) => (
          <IrisCard key={label} variant="outline">
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value}</div>
          </IrisCard>
        ))}
      </div>
      <IrisCard variant="outline" header="投影状态">
        <div className="status-row">
          <span>一致性</span>
          <IrisBadge tone="primary">{overview.consistency ?? 'eventual'}</IrisBadge>
        </div>
        <div className="status-row">
          <span>过期数据集</span>
          <span>{overview.stale_datasets?.join('、') || '无'}</span>
        </div>
        {Object.entries(overview.source_errors ?? {}).map(([source, message]) => (
          <div className="status-row" key={source}>
            <span>{source}</span>
            <IrisBadge tone="danger">{message}</IrisBadge>
          </div>
        ))}
      </IrisCard>
      <SourceHealthCard sources={sourceHealth.sources} error={sourceHealth.error} />
    </section>
  )
}
