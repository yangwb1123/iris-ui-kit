// `getPageRange` + the page-item type now live in @iris-ui-kit/core — the single
// source of the page-range algorithm shared by all four framework adapters.
// Re-exported here so existing `./types` imports keep working unchanged.
export { getPageRange, type PageItem as IrisPageItem } from '@iris-ui-kit/core'
