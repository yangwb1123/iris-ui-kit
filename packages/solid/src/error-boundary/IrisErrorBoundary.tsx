import { type JSX } from 'solid-js'
import { ErrorBoundary } from 'solid-js/web'
import { useI18n } from '../i18n'

export interface IrisErrorBoundaryFallbackProps {
  /** The caught error. */
  error: unknown
  /** Clears the error and re-attempts rendering the children. */
  reset: () => void
}

export interface IrisErrorBoundaryProps {
  /** The guarded subtree. */
  children?: JSX.Element
  /**
   * Custom fallback UI. Receives `{ error, reset }`. When omitted, the themed
   * default fallback (role=alert) is rendered.
   */
  fallback?: (props: IrisErrorBoundaryFallbackProps) => JSX.Element
  /** Invoked with the caught error for logging. */
  onError?: (error: unknown) => void
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

function DefaultFallback(props: { error: unknown; reset: () => void }): JSX.Element {
  const { t } = useI18n()
  const message = () => errorMessage(props.error) || t('errorBoundary.message')

  return (
    <div
      data-iris-error-boundary=""
      role="alert"
      style={{
        padding: '16px',
        border: '1px solid var(--iris-danger)',
        'border-radius': 'var(--iris-radius-md, 6px)',
        color: 'var(--iris-danger)',
      }}
    >
      <div data-iris-error-boundary-message="">{message()}</div>
      <button type="button" data-iris-error-boundary-retry="" onClick={props.reset}>
        {t('errorBoundary.retry')}
      </button>
    </div>
  )
}

/**
 * IrisErrorBoundary: catches errors thrown while rendering its subtree and
 * switches to a fallback instead of crashing the whole tree. A thin wrapper
 * over Solid's built-in ErrorBoundary. The caught error is not rethrown.
 *
 * Provide a `fallback` render-callback receiving `{ error, reset }` for custom
 * UI; otherwise the themed, i18n'd default fallback (role=alert) is shown.
 * `reset()` clears the error and re-attempts rendering the children.
 */
export function IrisErrorBoundary(props: IrisErrorBoundaryProps): JSX.Element {
  return (
    <ErrorBoundary
      fallback={(err, reset) => {
        props.onError?.(err)
        return props.fallback ? (
          props.fallback({ error: err, reset })
        ) : (
          <DefaultFallback error={err} reset={reset} />
        )
      }}
    >
      {props.children}
    </ErrorBoundary>
  )
}
