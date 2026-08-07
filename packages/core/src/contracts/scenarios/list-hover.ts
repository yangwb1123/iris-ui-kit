import type { ContractScenario } from '../types'

const OPTION = '[data-iris-list-item]'

/**
 * Shared List hover contract — 防回归：下拉/选择选项必须提供 hover 反馈。
 *
 * 每个选项行携带 `data-hovered`（"true"/"false"）：
 *   pointer enter 某个选项 → data-hovered="true"（且其他选项保持 false）；
 *   pointer leave → 恢复 "false"。
 * 四框架一致（纯 inline-style 架构下由 JS 状态表达 hover）。
 */
export const listHoverScenario: ContractScenario = {
  name: 'List hover',
  description: 'Pointer enter marks the hovered option via data-hovered="true"; leave clears it.',
  steps: [
    {
      label: 'initial: nothing hovered',
      action: 'none',
      expect: [
        { selector: OPTION, index: 0, read: 'data-hovered', equals: 'false' },
        { selector: OPTION, index: 1, read: 'data-hovered', equals: 'false' },
        { selector: OPTION, index: 2, read: 'data-hovered', equals: 'false' },
      ],
    },
    {
      label: 'pointer enter option 0 → hovered',
      action: 'pointer',
      target: OPTION,
      index: 0,
      pointerEvent: 'enter',
      expect: [
        { selector: OPTION, index: 0, read: 'data-hovered', equals: 'true' },
        { selector: OPTION, index: 1, read: 'data-hovered', equals: 'false' },
      ],
    },
    {
      label: 'pointer enter option 1 → hovered moves',
      action: 'pointer',
      target: OPTION,
      index: 1,
      pointerEvent: 'enter',
      expect: [
        { selector: OPTION, index: 1, read: 'data-hovered', equals: 'true' },
        { selector: OPTION, index: 0, read: 'data-hovered', equals: 'false' },
      ],
    },
    {
      label: 'pointer leave option 1 → cleared',
      action: 'pointer',
      target: OPTION,
      index: 1,
      pointerEvent: 'leave',
      expect: [
        { selector: OPTION, index: 1, read: 'data-hovered', equals: 'false' },
        { selector: OPTION, index: 2, read: 'data-hovered', equals: 'false' },
      ],
    },
  ],
}
