import * as React from 'react'
import type { PageData } from '../types'

export interface CursorResource<T> {
  data?: PageData<T>
  error?: Error
  loadMoreError?: Error
  refreshError?: Error
  loading: boolean
  loadingMore: boolean
  refreshing: boolean
  reload(): void
  refresh(): void
  loadMore(): void
}

export function useCursorResource<T>(
  load: (cursor?: string) => Promise<PageData<T>>,
): CursorResource<T> {
  const [data, setData] = React.useState<PageData<T>>()
  const [error, setError] = React.useState<Error>()
  const [loadMoreError, setLoadMoreError] = React.useState<Error>()
  const [refreshError, setRefreshError] = React.useState<Error>()
  const [loading, setLoading] = React.useState(true)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)
  const [revision, setRevision] = React.useState(0)
  const generation = React.useRef(0)
  const refreshGeneration = React.useRef(0)
  const refreshInFlight = React.useRef(false)

  React.useEffect(() => {
    const currentGeneration = ++generation.current
    setLoading(true)
    setError(undefined)
    setLoadMoreError(undefined)
    setRefreshError(undefined)
    setRefreshing(false)
    refreshInFlight.current = false
    refreshGeneration.current += 1
    load().then(
      (value) => {
        if (generation.current !== currentGeneration) return
        setData(value)
        setLoading(false)
      },
      (reason: unknown) => {
        if (generation.current !== currentGeneration) return
        setError(reason instanceof Error ? reason : new Error('请求失败'))
        setLoading(false)
      },
    )
    return () => {
      if (generation.current === currentGeneration) generation.current += 1
      refreshGeneration.current += 1
      refreshInFlight.current = false
    }
  }, [load, revision])

  const refresh = React.useCallback(() => {
    if (loading || loadingMore || refreshInFlight.current) return
    const currentGeneration = generation.current
    const currentRefresh = ++refreshGeneration.current
    refreshInFlight.current = true
    setRefreshing(true)
    setRefreshError(undefined)
    load().then(
      (page) => {
        if (
          generation.current !== currentGeneration ||
          refreshGeneration.current !== currentRefresh
        )
          return
        setData(page)
        setLoadMoreError(undefined)
        setRefreshing(false)
        refreshInFlight.current = false
      },
      (reason: unknown) => {
        if (
          generation.current !== currentGeneration ||
          refreshGeneration.current !== currentRefresh
        )
          return
        setRefreshError(reason instanceof Error ? reason : new Error('刷新失败'))
        setRefreshing(false)
        refreshInFlight.current = false
      },
    )
  }, [load, loading, loadingMore])

  const loadMore = React.useCallback(() => {
    const cursor = data?.nextCursor
    if (!cursor || loading || loadingMore || refreshInFlight.current) return
    const currentGeneration = generation.current
    setLoadingMore(true)
    setLoadMoreError(undefined)
    load(cursor).then(
      (page) => {
        if (generation.current !== currentGeneration) return
        setData((current) => {
          if (!current || current.nextCursor !== cursor) return current
          return {
            ...current,
            ...page,
            items: [...current.items, ...page.items],
            nextCursor: page.nextCursor === cursor ? undefined : page.nextCursor,
          }
        })
        setLoadingMore(false)
      },
      (reason: unknown) => {
        if (generation.current !== currentGeneration) return
        setLoadMoreError(reason instanceof Error ? reason : new Error('加载更多失败'))
        setLoadingMore(false)
      },
    )
  }, [data?.nextCursor, load, loading, loadingMore])

  return {
    data,
    error,
    loadMoreError,
    refreshError,
    loading,
    loadingMore,
    refreshing,
    reload: () => setRevision((value) => value + 1),
    refresh,
    loadMore,
  }
}
