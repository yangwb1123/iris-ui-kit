import * as React from 'react'
import { IrisAlert, IrisBadge, IrisButton, IrisCard } from '@iris-ui-kit/react'
import type { AeroIdClient } from '../api/aeroId'
import { PageHeader } from '../components/PageHeader'
import { PageError, PageLoading } from '../components/PageState'
import { RecordTable } from '../components/RecordTable'
import type { PlatformConfig } from '../config'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { ProjectionSyncAlert, useOverviewProjectionSync } from './OverviewProjectionSync'
import {
  notificationProjection,
  notificationsDataset,
  type NotificationProjection,
} from './notificationsProjection'

function NotificationProjectionAlerts({
  projection,
}: {
  projection: NotificationProjection
}): React.ReactElement {
  return (
    <>
      {projection.sourceAccountStatus === 'not_found' ? (
        <IrisAlert tone="info" title="尚未关联 Aero IM 账户">
          请先使用同一 Snaplink 身份进入 Aero IM 完成首次账户关联，然后重新同步通知投影。
        </IrisAlert>
      ) : null}
      {projection.view.partial ? (
        <IrisAlert tone="warning" title="通知投影不完整">
          Aero ID 已保留可用数据，不会把来源故障解释为通知为空。
        </IrisAlert>
      ) : null}
      {projection.view.stale_datasets?.includes(notificationsDataset) ? (
        <IrisAlert tone="warning" title="通知投影已过期">
          可手动同步该投影；同步结果为 unknown 时必须前往任务页对账。
        </IrisAlert>
      ) : null}
      {projection.truncated ? (
        <IrisAlert tone="info" title="仅显示最新通知">
          该只读投影有界为最新 50 条；完整收件箱请进入 Aero IM。
        </IrisAlert>
      ) : null}
    </>
  )
}

export function NotificationsPage({
  client,
  config,
}: {
  client: AeroIdClient
  config: PlatformConfig
}): React.ReactElement {
  const load = React.useCallback(
    async () => notificationProjection(await client.getData([notificationsDataset])),
    [client],
  )
  const resource = useAsyncResource(load)
  const synchronization = useOverviewProjectionSync(client, [notificationsDataset], resource.reload)
  if (resource.loading) return <PageLoading />
  if (resource.error) return <PageError error={resource.error} retry={resource.reload} />
  const projection = resource.data!
  const snapshotStatus = String(projection.snapshot?.status ?? 'unknown')
  const sourceRegion = String(projection.snapshot?.source_region ?? '未提供')

  return (
    <section>
      <PageHeader
        title="消息通知"
        description="来自 Aero IM 权威收件箱的无正文投影；账户控制台不复制通知写状态。"
        actions={
          <>
            <IrisButton
              loading={synchronization.syncing}
              onClick={() => void synchronization.refresh()}
            >
              同步通知投影
            </IrisButton>
            {config.aeroImConsoleUrl ? (
              <IrisButton asChild variant="outline">
                <a href={config.aeroImConsoleUrl}>在 Aero IM 中处理</a>
              </IrisButton>
            ) : null}
          </>
        }
      />
      <ProjectionSyncAlert job={synchronization.job} error={synchronization.error} />
      <NotificationProjectionAlerts projection={projection} />
      <IrisCard variant="outline" header="投影状态">
        <div className="status-row">
          <span>未读通知</span>
          <IrisBadge tone={projection.unreadCount > 0 ? 'warning' : 'success'}>
            {projection.unreadCount}
          </IrisBadge>
        </div>
        <div className="status-row">
          <span>状态</span>
          <IrisBadge tone={snapshotStatus === 'fresh' ? 'success' : 'warning'}>
            {snapshotStatus}
          </IrisBadge>
        </div>
        <div className="status-row">
          <span>来源区域</span>
          <span>{sourceRegion}</span>
        </div>
        <div className="status-row">
          <span>Aero IM 账户</span>
          <IrisBadge tone={projection.sourceAccountStatus === 'active' ? 'success' : 'warning'}>
            {projection.sourceAccountStatus}
          </IrisBadge>
        </div>
      </IrisCard>
      <IrisCard variant="outline">
        <RecordTable
          records={projection.items}
          columns={[
            { key: 'notification_id', label: '通知 ID', aliases: ['id'] },
            { key: 'kind', label: '类型' },
            { key: 'room_id', label: '房间 ID' },
            { key: 'message_id', label: '消息 ID' },
            { key: 'actor_id', label: '触发者 ID' },
            { key: 'importance_score', label: '重要度' },
            { key: 'aggregate_count', label: '聚合数' },
            { key: 'created_at', label: '创建时间', kind: 'date' },
            { key: 'read_at', label: '读取时间', kind: 'date' },
          ]}
          empty="暂无 Aero IM 通知投影"
        />
      </IrisCard>
    </section>
  )
}
