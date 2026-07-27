import { For, mergeProps, Show, type JSX } from 'solid-js'
import type { NavNode } from '@iris-ui-kit/core'
import { IrisBreadcrumb } from '../primitives/breadcrumb/Breadcrumb'
import { IrisBreadcrumbItem } from '../primitives/breadcrumb/BreadcrumbItem'
import { IrisIcon } from '../primitives/icon/Icon'

export interface IrisAdminBreadcrumbProps {
  /** Root→current ancestor chain (typically `findNavPath(menus, activeKey)`). */
  trail: NavNode[]
  showIcon?: boolean
  /** Hide the breadcrumb when the trail has a single crumb. */
  hideSingle?: boolean
  separator?: string
  onSelect?: (key: string, node: NavNode) => void
}

/**
 * Breadcrumb trail for the admin header, driven by a `NavNode[]` ancestor chain.
 * The last crumb is the current page (`aria-current`); earlier crumbs are
 * clickable and call `onSelect(key, node)`. Solid port of the React/Vue
 * IrisAdminBreadcrumb.
 */
export function IrisAdminBreadcrumb(props: IrisAdminBreadcrumbProps): JSX.Element {
  const merged = mergeProps({ showIcon: true, hideSingle: false, separator: '/' }, props)
  const visible = (): boolean =>
    props.trail.length > 0 && !(merged.hideSingle && props.trail.length === 1)

  return (
    <Show when={visible()}>
      <IrisBreadcrumb separator={merged.separator}>
        <For each={props.trail}>
          {(node, i) => {
            const last = (): boolean => i() === props.trail.length - 1
            return (
              <IrisBreadcrumbItem
                current={last()}
                data-iris-admin-crumb=""
                style={{ display: 'inline-flex', 'align-items': 'center' }}
                onClick={last() ? undefined : () => merged.onSelect?.(node.key, node)}
              >
                <Show when={merged.showIcon && node.icon}>
                  <IrisIcon name={node.icon!} size={14} style={{ 'margin-inline-end': '4px' }} />
                </Show>
                <span>{node.title}</span>
              </IrisBreadcrumbItem>
            )
          }}
        </For>
      </IrisBreadcrumb>
    </Show>
  )
}
