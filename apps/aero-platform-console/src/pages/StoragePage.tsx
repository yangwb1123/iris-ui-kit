import * as React from 'react'
import { IrisAlert, IrisButton, IrisCard } from '@iris-ui-kit/react'
import type { AeroIdClient } from '../api/aeroId'
import { PageHeader } from '../components/PageHeader'
import { PageError, PageLoading } from '../components/PageState'
import { RecordTable } from '../components/RecordTable'
import type { PlatformConfig } from '../config'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { ProjectionSyncAlert, useOverviewProjectionSync } from './OverviewProjectionSync'
import {
  formatBytes,
  storageDatasets,
  storageProjection,
  type StorageProjection,
  usagePercent,
} from './storageProjection'

function StorageProjectionAlerts({ projection }: { projection: StorageProjection }) {
  const stale = projection.view.stale_datasets?.filter((dataset) =>
    storageDatasets.includes(dataset as (typeof storageDatasets)[number]),
  )
  const unavailable = projection.snapshots.filter((snapshot) => snapshot.status === 'unavailable')
  return (
    <>
      {projection.view.partial ? (
        <IrisAlert tone="warning" title="存储投影不完整">
          Aero ID 已保留可用快照；来源故障不会被解释为零用量或空桶列表。
        </IrisAlert>
      ) : null}
      {stale?.length ? (
        <IrisAlert tone="warning" title="存储投影已过期">
          过期数据集：{stale.join('、')}。可以手动同步，unknown 状态需要前往任务页对账。
        </IrisAlert>
      ) : null}
      {unavailable.length ? (
        <IrisAlert tone="danger" title="部分 Aero Vault 数据不可用">
          当前保留上一次可用数据；请检查平台服务健康状态后重试。
        </IrisAlert>
      ) : null}
    </>
  )
}

export function StoragePage({
  client,
  config,
}: {
  client: AeroIdClient
  config: PlatformConfig
}): React.ReactElement {
  const load = React.useCallback(
    async () => storageProjection(await client.getData([...storageDatasets])),
    [client],
  )
  const resource = useAsyncResource(load)
  const synchronization = useOverviewProjectionSync(client, [...storageDatasets], resource.reload)
  if (resource.loading) return <PageLoading />
  if (resource.error) return <PageError error={resource.error} retry={resource.reload} />
  const projection = resource.data!
  const quotaPercent = usagePercent(projection.usage.usedBytes, projection.usage.maxBytes)
  const objectPercent = usagePercent(projection.usage.usedObjects, projection.usage.maxObjects)

  return (
    <section>
      <PageHeader
        title="文件与存储"
        description="来自 Aero Vault 的只读租户、桶和用量投影；文件内容与写操作不进入账户系统。"
        actions={
          <>
            <IrisButton
              loading={synchronization.syncing}
              onClick={() => void synchronization.refresh()}
            >
              同步存储投影
            </IrisButton>
            {config.aeroVaultConsoleUrl ? (
              <IrisButton asChild variant="outline">
                <a href={config.aeroVaultConsoleUrl}>在 Aero Vault 中管理</a>
              </IrisButton>
            ) : null}
          </>
        }
      />
      <ProjectionSyncAlert job={synchronization.job} error={synchronization.error} />
      <StorageProjectionAlerts projection={projection} />
      <div className="metric-grid">
        <IrisCard variant="outline" header="已用容量">
          <div className="metric-value">{formatBytes(projection.usage.usedBytes)}</div>
          <div className="metric-label">
            {projection.usage.maxBytes === undefined
              ? '容量配额未提供'
              : projection.usage.maxBytes > 0
                ? `配额 ${formatBytes(projection.usage.maxBytes)} · ${quotaPercent ?? 0}%`
                : '未设置容量配额'}
          </div>
        </IrisCard>
        <IrisCard variant="outline" header="对象数量">
          <div className="metric-value">
            {projection.usage.usedObjects?.toLocaleString() ?? '未提供'}
          </div>
          <div className="metric-label">
            {projection.usage.maxObjects === undefined
              ? '对象数配额未提供'
              : projection.usage.maxObjects > 0
                ? `配额 ${projection.usage.maxObjects?.toLocaleString()} · ${objectPercent ?? 0}%`
                : '未设置对象数配额'}
          </div>
        </IrisCard>
        <IrisCard variant="outline" header="存储桶">
          <div className="metric-value">{projection.buckets.length}</div>
          <div className="metric-label">仅显示 Aero Vault 返回的桶名称</div>
        </IrisCard>
        <IrisCard variant="outline" header="来源区域">
          <div className="metric-value metric-value-text">
            {projection.sourceRegions.join('、') || '未提供'}
          </div>
          <div className="metric-label">由 Aero ID 投影元数据提供</div>
        </IrisCard>
      </div>
      <IrisCard variant="outline" header="租户">
        <RecordTable
          records={projection.tenants}
          columns={[
            { key: 'id', label: '租户 ID', aliases: ['tenant_id'] },
            { key: 'status', label: '状态', kind: 'status' },
          ]}
          empty="暂无 Aero Vault 租户投影"
        />
      </IrisCard>
      <IrisCard variant="outline" header="存储桶">
        <RecordTable
          records={projection.buckets}
          columns={[
            { key: 'name', label: '桶名称', aliases: ['bucket', 'id'] },
            { key: 'versioning', label: '版本控制' },
            { key: 'status', label: '状态', kind: 'status' },
          ]}
          empty="暂无 Aero Vault 存储桶"
        />
      </IrisCard>
      <IrisCard variant="outline" header="投影状态">
        <RecordTable
          records={projection.snapshots}
          columns={[
            { key: 'dataset', label: '数据集' },
            { key: 'status', label: '状态', kind: 'status' },
            { key: 'version', label: '版本' },
            { key: 'source_region', label: '来源区域' },
            { key: 'last_synced_at', label: '同步时间', kind: 'date' },
          ]}
          empty="暂无存储投影状态"
        />
      </IrisCard>
      <IrisAlert tone="info" title="存储权威边界">
        上传、下载、删除、共享与保留策略全部由 Aero Vault 执行；本页面不会把 Aero ID access token
        转发给 Aero Vault。
      </IrisAlert>
    </section>
  )
}
