import { IrisAlert, IrisButton, IrisCard, IrisSpinner } from '@iris-ui-kit/react'

export function PageLoading(): React.ReactElement {
  return (
    <IrisCard variant="outline">
      <div className="page-loading">
        <IrisSpinner label="正在加载" />
        <span>正在读取平台数据…</span>
      </div>
    </IrisCard>
  )
}

export function PageError({ error, retry }: { error: Error; retry(): void }): React.ReactElement {
  return (
    <IrisAlert tone="danger" title="读取失败">
      <div className="alert-actions">
        <span>{error.message}</span>
        <IrisButton size="sm" variant="outline" onClick={retry}>
          重试
        </IrisButton>
      </div>
    </IrisAlert>
  )
}

export function PageMore({
  available,
  loading,
  error,
  load,
}: {
  available: boolean
  loading: boolean
  error?: Error
  load(): void
}): React.ReactElement | null {
  if (!available && !error) return null
  return (
    <div className="pagination-footer">
      {error ? <IrisAlert tone="warning">{error.message}</IrisAlert> : null}
      {available ? (
        <IrisButton variant="outline" loading={loading} onClick={load}>
          加载更多
        </IrisButton>
      ) : null}
    </div>
  )
}
