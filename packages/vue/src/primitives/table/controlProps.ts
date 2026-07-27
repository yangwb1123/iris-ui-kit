import type { PropType } from 'vue'
import type { IrisTableSortState } from './types'

/** Runtime props shared by the table's controlled and uncontrolled state pairs. */
export const tableControlProps = {
  selectable: {
    type: String as PropType<'none' | 'single' | 'multi'>,
    default: 'none',
  },
  selection: {
    type: Array as PropType<Array<string | number>>,
    default: undefined,
  },
  defaultSelection: {
    type: Array as PropType<Array<string | number>>,
    default: undefined,
  },
  sort: {
    type: Object as PropType<IrisTableSortState | null>,
    default: undefined,
  },
  defaultSort: {
    type: Object as PropType<IrisTableSortState | null>,
    default: undefined,
  },
}
