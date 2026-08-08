import * as React from 'react'
import { useTabsContext } from './context'

export interface IrisTabsContentProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  value: string
  /** Render even when inactive; hidden via the `hidden` attribute. */
  forceMount?: boolean
  children?: React.ReactNode
}

/**
 * Panel paired with a `IrisTabsTrigger` by matching `value`. When `lazy` is
 * true on the parent (default), inactive panels are unmounted. Pass
 * `forceMount` to always render (e.g. for SEO or pre-warming).
 */
export const IrisTabsContent = React.forwardRef<HTMLDivElement, IrisTabsContentProps>(
  function IrisTabsContent({ value, forceMount = false, style, children, ...rest }, ref) {
    const ctx = useTabsContext('IrisTabsContent')
    const isActive = ctx.value === value
    if (!isActive && ctx.lazy && !forceMount) return null
    return (
      <div
        {...rest}
        ref={ref}
        role="tabpanel"
        id={`iris-tabs-content-${value}`}
        aria-labelledby={`iris-tabs-trigger-${value}`}
        data-iris-tabs-content=""
        data-state={isActive ? 'active' : 'inactive'}
        hidden={!isActive || undefined}
        tabIndex={0}
        style={{
          padding: 'var(--iris-padding-md, 12px) 0',

          ...style,
        }}
      >
        {children}
      </div>
    )
  },
)
