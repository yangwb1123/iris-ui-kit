import * as React from 'react'
import { useAccordionContext } from './context'

export interface IrisAccordionItemProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  value: string
  title?: React.ReactNode
  disabled?: boolean
}

/**
 * A single accordion section: a button-styled header + a collapsible body.
 * Wires `aria-expanded`, `aria-controls`, `role="region"`, `aria-labelledby`.
 */
export const IrisAccordionItem = React.forwardRef<HTMLDivElement, IrisAccordionItemProps>(
  function IrisAccordionItem({ value, title, disabled = false, style, children, ...rest }, ref) {
    const ctx = useAccordionContext('IrisAccordionItem')
    const open = ctx.isOpen(value)
    const headerId = `${ctx.rootId}-h-${value}`
    const contentId = `${ctx.rootId}-c-${value}`

    const onTrigger = () => {
      if (disabled) return
      ctx.toggle(value)
    }
    const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        ctx.toggle(value)
      }
    }

    return (
      <div
        {...rest}
        ref={ref}
        data-iris-accordion-item=""
        data-state={open ? 'open' : 'closed'}
        data-disabled={disabled ? 'true' : undefined}
        style={{
          borderBottom: '1px solid var(--iris-border)',
          ...style,
        }}
      >
        <button
          type="button"
          id={headerId}
          data-iris-accordion-trigger=""
          aria-expanded={open}
          aria-controls={contentId}
          disabled={disabled || undefined}
          onClick={onTrigger}
          onKeyDown={onKeyDown}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: 'var(--iris-padding-md, 12px)',
            background: 'transparent',
            color: 'var(--iris-foreground)',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            font: 'inherit',
            textAlign: 'left',
          }}
        >
          <span data-iris-accordion-title="" style={{ flex: 1, minWidth: 0 }}>
            {title}
          </span>
          <span
            aria-hidden="true"
            data-iris-accordion-chevron=""
            style={{
              transition: 'transform 160ms ease',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              color: 'var(--iris-muted)',
            }}
          >
            ⌄
          </span>
        </button>
        {open ? (
          <div
            role="region"
            id={contentId}
            aria-labelledby={headerId}
            data-iris-accordion-content=""
            style={{ padding: '0 var(--iris-padding-md, 12px) var(--iris-padding-md, 12px)' }}
          >
            {children}
          </div>
        ) : null}
      </div>
    )
  },
)
