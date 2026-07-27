import { describe, it, expect } from 'vitest'
import { runPlugins, defaultMessages } from '@iris-ui-kit/core'
import { localeZhPlugin, zhCNMessages } from './index'

describe('localeZhPlugin', () => {
  it('has the expected name', () => {
    expect(localeZhPlugin.name).toBe('locale-zh')
  })

  it('registers zh-CN messages through the registry', () => {
    const { messages } = runPlugins([localeZhPlugin])
    expect(messages['zh-CN']).toBeDefined()
    expect(messages['zh-CN']['pagination.next']).toBe('下一页')
  })

  it('covers a representative set of built-in keys', () => {
    expect(zhCNMessages['dialog.close']).toBe('关闭')
    expect(zhCNMessages['table.empty']).toBe('暂无数据')
    expect(zhCNMessages['tour.finish']).toBe('完成')
  })

  it('keeps interpolation placeholders intact', () => {
    expect(zhCNMessages['pagination.page']).toContain('{page}')
    expect(zhCNMessages['tour.step']).toContain('{current}')
    expect(zhCNMessages['tour.step']).toContain('{total}')
  })

  it('translates EVERY built-in key (no English fallback) — guards future drift', () => {
    const untranslated = Object.keys(defaultMessages).filter((k) => !(k in zhCNMessages))
    expect(untranslated).toEqual([])
  })

  it('preserves every {placeholder} token from the English source', () => {
    const tokens = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort()
    for (const [key, en] of Object.entries(defaultMessages)) {
      expect(tokens(zhCNMessages[key]!)).toEqual(tokens(en))
    }
  })
})
