import { describe, it, expect } from 'vitest'

describe('i18n module', () => {
  it('exports IrisI18nProvider and useI18n', async () => {
    const mod = await import('./index')
    expect(typeof mod.IrisI18nProvider).toBe('function')
    expect(typeof mod.useI18n).toBe('function')
  })
})
