import * as React from 'react'
import { IrisCard } from '@iris-ui-kit/react'
import type { AeroIdClient } from '../api/aeroId'
import { PageHeader } from '../components/PageHeader'
import { PageError, PageLoading, PageMore } from '../components/PageState'
import { RecordTable } from '../components/RecordTable'
import { useCursorResource } from '../hooks/useCursorResource'

export function ConnectionsPage({ client }: { client: AeroIdClient }): React.ReactElement {
  const loadSources = React.useCallback((cursor?: string) => client.listSources(cursor), [client])
  const loadMemberships = React.useCallback(
    (cursor?: string) => client.listMemberships(cursor),
    [client],
  )
  const sources = useCursorResource(loadSources)
  const memberships = useCursorResource(loadMemberships)
  if (sources.loading || memberships.loading) return <PageLoading />
  if (sources.error) return <PageError error={sources.error} retry={sources.reload} />
  if (memberships.error) return <PageError error={memberships.error} retry={memberships.reload} />
  return (
    <section>
      <PageHeader
        title="来源与成员关系"
        description="保留 Aero IM、Aero Vault 和 Snaplink 的原生引用，不把不同作用域折叠成一个 tenant_id。"
      />
      <IrisCard variant="outline" header="来源账户">
        <RecordTable
          records={sources.data!.items}
          columns={[
            { key: 'source', label: '来源', aliases: ['source_system'] },
            { key: 'source_account_id', label: '来源账户', aliases: ['external_id', 'subject'] },
            { key: 'status', label: '状态', kind: 'status' },
            { key: 'source_region', label: '区域', aliases: ['region'] },
            { key: 'last_synced_at', label: '最后同步', kind: 'date' },
          ]}
          empty="尚未关联来源账户"
        />
        <PageMore
          available={Boolean(sources.data!.nextCursor)}
          loading={sources.loadingMore}
          error={sources.loadMoreError}
          load={sources.loadMore}
        />
      </IrisCard>
      <IrisCard variant="outline" header="成员关系">
        <RecordTable
          records={memberships.data!.items}
          columns={[
            { key: 'source', label: '来源' },
            { key: 'scope_type', label: '作用域类型' },
            { key: 'scope_id', label: '作用域 ID' },
            { key: 'role', label: '角色', aliases: ['membership_role'] },
            { key: 'status', label: '状态', kind: 'status' },
          ]}
          empty="暂无成员关系"
        />
        <PageMore
          available={Boolean(memberships.data!.nextCursor)}
          loading={memberships.loadingMore}
          error={memberships.loadMoreError}
          load={memberships.loadMore}
        />
      </IrisCard>
    </section>
  )
}
