import type { JsonRecord } from '../types'

const activeJobStatuses = new Set(['pending', 'running'])

export function hasActiveJobs(jobs: JsonRecord[]): boolean {
  return jobs.some((job) => activeJobStatuses.has(String(job.status ?? '')))
}
