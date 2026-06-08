import { describe, it, expect } from 'vitest'
import { runPlugins } from '@iris-ui/core'
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
})
