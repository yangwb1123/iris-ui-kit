import * as React from 'react'
import { IrisAlert, IrisButton, IrisCard } from '@iris-ui-kit/react'
import type { AeroIdClient } from '../api/aeroId'
import { PageHeader } from '../components/PageHeader'
import { PageError, PageLoading, PageMore } from '../components/PageState'
import { RecordTable } from '../components/RecordTable'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { useCursorResource } from '../hooks/useCursorResource'
import { useVisibleRefresh } from '../hooks/useVisibleRefresh'
import { hasActiveJobs } from './jobsRefresh'

export function JobsPage({ client }: { client: AeroIdClient }): React.ReactElement {
  const loadJobs = React.useCallback((cursor?: string) => client.listSyncJobs(cursor), [client])
  const loadDatasets = React.useCallback(() => client.listDatasets(), [client])
  const jobs = useCursorResource(loadJobs)
  const datasets = useAsyncResource(loadDatasets)
  const [action, setAction] = React.useState<string>()
  const [actionError, setActionError] = React.useState<Error>()
  const [selectedJob, setSelectedJob] = React.useState<Record<string, unknown>>()
  useVisibleRefresh(hasActiveJobs(jobs.data?.items ?? []), jobs.refresh)
  if (jobs.loading || datasets.loading) return <PageLoading />
  if (jobs.error) return <PageError error={jobs.error} retry={jobs.reload} />
  if (datasets.error) return <PageError error={datasets.error} retry={datasets.reload} />

  const create = async (kind: 'sync' | 'export') => {
    setAction(`create:${kind}`)
    setActionError(undefined)
    try {
      const selectedDatasets = datasets.data!.map((dataset) => dataset.name)
      if (kind === 'sync') await client.createSyncJob(selectedDatasets)
      else await client.createExportJob(selectedDatasets)
      jobs.refresh()
    } catch (reason) {
      setActionError(reason instanceof Error ? reason : new Error('任务创建失败'))
    } finally {
      setAction(undefined)
    }
  }

  const inspect = async (id: string) => {
    setAction(`inspect:${id}`)
    setActionError(undefined)
    try {
      setSelectedJob(await client.getSyncJob(id))
    } catch (reason) {
      setActionError(reason instanceof Error ? reason : new Error('任务详情读取失败'))
    } finally {
      setAction(undefined)
    }
  }

  const reconcile = async (id: string) => {
    setAction(`reconcile:${id}`)
    setActionError(undefined)
    try {
      setSelectedJob(await client.reconcileSyncJob(id))
      jobs.refresh()
    } catch (reason) {
      setActionError(reason instanceof Error ? reason : new Error('任务对账失败'))
    } finally {
      setAction(undefined)
    }
  }

  const download = async (id: string) => {
    setAction(`download:${id}`)
    setActionError(undefined)
    try {
      const file = await client.downloadExport(id)
      const href = URL.createObjectURL(file.blob)
      const link = document.createElement('a')
      link.href = href
      link.download = file.filename
      link.hidden = true
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(href), 0)
    } catch (reason) {
      setActionError(reason instanceof Error ? reason : new Error('导出下载失败'))
    } finally {
      setAction(undefined)
    }
  }

  return (
    <section>
      <PageHeader
        title="同步与导出"
        description="任务使用幂等键创建；unknown 状态需要对账，不能自动视为失败重试。"
        actions={
          <>
            <IrisButton variant="ghost" loading={jobs.refreshing} onClick={jobs.refresh}>
              刷新任务
            </IrisButton>
            <IrisButton loading={action === 'create:sync'} onClick={() => void create('sync')}>
              同步全部数据集
            </IrisButton>
            <IrisButton
              variant="outline"
              loading={action === 'create:export'}
              onClick={() => void create('export')}
            >
              创建加密导出
            </IrisButton>
          </>
        }
      />
      {actionError ? <IrisAlert tone="danger">{actionError.message}</IrisAlert> : null}
      {jobs.refreshError ? (
        <IrisAlert tone="warning" title="任务列表刷新失败">
          {jobs.refreshError.message}；当前列表数据已保留，可手动重试。
        </IrisAlert>
      ) : null}
      <IrisCard variant="outline">
        <RecordTable
          records={jobs.data!.items}
          columns={[
            { key: 'id', label: '任务 ID', aliases: ['job_id'] },
            { key: 'job_type', label: '类型', aliases: ['type'] },
            { key: 'status', label: '状态', kind: 'status' },
            { key: 'created_at', label: '创建时间', kind: 'date' },
            { key: 'completed_at', label: '完成时间', kind: 'date' },
          ]}
          empty="暂无同步或导出任务"
          actions={{
            render: (job) => {
              const id = String(job.job_id ?? job.id ?? '')
              const status = String(job.status ?? '')
              const jobType = String(job.job_type ?? job.type ?? '')
              return (
                <div className="table-actions">
                  <IrisButton
                    size="sm"
                    variant="ghost"
                    loading={action === `inspect:${id}`}
                    onClick={() => void inspect(id)}
                  >
                    详情
                  </IrisButton>
                  {status === 'unknown' ? (
                    <IrisButton
                      size="sm"
                      variant="outline"
                      loading={action === `reconcile:${id}`}
                      onClick={() => void reconcile(id)}
                    >
                      对账
                    </IrisButton>
                  ) : null}
                  {jobType === 'export' && status === 'completed' ? (
                    <IrisButton
                      size="sm"
                      variant="outline"
                      loading={action === `download:${id}`}
                      onClick={() => void download(id)}
                    >
                      下载
                    </IrisButton>
                  ) : null}
                </div>
              )
            },
          }}
        />
        <PageMore
          available={Boolean(jobs.data!.nextCursor)}
          loading={jobs.loadingMore}
          error={jobs.loadMoreError}
          load={jobs.loadMore}
        />
      </IrisCard>
      {selectedJob ? (
        <IrisCard variant="outline" header="任务详情">
          <RecordTable
            records={[selectedJob]}
            columns={[
              { key: 'job_id', label: '任务 ID', aliases: ['id'] },
              { key: 'status', label: '状态', kind: 'status' },
              { key: 'attempt', label: '尝试次数' },
              { key: 'error_code', label: '错误码' },
              { key: 'error_message', label: '错误信息' },
              { key: 'result', label: '结果' },
            ]}
          />
        </IrisCard>
      ) : null}
    </section>
  )
}
