import * as React from 'react'
import { useI18n } from '../i18n'

export interface IrisErrorBoundaryFallbackProps {
  /** The caught error. */
  error: Error
  /** Clears the error and re-attempts rendering the children. */
  reset: () => void
}

export interface IrisErrorBoundaryProps {
  /** The guarded subtree. */
  children?: React.ReactNode
  /**
   * Custom fallback UI. Receives `{ error, reset }`. When omitted, the
   * default themed, accessible fallback is rendered.
   */
  fallback?: (props: IrisErrorBoundaryFallbackProps) => React.ReactNode
  /** Invoked with the caught error (and React error info) for logging. */
  onError?: (error: Error, info: React.ErrorInfo) => void
}

interface IrisErrorBoundaryState {
  error: Error | null
}

/**
 * Default themed, accessible fallback. A function sub-component so it can call
 * `useI18n()` — the class boundary can't use hooks. Falls back to English
 * without a provider.
 */
function DefaultErrorFallback({
  error,
  reset,
}: IrisErrorBoundaryFallbackProps): React.ReactElement {
  const { t } = useI18n()
  return (
    <div
      data-iris-error-boundary=""
      role="alert"
      style={{
        padding: 16,
        border: '1px solid var(--iris-danger)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        color: 'var(--iris-danger)',
      }}
    >
      <div data-iris-error-boundary-message="">{error.message || t('errorBoundary.message')}</div>
      <button type="button" data-iris-error-boundary-retry="" onClick={reset}>
        {t('errorBoundary.retry')}
      </button>
    </div>
  )
}

/**
 * Catches errors thrown while rendering its subtree and switches to a fallback
 * UI instead of crashing the whole React tree. Exposes `reset()` (passed to the
 * fallback) that clears the error and re-attempts rendering the children.
 *
 * Standalone component — it does NOT wrap `IrisProvider`'s children, so error
 * semantics for existing consumers are unchanged.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisErrorBoundary}.
 */
export class IrisErrorBoundary extends React.Component<
  IrisErrorBoundaryProps,
  IrisErrorBoundaryState
> {
  override state: IrisErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): IrisErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  override render(): React.ReactNode {
    const { error } = this.state
    if (error !== null) {
      const { fallback } = this.props
      if (fallback) return fallback({ error, reset: this.reset })
      return <DefaultErrorFallback error={error} reset={this.reset} />
    }
    return this.props.children
  }
}
