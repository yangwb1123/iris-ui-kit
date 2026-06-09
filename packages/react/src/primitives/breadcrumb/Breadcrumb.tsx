import * as React from 'react'
import { useI18n } from '../../i18n'

export interface IrisBreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  /** String separator between crumbs. Default `/`. */
  separator?: React.ReactNode
  children?: React.ReactNode
}

/**
 * Container for breadcrumb navigation. Renders a `<nav>` with an `<ol>` per
 * WAI-ARIA. Inserts `separator` between items and tags the last child with
 * `isCurrent` so it renders as plain text + `aria-current="page"`.
 */
export const IrisBreadcrumb = React.forwardRef<HTMLElement, IrisBreadcrumbProps>(
  function IrisBreadcrumb({ separator = '/', children, ...rest }, ref) {
    const { t } = useI18n()
    const flat = React.Children.toArray(children).filter((c) =>
      React.isValidElement(c),
    ) as React.ReactElement[]
    const total = flat.length

    return (
      <nav
        {...rest}
        ref={ref as React.Ref<HTMLElement>}
        aria-label={t('breadcrumb.label')}
        data-iris-breadcrumb=""
      >
        <ol
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            margin: 0,
            padding: 0,
            listStyle: 'none',
            fontSize: 14,
          }}
        >
          {flat.map((child, i) => {
            const isLast = i === total - 1
            const itemNode = (
              <li
                key={`item-${i}`}
                data-iris-breadcrumb-item=""
                data-iris-breadcrumb-last={isLast ? 'true' : undefined}
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                {React.cloneElement(child, {
                  isCurrent: isLast,
                } as Partial<unknown> as React.Attributes)}
              </li>
            )
            const sepNode = !isLast ? (
              <li
                key={`sep-${i}`}
                data-iris-breadcrumb-separator=""
                aria-hidden="true"
                style={{ color: 'var(--iris-muted)', display: 'inline-flex', alignItems: 'center' }}
              >
                {separator}
              </li>
            ) : null
            return (
              <React.Fragment key={`pair-${i}`}>
                {itemNode}
                {sepNode}
              </React.Fragment>
            )
          })}
        </ol>
      </nav>
    )
  },
)
