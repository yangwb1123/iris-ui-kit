import type { ContractScenario } from '../types'

const CELL = '[data-iris-otp-input-cell]'

/**
 * Shared OTP-input Backspace-editing behavior. Each adapter mounts a 5-cell OTP
 * pre-filled with `"123"` (React/Solid uncontrolled `defaultValue`; Vue/Svelte a
 * model harness holding `"123"`), then runs this. The OTP keeps its value
 * contiguous (no interior gaps) and marks each filled cell with
 * `data-filled="true"` (absent when empty). Backspace on a filled cell removes
 * that character — the value contracts left — driven purely by `keydown` on the
 * `index`-th `[data-iris-otp-input-cell]` (the per-cell handler captures its own
 * index, so it works without relying on focus). Asserts the four adapters share
 * identical contiguous-edit semantics.
 */
export const otpInputScenario: ContractScenario = {
  name: 'OtpInput',
  description: 'Backspace on a filled OTP cell removes its char; the value stays contiguous.',
  steps: [
    {
      label: 'initial: first three cells filled',
      action: 'none',
      expect: [
        { selector: CELL, read: 'count', equals: 5 },
        { selector: CELL, index: 0, read: 'data-filled', equals: 'true' },
        { selector: CELL, index: 1, read: 'data-filled', equals: 'true' },
        { selector: CELL, index: 2, read: 'data-filled', equals: 'true' },
        { selector: CELL, index: 3, read: 'data-filled', equals: null },
      ],
    },
    {
      label: 'Backspace on cell 2 → its char removed (two filled remain)',
      action: 'keydown',
      target: CELL,
      index: 2,
      key: 'Backspace',
      expect: [
        { selector: CELL, index: 0, read: 'data-filled', equals: 'true' },
        { selector: CELL, index: 1, read: 'data-filled', equals: 'true' },
        { selector: CELL, index: 2, read: 'data-filled', equals: null },
      ],
    },
    {
      label: 'Backspace on cell 1 → only the first cell stays filled',
      action: 'keydown',
      target: CELL,
      index: 1,
      key: 'Backspace',
      expect: [
        { selector: CELL, index: 0, read: 'data-filled', equals: 'true' },
        { selector: CELL, index: 1, read: 'data-filled', equals: null },
      ],
    },
  ],
}
