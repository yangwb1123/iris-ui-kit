<script setup lang="ts">
/**
 * A working calculator implemented as a small state machine (no `eval`) — the
 * Vue twin of the React `CalculatorApp`. State lives in this component instance
 * (i.e. per window) via reactive refs.
 */
import { reactive } from 'vue'
import { IrisButton } from '@iris-ui-kit/vue'

type Op = '+' | '−' | '×' | '÷'

interface CalcState {
  /** The string currently shown on the display. */
  display: string
  /** The pending left-hand operand (already entered before an operator). */
  accumulator: number | null
  /** The pending operator awaiting its right-hand operand. */
  op: Op | null
  /** True when the next digit should start a fresh entry (after op / equals). */
  resetNext: boolean
}

const state = reactive<CalcState>({ display: '0', accumulator: null, op: null, resetNext: true })

function reset(): void {
  state.display = '0'
  state.accumulator = null
  state.op = null
  state.resetNext = true
}

function apply(a: number, op: Op, b: number): number {
  switch (op) {
    case '+':
      return a + b
    case '−':
      return a - b
    case '×':
      return a * b
    case '÷':
      return b === 0 ? NaN : a / b
  }
}

/** Trim float noise (e.g. 0.1 + 0.2) without depending on a math lib. */
function format(n: number): string {
  if (!Number.isFinite(n)) return 'Error'
  return String(Math.round(n * 1e10) / 1e10)
}

function inputDigit(digit: string): void {
  if (state.resetNext) {
    state.display = digit
    state.resetNext = false
  } else if (state.display === '0') {
    state.display = digit
  } else {
    state.display += digit
  }
}

function inputDot(): void {
  if (state.resetNext) {
    state.display = '0.'
    state.resetNext = false
  } else if (!state.display.includes('.')) {
    state.display += '.'
  }
}

function negate(): void {
  if (state.display === '0') return
  state.display = state.display.startsWith('-') ? state.display.slice(1) : '-' + state.display
}

function inputOperator(op: Op): void {
  const current = Number(state.display)
  if (state.accumulator !== null && state.op !== null && !state.resetNext) {
    const result = apply(state.accumulator, state.op, current)
    state.display = format(result)
    state.accumulator = result
  } else {
    state.accumulator = current
  }
  state.op = op
  state.resetNext = true
}

function equals(): void {
  if (state.accumulator === null || state.op === null) {
    state.resetNext = true
    return
  }
  const result = apply(state.accumulator, state.op, Number(state.display))
  state.display = format(result)
  state.accumulator = null
  state.op = null
  state.resetNext = true
}

function isOp(key: string): key is Op {
  return key === '+' || key === '−' || key === '×' || key === '÷'
}

/** The single key dispatcher — the Vue equivalent of the React reducer. */
function dispatch(key: string): void {
  if (state.display === 'Error' && key !== 'C') return
  if (key === 'C') return reset()
  if (/^[0-9]$/.test(key)) return inputDigit(key)
  if (key === '.') return inputDot()
  if (key === '±') return negate()
  if (key === '%') {
    state.display = format(Number(state.display) / 100)
    state.resetNext = true
    return
  }
  if (isOp(key)) return inputOperator(key)
  if (key === '=') return equals()
}

const LAYOUT: { label: string; key: string; variant: 'solid' | 'outline' | 'ghost' }[] = [
  { label: 'C', key: 'C', variant: 'outline' },
  { label: '±', key: '±', variant: 'outline' },
  { label: '%', key: '%', variant: 'outline' },
  { label: '÷', key: '÷', variant: 'solid' },
  { label: '7', key: '7', variant: 'ghost' },
  { label: '8', key: '8', variant: 'ghost' },
  { label: '9', key: '9', variant: 'ghost' },
  { label: '×', key: '×', variant: 'solid' },
  { label: '4', key: '4', variant: 'ghost' },
  { label: '5', key: '5', variant: 'ghost' },
  { label: '6', key: '6', variant: 'ghost' },
  { label: '−', key: '−', variant: 'solid' },
  { label: '1', key: '1', variant: 'ghost' },
  { label: '2', key: '2', variant: 'ghost' },
  { label: '3', key: '3', variant: 'ghost' },
  { label: '+', key: '+', variant: 'solid' },
  { label: '0', key: '0', variant: 'ghost' },
  { label: '.', key: '.', variant: 'ghost' },
  { label: '=', key: '=', variant: 'solid' },
]
</script>

<template>
  <div class="calc">
    <div class="calc-display" aria-live="polite">{{ state.display }}</div>
    <div class="calc-pad">
      <IrisButton
        v-for="b in LAYOUT"
        :key="b.label"
        :variant="b.variant"
        :class="{ wide: b.label === '0' }"
        @click="dispatch(b.key)"
      >
        {{ b.label }}
      </IrisButton>
    </div>
  </div>
</template>

<style scoped>
.calc {
  padding: 16px;
  display: grid;
  gap: 12px;
  height: 100%;
  box-sizing: border-box;
  grid-template-rows: auto 1fr;
  color: var(--os-window-fg);
}
.calc-display {
  text-align: right;
  font:
    600 32px/1.2 ui-monospace,
    monospace;
  padding: 14px 16px;
  border-radius: 10px;
  background: rgba(127, 127, 127, 0.12);
  overflow: hidden;
  text-overflow: ellipsis;
}
.calc-pad {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.calc-pad :deep(.wide) {
  grid-column: span 2;
}
</style>
