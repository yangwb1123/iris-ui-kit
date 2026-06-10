import { defineComponent, h, onErrorCaptured, ref, type PropType, type VNode } from 'vue'
import { useI18n } from '../i18n'

/** Render-customization payload handed to the `#fallback` slot / `fallback` prop. */
export interface IrisErrorBoundaryFallbackProps {
  /** The error caught while rendering the guarded subtree. */
  error: unknown
  /** Clears the error and re-attempts rendering the children. */
  reset: () => void
}

/** Public prop surface of {@link IrisErrorBoundary}. */
export interface IrisErrorBoundaryProps {
  /**
   * Custom fallback renderer. Receives `{ error, reset }` and returns the
   * fallback UI. A `#fallback` scoped slot takes precedence when both are given.
   * When neither is supplied the themed DEFAULT fallback renders.
   */
  fallback?: (props: IrisErrorBoundaryFallbackProps) => VNode | VNode[] | string
  /** Invoked with the caught error (and Vue's error-info string) for logging. */
  onError?: (error: unknown, info?: string) => void
}

/**
 * IrisErrorBoundary: catches errors thrown while rendering its guarded subtree
 * (default slot), switches to a fallback, and exposes `reset()` to clear the
 * error and re-attempt rendering. Catching does NOT rethrow — a single broken
 * subtree no longer crashes the whole tree.
 *
 * Customize via a `#fallback` scoped slot or the `fallback` prop, each receiving
 * `{ error, reset }`. Without either, a themed, accessible (`role="alert"`)
 * default fallback shows the error message + a retry button, i18n'd through
 * `useI18n()` (English defaults without a provider).
 */
export const IrisErrorBoundary = defineComponent({
  name: 'IrisErrorBoundary',
  inheritAttrs: false,
  props: {
    fallback: {
      type: Function as PropType<IrisErrorBoundaryProps['fallback']>,
      default: undefined,
    },
    onError: {
      type: Function as PropType<IrisErrorBoundaryProps['onError']>,
      default: undefined,
    },
  },
  setup(props, { attrs, slots }) {
    const { t } = useI18n()
    const error = ref<unknown>(null)

    const reset = () => {
      error.value = null
    }

    onErrorCaptured((err, _instance, info) => {
      error.value = err
      props.onError?.(err, info)
      // Stop further propagation so the error does not crash the parent tree.
      return false
    })

    const renderDefaultFallback = (): VNode => {
      const message =
        error.value instanceof Error && error.value.message
          ? error.value.message
          : t('errorBoundary.message')

      return h(
        'div',
        {
          ...attrs,
          'data-iris-error-boundary': '',
          role: 'alert',
          style: {
            padding: '16px',
            border: '1px solid var(--iris-danger)',
            borderRadius: 'var(--iris-radius-md, 6px)',
            color: 'var(--iris-danger)',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h('div', { 'data-iris-error-boundary-message': '' }, message),
          h(
            'button',
            {
              type: 'button',
              'data-iris-error-boundary-retry': '',
              onClick: reset,
            },
            t('errorBoundary.retry'),
          ),
        ],
      )
    }

    return () => {
      if (error.value !== null) {
        const custom = slots.fallback ?? props.fallback
        if (custom) {
          return custom({ error: error.value, reset })
        }
        return renderDefaultFallback()
      }
      return slots.default?.()
    }
  },
})
