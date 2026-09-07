import * as React from 'react'
import { IrisAlert, IrisButton, IrisCard } from '@iris-ui-kit/react'
import type { AeroIdClient } from '../api/aeroId'
import { PageHeader } from '../components/PageHeader'
import { PageError, PageLoading, PageMore } from '../components/PageState'
import { RecordTable } from '../components/RecordTable'
import { useCursorResource } from '../hooks/useCursorResource'

export function OperationsPage({ client }: { client: AeroIdClient }): React.ReactElement {
  const load = React.useCallback(() => client.listOperations(), [client])
  const resource = useCursorResource(load)
  const [action, setAction] = React.useState<string>()
  const [actionError, setActionError] = React.useState<Error>()
  const [selectedOperation, setSelectedOperation] = React.useState<Record<string, unknown>>()
  const [timeline, setTimeline] = React.useState<Record<string, unknown>[]>([])
  const [timelineCursor, setTimelineCursor] = React.useState<string>()
  const [timelineLoadingMore, setTimelineLoadingMore] = React.useState(false)
  const [timelineError, setTimelineError] = React.useState<Error>()
  const [timelineLoadMoreError, setTimelineLoadMoreError] = React.useState<Error>()
  if (resource.loading) return <PageLoading />
  if (resource.error) return <PageError error={resource.error} retry={resource.reload} />
  const hasUnknown = resource.data!.items.some((item) => item.status === 'unknown')

  const inspect = async (id: string) => {
    setAction(`inspect:${id}`)
    setActionError(undefined)
    setTimelineError(undefined)
    setTimelineLoadMoreError(undefined)
    setSelectedOperation(undefined)
    setTimeline([])
    setTimelineCursor(undefined)
    try {
      const [operationResult, timelineResult] = await Promise.allSettled([
        client.getOperation(id),
        client.getOperationTimeline(id),
      ])
      if (operationResult.status === 'rejected') throw operationResult.reason
      setSelectedOperation(operationResult.value)
      if (timelineResult.status === 'fulfilled') {
        setTimeline(timelineResult.value.items)
        setTimelineCursor(timelineResult.value.nextCursor)
      } else {
        setTimeline([])
        setTimelineError(
          timelineResult.reason instanceof Error
            ? timelineResult.reason
            : new Error('审计时间线读取失败'),
        )
      }
    } catch (reason: unknown) {
      setActionError(reason instanceof Error ? reason : new Error('操作详情读取失败'))
    } finally {
      setAction(undefined)
    }
  }

  const reconcile = async (id: string) => {
    setAction(`reconcile:${id}`)
    setActionError(undefined)
    setTimelineError(undefined)
    setTimelineLoadMoreError(undefined)
    try {
      setSelectedOperation(await client.reconcileOperation(id))
      resource.reload()
      try {
        const refreshedTimeline = await client.getOperationTimeline(id)
        setTimeline(refreshedTimeline.items)
        setTimelineCursor(refreshedTimeline.nextCursor)
      } catch (reason) {
        setTimelineError(
          reason instanceof Error ? reason : new Error('对账已完成，但审计时间线刷新失败'),
        )
      }
    } catch (reason) {
      setActionError(reason instanceof Error ? reason : new Error('操作对账失败'))
    } finally {
      setAction(undefined)
    }
  }

  const loadMoreTimeline = async () => {
    const id = String(selectedOperation?.operation_id ?? selectedOperation?.id ?? '')
    if (!id || !timelineCursor || timelineLoadingMore) return
    const requestedCursor = timelineCursor
    setTimelineLoadingMore(true)
    setTimelineLoadMoreError(undefined)
    try {
      const page = await client.getOperationTimeline(id, requestedCursor)
      setTimeline((current) => [...current, ...page.items])
      setTimelineCursor(page.nextCursor === requestedCursor ? undefined : page.nextCursor)
    } catch (reason) {
      setTimelineLoadMoreError(reason instanceof Error ? reason : new Error('加载更多审计事实失败'))
    } finally {
      setTimelineLoadingMore(false)
    }
  }

  const steps = Array.isArray(selectedOperation?.steps)
    ? selectedOperation.steps.filter(
        (step): step is Record<string, unknown> =>
          Boolean(step) && typeof step === 'object' && !Array.isArray(step),
      )
    : []
  return (
    <section>
      <PageHeader title="跨系统操作" description="aero-id 持久化的 Saga 状态及来源操作标识。" />
      {hasUnknown ? (
        <IrisAlert tone="warning" title="存在结果未知的操作">
          远端超时不代表失败；请等待以幂等键或来源 operation ID 完成对账。
        </IrisAlert>
      ) : null}
      {actionError ? <IrisAlert tone="danger">{actionError.message}</IrisAlert> : null}
      <IrisCard variant="outline">
        <RecordTable
          records={resource.data!.items}
          columns={[
            { key: 'id', label: '操作 ID', aliases: ['operation_id'] },
            { key: 'operation_type', label: '类型', aliases: ['type'] },
            { key: 'status', label: '状态', kind: 'status' },
            { key: 'created_at', label: '创建时间', kind: 'date' },
            { key: 'updated_at', label: '更新时间', kind: 'date' },
          ]}
          empty="暂无跨系统操作"
          actions={{
            render: (operation) => {
              const id = String(operation.operation_id ?? operation.id ?? '')
              const status = String(operation.status ?? '')
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
      {selectedOperation ? (
        <>
          <IrisCard variant="outline" header="操作详情">
            <RecordTable
              records={[selectedOperation]}
              columns={[
                { key: 'operation_id', label: '操作 ID', aliases: ['id'] },
                { key: 'status', label: '状态', kind: 'status' },
                { key: 'home_region', label: '主区域' },
                { key: 'error_code', label: '错误码' },
                { key: 'error_message', label: '错误信息' },
                { key: 'result', label: '结果' },
              ]}
            />
          </IrisCard>
          <IrisCard variant="outline" header="执行步骤">
            <RecordTable
              records={steps}
              columns={[
                { key: 'step_key', label: '步骤' },
                { key: 'source', label: '来源' },
                { key: 'action', label: '动作' },
                { key: 'status', label: '状态', kind: 'status' },
                { key: 'attempt', label: '尝试次数' },
                { key: 'source_operation_id', label: '来源操作 ID' },
                { key: 'error_message', label: '错误信息' },
              ]}
              empty="该操作没有执行步骤"
            />
          </IrisCard>
          <IrisCard variant="outline" header="脱敏审计时间线">
            {timelineError ? (
              <IrisAlert tone="warning" title="审计时间线不可用">
                {timelineError.message}
              </IrisAlert>
            ) : (
              <RecordTable
                records={timeline}
                columns={[
                  { key: 'occurred_at', label: '时间', kind: 'date' },
                  { key: 'action', label: '审计动作' },
                  { key: 'source', label: '来源' },
                  { key: 'resource_type', label: '资源类型' },
                  { key: 'resource_id', label: '资源 ID' },
                  { key: 'request_id', label: '请求 ID' },
                  { key: 'chain_sequence', label: '链序号' },
                  { key: 'payload', label: '脱敏载荷' },
                ]}
                empty="该操作暂无审计事实"
              />
            )}
            <PageMore
              available={Boolean(timelineCursor)}
              loading={timelineLoadingMore}
              error={timelineLoadMoreError}
              load={() => void loadMoreTimeline()}
            />
          </IrisCard>
        </>
      ) : null}
    </section>
  )
}
