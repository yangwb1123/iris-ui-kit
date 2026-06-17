import { defineComponent, h } from 'vue'
import { IrisSelect } from './primitives/select/Select'

const ITEMS = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Apricot', value: 'apricot' },
  { label: 'Grape', value: 'grape' },
]

/**
 * Harness for the Select contract scenario.
 * Renders an uncontrolled IrisSelect with teleport={false} so the popover
 * content renders inline inside the test container.
 */
export const SelectContractHarness = defineComponent({
  name: 'SelectContractHarness',
  setup() {
    return () =>
      h(IrisSelect, {
        items: ITEMS,
        placeholder: 'Select fruit',
        teleport: false,
      })
  },
})
