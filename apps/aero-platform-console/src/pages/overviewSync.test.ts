import { describe, expect, it, vi } from 'vitest'
import { isTerminalSyncJob, pollSyncJob, staleAllowListedDatasets, syncJobID } from './overviewSync'

describe('overview projection synchronization', () => {
  it('selects only unique stale datasets present in the server allow-list', () => {
    expect(
      staleAllowListedDatasets(
        {
          stale_datasets: [
            'aero-im.profile',
            'not-a-real-dataset',
            'aero-im.profile',
            'aero-vault.usage',
          ],
        },
        [
          { name: 'aero-im.profile', source: 'aero-im', pii: true },
          { name: 'aero-vault.usage', source: 'aero-vault', pii: false },
        ],
      ),
    ).toEqual(['aero-im.profile', 'aero-vault.usage'])
  })

  it('polls a pending task until a terminal result without reconciling unknown', async () => {
    const getSyncJob = vi
      .fn()
      .mockResolvedValueOnce({ job_id: 'job-1', status: 'running' })
      .mockResolvedValueOnce({ job_id: 'job-1', status: 'unknown' })
    const updates: string[] = []

    const result = await pollSyncJob(
      { getSyncJob },
      { job_id: 'job-1', status: 'pending' },
      {
        delay: async () => undefined,
        onUpdate: (job) => updates.push(String(job.status)),
      },
    )

    expect(result).toMatchObject({ status: 'unknown' })
    expect(updates).toEqual(['running', 'unknown'])
    expect(getSyncJob).toHaveBeenCalledTimes(2)
    expect(isTerminalSyncJob(result)).toBe(true)
  })

  it('does not poll terminal or unidentifiable jobs', async () => {
    const getSyncJob = vi.fn()

    await expect(
      pollSyncJob({ getSyncJob }, { job_id: 'job-2', status: 'completed' }),
    ).resolves.toMatchObject({ status: 'completed' })
    await expect(pollSyncJob({ getSyncJob }, { status: 'pending' })).resolves.toMatchObject({
      status: 'pending',
    })

    expect(syncJobID({ id: 'fallback-id' })).toBe('fallback-id')
    expect(getSyncJob).not.toHaveBeenCalled()
  })
})
