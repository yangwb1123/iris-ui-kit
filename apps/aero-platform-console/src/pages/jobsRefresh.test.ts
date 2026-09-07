import { describe, expect, it } from 'vitest'
import { hasActiveJobs } from './jobsRefresh'

describe('job list refresh policy', () => {
  it('refreshes only while pending or running jobs exist', () => {
    expect(hasActiveJobs([{ status: 'completed' }, { status: 'unknown' }])).toBe(false)
    expect(hasActiveJobs([{ status: 'failed' }, { status: 'pending' }])).toBe(true)
    expect(hasActiveJobs([{ status: 'running' }])).toBe(true)
  })
})
