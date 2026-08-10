import * as React from 'react'
import { composeFeatures, hasComposableFeatures, type ComposableFeature } from '@iris-ui-kit/core'
import { IrisResizable, type IrisResizableProps } from './Resizable'
import { IrisMovable, type IrisMovableProps } from './Movable'
import { IrisSortable, type IrisSortableProps } from './Sortable'
import { IrisClickOutside, type IrisClickOutsideProps } from './ClickOutside'
import { IrisHotkey, type IrisHotkeyProps } from './Hotkey'

/**
 * Capability composition interface — one declarative surface for composing
 * orthogonal capabilities onto any primitive without creating new components.
 *
 * ```tsx
 * <IrisCompose
 *   resizable={{ defaultSize: { width: 320, height: 240 }, minWidth: 200 }}
 *   sortable={{ items, onReorder }}
 *   clickOutside={{ onOutside }}
 *   hotkey={{ shortcut: 'Mod+k', onTrigger }}
 * >
 *   <IrisList items={items} />
 * </IrisCompose>
 * ```
 *
 * Capabilities are optional; each is applied in the fixed core wrap order
 * (hotkey → clickOutside → sortable → movable → resizable). Internal
 * capabilities (virtual scrolling, multiple selection, roving) are component
 * props on the primitives themselves (e.g. `<IrisSelect virtual multiple>`).
 */
export interface IrisComposeProps {
  /** Resizable wrapper config (enables 8-direction resize). */
  resizable?: IrisResizableProps
  /** Movable wrapper config (drag positioning). */
  movable?: IrisMovableProps
  /** Sortable wrapper config (drag reorder of children). */
  sortable?: IrisSortableProps
  /** Click-outside detection. */
  clickOutside?: IrisClickOutsideProps
  /** Global keyboard shortcut binding. */
  hotkey?: IrisHotkeyProps
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function IrisCompose({
  resizable,
  movable,
  sortable,
  clickOutside,
  hotkey,
  children,
  className,
  style,
}: IrisComposeProps): React.ReactElement {
  const features: Partial<Record<ComposableFeature, unknown>> = {
    resizable,
    movable,
    sortable,
    clickOutside,
    hotkey,
  }
  const active = composeFeatures(features)

  let node = <>{children}</>
  if (!hasComposableFeatures(features)) {
    return <>{children}</>
  }
  for (const feature of active) {
    switch (feature) {
      case 'hotkey':
        if (hotkey) node = <IrisHotkey {...hotkey}>{node}</IrisHotkey>
        break
      case 'clickOutside':
        if (clickOutside) node = <IrisClickOutside {...clickOutside}>{node}</IrisClickOutside>
        break
      case 'sortable':
        if (sortable) node = <IrisSortable {...sortable}>{node}</IrisSortable>
        break
      case 'movable':
        if (movable) node = <IrisMovable {...movable}>{node}</IrisMovable>
        break
      case 'resizable':
        if (resizable)
          node = (
            <IrisResizable {...resizable} className={className} style={style}>
              {node}
            </IrisResizable>
          )
        break
    }
  }
  return node as React.ReactElement
}
