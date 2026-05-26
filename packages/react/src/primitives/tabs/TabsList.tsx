import * as React from 'react'
import { useTabsContext } from './context'

export type IrisTabsListProps = React.HTMLAttributes<HTMLDivElement>

/** Container for `IrisTabsTrigger`s. Renders `<div role="tablist">`. */
export const IrisTabsList = React.forwardRef<HTMLDivElement, IrisTabsListProps>(
  function IrisTabsList({ style, children, ...rest }, forwardedRef) {
    const ctx = useTabsContext('IrisTabsList')

    const captureRef = React.useCallback(
      (el: HTMLDivElement | null) => {
        ctx.listRef.current = el
        if (typeof forwardedRef === 'function') forwardedRef(el)
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = el
      },
      [ctx, forwardedRef],
    )

    return (
      <div
        {...rest}
        ref={captureRef}
        role="tablist"
        aria-orientation={ctx.orientation}
        data-iris-tabs-list=""
        data-orientation={ctx.orientation}
        style={{
          display: 'flex',
          flexDirection: ctx.orientation === 'horizontal' ? 'row' : 'column',
          gap: 2,
          borderBottom:
            ctx.orientation === 'horizontal' ? '1px solid var(--iris-border)' : 'none',
          borderRight:
            ctx.orientation === 'vertical' ? '1px solid var(--iris-border)' : 'none',
          ...style,
        }}
      >
        {children}
      </div>
    )
  },
)
