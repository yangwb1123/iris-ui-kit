import { createPlugin } from '@iris-ui/core'

/**
 * Simplified-Chinese (`zh-CN`) translations for every built-in component
 * string. Mirrors the keys of `defaultMessages` in `@iris-ui/core`. Used by the
 * {@link localeZhPlugin}; exported separately so consumers can spread it into
 * their own `messages` if they prefer the manual i18n path.
 */
export const zhCNMessages: Record<string, string> = {
  'pagination.label': '分页',
  'pagination.previous': '上一页',
  'pagination.next': '下一页',
  'pagination.first': '第一页',
  'pagination.last': '最后一页',
  'pagination.page': '第 {page} 页',
  'dialog.close': '关闭',
  'drawer.close': '关闭',
  'select.placeholder': '请选择…',
  'commandPalette.placeholder': '输入命令…',
  'commandPalette.empty': '无结果',
  'fileUpload.label': '点击或拖拽文件上传',
  'otpInput.cell': '第 {index} 位，共 {total} 位',
  'rating.value': '{value} / {max}',
  'combobox.empty': '无结果',
  'carousel.previous': '上一张',
  'carousel.next': '下一张',
  'carousel.slide': '第 {index} 张，共 {total} 张',
  'transfer.toTarget': '移到已选',
  'transfer.toSource': '移到可选',
  'transfer.search': '搜索',
  'transfer.empty': '无数据',
  'backTop.label': '回到顶部',
  'treeSelect.expand': '展开',
  'treeSelect.collapse': '收起',
  'image.preview': '图片预览',
  'floatButton.actions': '操作',
  'tour.next': '下一步',
  'tour.prev': '上一步',
  'tour.skip': '跳过',
  'tour.finish': '完成',
  'tour.step': '第 {current} 步，共 {total} 步',
  'tagInput.remove': '移除 {tag}',
  'copyButton.copy': '复制',
  'copyButton.copied': '已复制',
  'splitButton.more': '更多操作',
  'table.empty': '暂无数据',
  'table.loading': '加载中…',
  'table.error': '数据加载失败',
  'list.empty': '暂无数据',
  'list.loading': '加载中…',
  'list.error': '加载失败',
  'tree.empty': '暂无数据',
  'tree.loading': '加载中…',
  'tree.error': '加载失败',
  'clearable.clear': '清除',
}

/**
 * Iris plugin that registers the {@link zhCNMessages} dictionary for the
 * `zh-CN` locale. Pass it to `<IrisProvider plugins={[localeZhPlugin]} locale="zh-CN">`.
 */
export const localeZhPlugin = createPlugin({
  name: 'locale-zh',
  install(registry) {
    registry.registerMessages('zh-CN', zhCNMessages)
  },
})
