import type { ContractScenario } from '../types'

const BTN = '[data-iris-copy-button]'

/**
 * Shared IrisCopyButton behavior. Each adapter mounts an uncontrolled copy
 * button (no children, default "Copy" label). The scenario tests:
 * initial idle state → click copies text → data-copied="true" + "Copied"
 * label appear.
 *
 * Note: the actual clipboard write may silently fail in jsdom — the button's
 * copied state still flips regardless (it's an intent signal).
 */
export const copyButtonScenario: ContractScenario = {
  name: 'CopyButton',
  description:
    'An uncontrolled copy button starts showing "Copy"; clicking it copies ' +
    'the text and transitions to a "Copied" state with data-copied="true".',
  steps: [
    {
      label: 'initial: idle, shows "Copy"',
      action: 'none',
      expect: [
        { selector: BTN, read: 'count', equals: 1 },
        { selector: BTN, read: 'text', equals: 'Copy' },
      ],
    },
    {
      label: 'click → copied state',
      action: 'click',
      target: BTN,
      expect: [
        { selector: BTN, read: 'data-copied', equals: 'true' },
        { selector: BTN, read: 'text', equals: 'Copied' },
      ],
    },
  ],
}
