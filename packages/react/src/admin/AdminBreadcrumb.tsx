import * as React from 'react'
import type { NavNode } from '@iris-ui-kit/core'
import { IrisBreadcrumb } from '../primitives/breadcrumb/Breadcrumb'
import { IrisBreadcrumbItem } from '../primitives/breadcrumb/BreadcrumbItem'
import { IrisIcon } from '../primitives/icon/Icon'

export interface IrisAdminBreadcrumbProps {
  /** Root→current ancestor chain (typically `findNavPath(menus, activeKey)`). */
  trail: NavNode[]
  /** Show each node's icon before its title. */
  showIcon?: boolean
  /** Hide the breadcrumb when the trail has a single crumb. */
  hideSingle?: boolean
  separator?: string
  onSelect?: (key: string, node: NavNode) => void
}

/**
 * Breadcrumb trail for the admin header, driven by a `NavNode[]` ancestor chain.
 * The last crumb is the current page (auto-marked `aria-current` by
 * IrisBreadcrumb); earlier crumbs are clickable and call `onSelect(key, node)`.
 * React port of the Vue `IrisAdminBreadcrumb`.
 */
export function IrisAdminBreadcrumb({
  trail,
  showIcon = true,
  hideSingle = false,
  separator = '/',
  onSelect,
}: IrisAdminBreadcrumbProps): React.ReactElement | null {
  if (trail.length === 0 || (hideSingle && trail.length === 1)) return null

  return (
    <IrisBreadcrumb separator={separator}>
      {trail.map((node, i) => {
        const last = i === trail.length - 1
        return (
          <IrisBreadcrumbItem
            key={node.key}
            data-iris-admin-crumb=""
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              cursor: last ? 'default' : 'pointer',
            }}
            onClick={last ? undefined : () => onSelect?.(node.key, node)}
          >
            {showIcon && node.icon ? (
              <IrisIcon name={node.icon} size={14} style={{ marginInlineEnd: 4 }} />
            ) : null}
            <span>{node.title}</span>
          </IrisBreadcrumbItem>
        )
      })}
    </IrisBreadcrumb>
  )
}
