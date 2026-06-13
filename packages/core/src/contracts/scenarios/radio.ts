import type { ContractScenario } from '../types'

const RADIO = '[data-iris-radio]'
/** The hidden native control each radio wraps — the reliable click target. */
const INPUT = '[data-iris-radio] input'

/**
 * Shared RadioGroup behavior. Each adapter mounts a group of three radios
 * (values `a`/`b`/`c`) with the first checked by default (React/Solid `defaultValue`;
 * Vue/Svelte via a model harness seeded to `'a'`), then runs this. Each radio
 * wrapper exposes `data-state` (`checked`/`unchecked`) derived from the shared
 * single-selection model. Clicking a DISTINCT radio's native `<input>` checks it
 * and auto-unchecks the previously-selected sibling — asserting the four adapters
 * drive the same selection-model migration. Re-clicking the active radio is never
 * exercised (radios never toggle off), keeping the contract unambiguous.
 */
export const radioScenario: ContractScenario = {
  name: 'Radio',
  description:
    'Single-selection: clicking a radio checks it (data-state) and unchecks the prior sibling.',
  steps: [
    {
      label: 'initial: first checked',
      action: 'none',
      expect: [
        { selector: RADIO, read: 'count', equals: 3 },
        { selector: RADIO, index: 0, read: 'data-state', equals: 'checked' },
        { selector: RADIO, index: 1, read: 'data-state', equals: 'unchecked' },
        { selector: RADIO, index: 2, read: 'data-state', equals: 'unchecked' },
      ],
    },
    {
      label: 'click second → selection moves',
      action: 'click',
      target: INPUT,
      index: 1,
      expect: [
        { selector: RADIO, index: 1, read: 'data-state', equals: 'checked' },
        { selector: RADIO, index: 0, read: 'data-state', equals: 'unchecked' },
      ],
    },
    {
      label: 'click third → selection moves',
      action: 'click',
      target: INPUT,
      index: 2,
      expect: [
        { selector: RADIO, index: 2, read: 'data-state', equals: 'checked' },
        { selector: RADIO, index: 1, read: 'data-state', equals: 'unchecked' },
      ],
    },
  ],
}
