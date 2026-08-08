import { defineComponent, h, type PropType } from 'vue'
import { composeFeatures, hasComposableFeatures, type ComposableFeature } from '@iris-ui-kit/core'
import { IrisResizable } from './Resizable'
import { IrisMovable } from './Movable'
import { IrisSortable } from './Sortable'
import { IrisClickOutside } from './ClickOutside'
import { IrisHotkey } from './Hotkey'

/**
 * Capability composition interface — one declarative surface for composing
 * orthogonal capabilities onto any primitive (see core compose.ts).
 */
export const IrisCompose = defineComponent({
  name: 'IrisCompose',
  props: {
    resizable: { type: Object as PropType<Record<string, unknown>>, default: undefined },
    movable: { type: Object as PropType<Record<string, unknown>>, default: undefined },
    sortable: { type: Object as PropType<Record<string, unknown>>, default: undefined },
    clickOutside: { type: Object as PropType<Record<string, unknown>>, default: undefined },
    hotkey: { type: Object as PropType<Record<string, unknown>>, default: undefined },
  },
  setup(props, { slots }) {
    return () => {
      const features: Partial<Record<ComposableFeature, unknown>> = {
        resizable: props.resizable,
        movable: props.movable,
        sortable: props.sortable,
        clickOutside: props.clickOutside,
        hotkey: props.hotkey,
      }
      if (!hasComposableFeatures(features)) return slots.default?.()
      const active = composeFeatures(features)
      let node = slots.default?.() ?? []
      for (const feature of active) {
        switch (feature) {
          case 'hotkey':
            if (props.hotkey) node = [h(IrisHotkey, props.hotkey as never, { default: () => node })]
            break
          case 'clickOutside':
            if (props.clickOutside)
              node = [h(IrisClickOutside, props.clickOutside as never, { default: () => node })]
            break
          case 'sortable':
            if (props.sortable)
              node = [h(IrisSortable, props.sortable as never, { default: () => node })]
            break
          case 'movable':
            if (props.movable)
              node = [h(IrisMovable, props.movable as never, { default: () => node })]
            break
          case 'resizable':
            if (props.resizable)
              node = [h(IrisResizable, props.resizable as never, { default: () => node })]
            break
        }
      }
      return node
    }
  },
})
