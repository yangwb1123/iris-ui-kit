import * as React from 'react'
import { IrisAlert, IrisBadge, IrisButton, IrisCard, IrisInput } from '@iris-ui-kit/react'
import type { AeroIdClient } from '../api/aeroId'
import { PageHeader } from '../components/PageHeader'
import { PageError, PageLoading } from '../components/PageState'
import { RecordTable } from '../components/RecordTable'
import { useAsyncResource } from '../hooks/useAsyncResource'
import type { AggregateView, ConsistencyMode, JsonRecord } from '../types'

const consistencyOptions: Array<[ConsistencyMode, string]> = [
  ['eventual', '本地投影（eventual）'],
  ['bounded', '有界刷新（bounded）'],
  ['strong', '强制刷新（strong）'],
]

export function DataPage({ client }: { client: AeroIdClient }): React.ReactElement {
  const loadDatasets = React.useCallback(() => client.listDatasets(), [client])
  const datasets = useAsyncResource(loadDatasets)
  const [dataset, setDataset] = React.useState('')
  const [consistency, setConsistency] = React.useState<ConsistencyMode>('eventual')
  const [maxAge, setMaxAge] = React.useState('5m')
  const [result, setResult] = React.useState<AggregateView>()
  const [selectedSnapshot, setSelectedSnapshot] = React.useState<JsonRecord>()
  const [querying, setQuerying] = React.useState(false)
  const [queryError, setQueryError] = React.useState<Error>()

  React.useEffect(() => {
    if (!dataset && datasets.data?.[0]) setDataset(datasets.data[0].name)
  }, [dataset, datasets.data])

  if (datasets.loading) return <PageLoading />
  if (datasets.error) return <PageError error={datasets.error} retry={datasets.reload} />

  const query = async () => {
    if (!dataset) return
    setQuerying(true)
    setQueryError(undefined)
    setSelectedSnapshot(undefined)
    try {
      setResult(await client.getData([dataset], consistency, maxAge.trim() || undefined))
    } catch (reason) {
      setQueryError(reason instanceof Error ? reason : new Error('数据投影读取失败'))
    } finally {
      setQuerying(false)
    }
  }

  return (
    <section>
      <PageHeader
        title="数据投影"
        description="只查询 aero-id 返回的 allow-list 数据集，并显示来源区域、新鲜度和降级状态。"
      />
      {consistency !== 'eventual' ? (
        <IrisAlert tone="warning" title="该查询可能访问来源系统">
          bounded/strong 会在有界 deadline 内刷新来源，但不提供跨来源事务一致性。
        </IrisAlert>
      ) : null}
      {queryError ? <IrisAlert tone="danger">{queryError.message}</IrisAlert> : null}
      <IrisCard variant="outline" header="查询条件">
        <form
          className="projection-form"
          onSubmit={(event) => {
            event.preventDefault()
            void query()
          }}
        >
          <label className="form-row">
            <span>数据集</span>
            <select value={dataset} onChange={(event) => setDataset(event.target.value)}>
              {datasets.data!.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name} · {item.source}
                  {item.pii ? ' · PII' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="form-row">
            <span>一致性</span>
            <select
              value={consistency}
              onChange={(event) => setConsistency(event.target.value as ConsistencyMode)}
            >
              {consistencyOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-row">
            <span>最大数据年龄</span>
            <IrisInput
              value={maxAge}
              placeholder="例如 5m；留空使用服务默认值"
              onChange={(event) => setMaxAge(event.target.value)}
            />
          </label>
          <div className="form-actions">
            <IrisButton type="submit" loading={querying} disabled={!dataset}>
              查询投影
            </IrisButton>
          </div>
        </form>
      </IrisCard>
      {result ? (
        <>
          {result.partial ? (
            <IrisAlert tone="warning" title="聚合结果不完整">
              部分来源不可用；已返回的数据仍被保留。
            </IrisAlert>
          ) : null}
          <IrisCard variant="outline" header="查询结果">
            <div className="status-row">
              <span>一致性</span>
              <IrisBadge tone="primary">{result.consistency ?? consistency}</IrisBadge>
            </div>
            <div className="status-row">
              <span>生成时间</span>
              <span>
                {result.generated_at
                  ? new Date(result.generated_at).toLocaleString()
                  : '服务未返回'}
              </span>
            </div>
            <div className="status-row">
              <span>过期数据集</span>
              <span>{result.stale_datasets?.join('、') || '无'}</span>
            </div>
            {Object.entries(result.source_errors ?? {}).map(([source, error]) => (
              <div className="status-row" key={source}>
                <span>{source}</span>
                <IrisBadge tone="danger">{error}</IrisBadge>
              </div>
            ))}
          </IrisCard>
          <IrisCard variant="outline" header="数据快照">
            <RecordTable
              records={result.snapshots ?? []}
              columns={[
                { key: 'dataset', label: '数据集' },
                { key: 'source', label: '来源' },
                { key: 'source_region', label: '来源区域' },
                { key: 'status', label: '状态', kind: 'status' },
                { key: 'version', label: '版本' },
                { key: 'last_synced_at', label: '最后同步', kind: 'date' },
                { key: 'expires_at', label: '过期时间', kind: 'date' },
              ]}
              empty="该数据集暂无投影"
              actions={{
                label: '数据',
                render: (snapshot) => (
                  <IrisButton
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedSnapshot(snapshot)}
                  >
                    查看脱敏数据
                  </IrisButton>
                ),
              }}
            />
          </IrisCard>
          {selectedSnapshot ? (
            <IrisCard variant="outline" header="快照数据">
              <pre className="json-viewer">
                {JSON.stringify(selectedSnapshot.data ?? {}, null, 2)}
              </pre>
            </IrisCard>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
