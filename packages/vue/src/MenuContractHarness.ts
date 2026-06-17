import { defineComponent, h } from 'vue'
import { IrisMenu } from './primitives/menu/Menu'
import { IrisMenuTrigger } from './primitives/menu/MenuTrigger'
import { IrisMenuContent } from './primitives/menu/MenuContent'
import { IrisMenuItem } from './primitives/menu/MenuItem'

/**
 * Harness for the Menu contract scenario.
 * Renders an uncontrolled IrisMenu with teleport={false} so the menu
 * content renders inline inside the test container.
 */
export const MenuContractHarness = defineComponent({
  name: 'MenuContractHarness',
  setup() {
    return () =>
      h(
        IrisMenu,
        { defaultOpen: false },
        {
          default: () => [
            h(IrisMenuTrigger, null, () => 'Menu'),
            h(
              IrisMenuContent,
              { teleport: false },
              {
                default: () => [h(IrisMenuItem, { onSelect: () => {} }, () => 'Item1')],
              },
            ),
          ],
        },
      )
  },
})
