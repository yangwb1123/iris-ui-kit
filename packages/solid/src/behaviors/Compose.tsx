import { composeFeatures, hasComposableFeatures, type ComposableFeature } from '@iris-ui-kit/core'
import { IrisResizable } from './Resizable'
import { IrisMovable } from './Movable'
import { IrisSortable } from './IrisSortable'
import { IrisClickOutside } from './ClickOutside'
import { IrisHotkey } from './Hotkey'

/**
 * Capability composition interface — one declarative surface for composing
 * orthogonal capabilities onto any primitive (see core compose.ts).
 */
export interface IrisComposeProps {
  resizable?: Record<string, unknown>
  movable?: Record<string, unknown>
  sortable?: Record<string, unknown>
  clickOutside?: Record<string, unknown>
  hotkey?: Record<string, unknown>
  children?: import('solid-js').JSX.Element
}

export function IrisCompose(props: IrisComposeProps): import('solid-js').JSX.Element {
  const features: Partial<Record<ComposableFeature, unknown>> = {
    resizable: props.resizable,
    movable: props.movable,
    sortable: props.sortable,
    clickOutside: props.clickOutside,
    hotkey: props.hotkey,
  }
  const active = composeFeatures(features)

  let node = <>{props.children}</>
  if (!hasComposableFeatures(features)) return node
  for (const feature of active) {
    switch (feature) {
      case 'hotkey':
        if (props.hotkey) {
          const hp = props.hotkey
          node = (
            <IrisHotkey
              shortcut={hp.shortcut as string}
              onTrigger={hp.onTrigger as (e: KeyboardEvent) => void}
              disabled={hp.disabled as boolean | undefined}
            >
              {node}
            </IrisHotkey>
          )
        }
        break
      case 'clickOutside':
        if (props.clickOutside)
          node = (
            <IrisClickOutside {...((props.clickOutside ?? {}) as object)}>{node}</IrisClickOutside>
          )
        break
      case 'sortable':
        if (props.sortable) {
          const sp = props.sortable
          node = (
            <IrisSortable
              items={sp.items as unknown[]}
              onReorder={sp.onReorder as (next: unknown[]) => void}
            >
              {node}
            </IrisSortable>
          )
        }
        break
      case 'movable':
        if (props.movable)
          node = <IrisMovable {...((props.movable ?? {}) as object)}>{node}</IrisMovable>
        break
      case 'resizable':
        if (props.resizable)
          node = <IrisResizable {...((props.resizable ?? {}) as object)}>{node}</IrisResizable>
        break
    }
  }
  return node
}
