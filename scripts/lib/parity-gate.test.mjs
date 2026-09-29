/**
 * The parity ratchet must block capability loss without punishing capability
 * *gain*. Both move the shared **ratio** down, so the ratio alone cannot tell
 * them apart — the gate blocks on the shared-name count instead.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyParity } from './parity-gate.mjs'

test('losing a shared prop name blocks', () => {
  const { regressions, notes } = classifyParity(
    { componentRatios: { IrisCard: 0.5 }, componentShared: { IrisCard: 3 } },
    { componentRatios: { IrisCard: 0.5 }, componentShared: { IrisCard: 4 } },
  )
  assert.equal(regressions.length, 1)
  assert.match(regressions[0], /shared prop names lost/)
  assert.deepEqual(notes, [])
})

test('one adapter gaining idiomatic props is a note, not a regression', () => {
  // The real IrisRadio case: React gained `checked`/`defaultChecked`/`onChange`
  // for standalone use, Vue spells its equivalent `modelValue`, so the union
  // grew while the shared count stayed at 2.
  const { regressions, notes } = classifyParity(
    { componentRatios: { IrisRadio: 0.17 }, componentShared: { IrisRadio: 2 } },
    { componentRatios: { IrisRadio: 0.18 }, componentShared: { IrisRadio: 2 } },
  )
  assert.deepEqual(regressions, [])
  assert.equal(notes.length, 1)
  assert.match(notes[0], /shared names held at 2/)
})

test('a legacy baseline without componentShared keeps blocking on the ratio', () => {
  const { regressions } = classifyParity(
    { componentRatios: { IrisCard: 0.4 }, componentShared: { IrisCard: 2 } },
    { componentRatios: { IrisCard: 0.5 } },
  )
  assert.equal(regressions.length, 1)
  assert.match(regressions[0], /shared props decreased/)
})

test('improvement and unrelated components are silent', () => {
  const { regressions, notes } = classifyParity(
    { componentRatios: { IrisCard: 0.6, IrisTag: 0.4 }, componentShared: { IrisCard: 5, IrisTag: 2 } },
    { componentRatios: { IrisCard: 0.5 }, componentShared: { IrisCard: 4 } },
  )
  assert.deepEqual(regressions, [])
  assert.deepEqual(notes, [])
})
