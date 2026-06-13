import type { ContractScenario } from '../types'

const TAG = '[data-iris-tag-input-tag]'
const REMOVE = '[data-iris-tag-input-remove]'

/**
 * Shared TagInput removal behavior. Each adapter mounts a tag input with three
 * tags — `Alpha`/`Bravo`/`Charlie` — (React/Solid uncontrolled `defaultValue`;
 * Vue/Svelte a model harness holding the array), then runs this. Each rendered
 * tag carries `data-iris-tag-input-tag` + `data-value="<tag>"` and a
 * `[data-iris-tag-input-remove]` button; clicking a tag's remove button drops it
 * from the list and the remaining tags reflow. Asserts all four adapters drive
 * the same tags-array removal (only the remove path is exercised — adding a tag
 * needs text entry, which the contract driver doesn't do).
 */
export const tagInputScenario: ContractScenario = {
  name: 'TagInput',
  description: 'Clicking a tag remove button drops that tag; the remaining tags reflow.',
  steps: [
    {
      label: 'initial: three tags',
      action: 'none',
      expect: [
        { selector: TAG, read: 'count', equals: 3 },
        { selector: TAG, index: 0, read: 'data-value', equals: 'Alpha' },
        { selector: TAG, index: 1, read: 'data-value', equals: 'Bravo' },
        { selector: TAG, index: 2, read: 'data-value', equals: 'Charlie' },
      ],
    },
    {
      label: 'remove the middle tag (Bravo)',
      action: 'click',
      target: REMOVE,
      index: 1,
      expect: [
        { selector: TAG, read: 'count', equals: 2 },
        { selector: TAG, index: 0, read: 'data-value', equals: 'Alpha' },
        { selector: TAG, index: 1, read: 'data-value', equals: 'Charlie' },
      ],
    },
    {
      label: 'remove the first tag (Alpha) → only Charlie remains',
      action: 'click',
      target: REMOVE,
      index: 0,
      expect: [
        { selector: TAG, read: 'count', equals: 1 },
        { selector: TAG, index: 0, read: 'data-value', equals: 'Charlie' },
      ],
    },
  ],
}
