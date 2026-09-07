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
  identitySecurityDatasets,
  identitySecurityProjection,
  type IdentitySecurityProjection,
} from './identitySecurityProjection'

function SecurityProjectionAlerts({ projection }: { projection: IdentitySecurityProjection }) {
  const stale = projection.view.stale_datasets?.filter((dataset) =>
    identitySecurityDatasets.includes(dataset as (typeof identitySecurityDatasets)[number]),
  )
  return (
    <>
      {projection.sourceAccountStatus === 'not_found' ? (
        <IrisAlert tone="danger" title="Snaplink 身份不存在">
          当前聚合账户没有对应 Snaplink 身份；请勿在 Aero ID 中创建替代登录账户。
        </IrisAlert>
      ) : null}
      {projection.view.partial ? (
        <IrisAlert tone="warning" title="身份安全投影不完整">
          已保留可用快照；来源故障不会被解释为没有角色、权限或安全策略。
        </IrisAlert>
      ) : null}
      {stale?.length ? (
        <IrisAlert tone="warning" title="身份安全投影已过期">
          过期数据集：{stale.join('、')}。同步结果为 unknown 时必须前往任务页对账。
        </IrisAlert>
      ) : null}
    </>
  )
}

function value(value: unknown): string {
  return typeof value === 'string' && value ? value : '未提供'
}

export function SecurityPage({
  client,
  config,
}: {
  client: AeroIdClient
  config: PlatformConfig
}): React.ReactElement {
  const load = React.useCallback(
    async () => identitySecurityProjection(await client.getData([...identitySecurityDatasets])),
    [client],
  )
  const resource = useAsyncResource(load)
  const synchronization = useOverviewProjectionSync(
    client,
    [...identitySecurityDatasets],
    resource.reload,
  )
  if (resource.loading) return <PageLoading />
  if (resource.error) return <PageError error={resource.error} retry={resource.reload} />
  const projection = resource.data!

  return (
    <section>
      <PageHeader
        title="身份与安全"
        description="来自 Snaplink 的只读身份、安全状态、租户及授权投影；认证权威始终是 Snaplink。"
        actions={
          <>
            <IrisButton
              loading={synchronization.syncing}
              onClick={() => void synchronization.refresh()}
            >
              同步身份投影
            </IrisButton>
            {config.snaplinkConsoleUrl ? (
              <IrisButton asChild variant="outline">
                <a href={config.snaplinkConsoleUrl}>在 Snaplink 中管理</a>
              </IrisButton>
            ) : null}
          </>
        }
      />
      <ProjectionSyncAlert job={synchronization.job} error={synchronization.error} />
      <SecurityProjectionAlerts projection={projection} />
      <div className="metric-grid">
        <IrisCard variant="outline" header="账户状态">
          <div className="metric-value metric-value-text">
            <IrisBadge tone={projection.sourceAccountStatus === 'active' ? 'success' : 'warning'}>
              {projection.sourceAccountStatus}
            </IrisBadge>
          </div>
          <div className="metric-label">来自 snaplink.security</div>
        </IrisCard>
        <IrisCard variant="outline" header="角色">
          <div className="metric-value">{projection.roles.length}</div>
          <div className="metric-label">仅展示 Snaplink 返回的角色代码</div>
        </IrisCard>
        <IrisCard variant="outline" header="权限">
          <div className="metric-value">{projection.permissions.length}</div>
          <div className="metric-label">不在账户系统重新计算授权</div>
        </IrisCard>
        <IrisCard variant="outline" header="来源区域">
          <div className="metric-value metric-value-text">
            {projection.sourceRegions.join('、') || '未提供'}
          </div>
          <div className="metric-label">由 Aero ID 投影元数据提供</div>
        </IrisCard>
      </div>
      <IrisCard variant="outline" header="Snaplink 身份">
        <div className="status-row">
          <span>用户名</span>
          <span>{value(projection.identity.username)}</span>
        </div>
        <div className="status-row">
          <span>邮箱</span>
          <span>{value(projection.identity.email)}</span>
        </div>
        <div className="status-row">
          <span>姓名</span>
          <span>{value(projection.identity.name)}</span>
        </div>
        <div className="status-row">
          <span>显示名称</span>
          <span>{value(projection.identity.display_name)}</span>
        </div>
      </IrisCard>
      <IrisCard variant="outline" header="租户">
        <RecordTable
          records={projection.tenants}
          columns={[
            { key: 'tenant_id', label: '租户 ID', aliases: ['id'] },
            { key: 'name', label: '名称' },
            { key: 'role', label: '角色' },
            { key: 'status', label: '状态', kind: 'status' },
          ]}
          empty="Snaplink 未返回租户明细"
        />
      </IrisCard>
      <IrisCard variant="outline" header="角色与权限">
        <RecordTable
          records={[...projection.roles, ...projection.permissions]}
          columns={[
            { key: 'role', label: '角色', aliases: ['name'] },
            { key: 'permission', label: '权限', aliases: ['code'] },
            { key: 'status', label: '状态', kind: 'status' },
          ]}
          empty="Snaplink 未返回角色或权限明细"
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
          empty="暂无身份安全投影状态"
        />
      </IrisCard>
      <IrisAlert tone="info" title="认证与授权边界">
        密码、MFA、会话、身份验证和角色变更全部由 Snaplink 执行；本页面不会显示密钥、令牌或
        通用未知字段，也不会把 Aero ID access token 转发给 Snaplink 管理 API。
      </IrisAlert>
    </section>
  )
}
