import type { AeroIdClient } from '../api/aeroId'
import type { AggregateView, Dataset, JsonRecord } from '../types'

const terminalStatuses = new Set(['completed', 'partially_completed', 'failed', 'unknown'])

export interface SyncPollOptions {
  attempts?: number
  intervalMs?: number
  active?: () => boolean
  delay?: (milliseconds: number) => Promise<void>
  onUpdate?: (job: JsonRecord) => void
}

export function staleAllowListedDatasets(overview: AggregateView, datasets: Dataset[]): string[] {
  const allowed = new Set(datasets.map((dataset) => dataset.name))
  return [
    ...new Set(
      (overview.stale_datasets ?? []).filter(
        (dataset): dataset is string => typeof dataset === 'string' && allowed.has(dataset),
      ),
    ),
  ]
}

export function syncJobID(job: JsonRecord): string {
  return String(job.job_id ?? job.id ?? '')
}

export function syncJobStatus(job: JsonRecord): string {
  return String(job.status ?? 'pending')
}

export function isTerminalSyncJob(job: JsonRecord): boolean {
  return terminalStatuses.has(syncJobStatus(job))
}

export async function pollSyncJob(
  client: Pick<AeroIdClient, 'getSyncJob'>,
  initial: JsonRecord,
  options: SyncPollOptions = {},
): Promise<JsonRecord> {
  const id = syncJobID(initial)
  if (!id || isTerminalSyncJob(initial)) return initial
  const attempts = Math.max(0, options.attempts ?? 30)
  const intervalMs = Math.max(0, options.intervalMs ?? 1_000)
  const active = options.active ?? (() => true)
  const delay =
    options.delay ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
  let current = initial
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await delay(intervalMs)
    if (!active()) return current
    current = await client.getSyncJob(id)
    options.onUpdate?.(current)
    if (isTerminalSyncJob(current)) return current
  }
  return current
}
