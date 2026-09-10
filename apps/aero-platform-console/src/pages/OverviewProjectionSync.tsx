import * as React from 'react'
import { IrisAlert } from '@iris-ui-kit/react'
import type { AeroIdClient } from '../api/aeroId'
import type { JsonRecord } from '../types'
import { pollSyncJob, syncJobID, syncJobStatus } from './overviewSync'

interface ProjectionSyncState {
  syncing: boolean
  job?: JsonRecord
  error?: Error
  refresh(): Promise<void>
}

export function useOverviewProjectionSync(
  client: AeroIdClient,
  datasets: string[],
  reload: () => void,
): ProjectionSyncState {
  const generation = React.useRef(0)
  const inFlight = React.useRef(false)
  const [syncing, setSyncing] = React.useState(false)
  const [job, setJob] = React.useState<JsonRecord>()
  const [error, setError] = React.useState<Error>()
  React.useEffect(
    () => () => {
      generation.current += 1
      inFlight.current = false
    },
    [],
  )

  const refresh = async () => {
    if (inFlight.current || datasets.length === 0) return
    inFlight.current = true
    const run = ++generation.current
    setSyncing(true)
    setError(undefined)
    setJob(undefined)
    try {
      const created = await client.createSyncJob(datasets)
      if (generation.current !== run) return
      setJob(created)
      const completed = await pollSyncJob(client, created, {
        active: () => generation.current === run,
        onUpdate: (current) => {
          if (generation.current === run) setJob(current)
        },
      })
      if (generation.current !== run) return
      setJob(completed)
      if (syncJobStatus(completed) === 'completed') reload()
    } catch (reason) {
      if (generation.current !== run) return
      setError(reason instanceof Error ? reason : new Error('投影同步失败'))
    } finally {
      if (generation.current === run) {
        inFlight.current = false
        setSyncing(false)
      }
    }
  }

  return { syncing, job, error, refresh }
}

function statusTone(status: string): 'success' | 'danger' | 'warning' | 'info' {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'unknown' || status === 'partially_completed') return 'warning'
  return 'info'
}

export function ProjectionSyncAlert({
  job,
  error,
}: {
  job?: JsonRecord
  error?: Error
}): React.ReactElement | null {
  if (error) {
    return (
      <IrisAlert tone="warning" title={job ? '同步任务已创建，但状态刷新失败' : '同步任务创建失败'}>
        {error.message}
        {job ? `；任务 ID：${syncJobID(job) || '已接受'}` : ''}
      </IrisAlert>
    )
  }
  if (!job) return null
  const status = syncJobStatus(job)
  return (
    <IrisAlert tone={statusTone(status)} title="投影同步任务">
      任务 ID：{syncJobID(job) || '已接受'}，状态：{status}。
      {status === 'unknown' ? '请前往“同步与导出”执行对账，不会自动重试。' : ''}
    </IrisAlert>
  )
}
