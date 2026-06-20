import { For, createSignal, type JSX } from 'solid-js'
import { IrisButton } from '@iris-ui/solid'

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

const INITIAL: CalcState = { display: '0', accumulator: null, op: null, resetNext: true }

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

function inputDigit(state: CalcState, digit: string): CalcState {
  if (state.resetNext) return { ...state, display: digit, resetNext: false }
  if (state.display === '0') return { ...state, display: digit }
  return { ...state, display: state.display + digit }
}

function inputDot(state: CalcState): CalcState {
  if (state.resetNext) return { ...state, display: '0.', resetNext: false }
  if (state.display.includes('.')) return state
  return { ...state, display: state.display + '.' }
}

function negate(state: CalcState): CalcState {
  if (state.display === '0') return state
  const flipped = state.display.startsWith('-') ? state.display.slice(1) : '-' + state.display
  return { ...state, display: flipped }
}

function inputOperator(state: CalcState, op: Op): CalcState {
  const current = Number(state.display)
  if (state.accumulator !== null && state.op !== null && !state.resetNext) {
    const result = apply(state.accumulator, state.op, current)
    return { display: format(result), accumulator: result, op, resetNext: true }
  }
  return { ...state, accumulator: current, op, resetNext: true }
}

function equals(state: CalcState): CalcState {
  if (state.accumulator === null || state.op === null) return { ...state, resetNext: true }
  const result = apply(state.accumulator, state.op, Number(state.display))
  return { display: format(result), accumulator: null, op: null, resetNext: true }
}

function isOp(key: string): key is Op {
  return key === '+' || key === '−' || key === '×' || key === '÷'
}

/** Pure state transition for a key press — the same machine the React demo uses. */
function reduce(state: CalcState, key: string): CalcState {
  if (state.display === 'Error' && key !== 'C') return state
  if (key === 'C') return INITIAL
  if (/^[0-9]$/.test(key)) return inputDigit(state, key)
  if (key === '.') return inputDot(state)
  if (key === '±') return negate(state)
  if (key === '%')
    return { ...state, display: format(Number(state.display) / 100), resetNext: true }
  if (isOp(key)) return inputOperator(state, key)
  if (key === '=') return equals(state)
  return state
}

const LAYOUT: { label: string; key: string; variant?: 'solid' | 'outline' | 'ghost' }[] = [
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

/** A working calculator implemented as a small state machine (no `eval`). */
export function CalculatorApp(): JSX.Element {
  const [state, setState] = createSignal(INITIAL)
  const dispatch = (key: string): void => {
    setState((prev) => reduce(prev, key))
  }

  return (
    <div
      style={{
        padding: '16px',
        display: 'grid',
        gap: '12px',
        height: '100%',
        'box-sizing': 'border-box',
        'grid-template-rows': 'auto 1fr',
        color: 'var(--os-window-fg)',
      }}
    >
      <div
        aria-live="polite"
        style={{
          'text-align': 'right',
          font: '600 32px/1.2 ui-monospace, monospace',
          padding: '14px 16px',
          'border-radius': '10px',
          background: 'rgba(127,127,127,0.12)',
          overflow: 'hidden',
          'text-overflow': 'ellipsis',
        }}
      >
        {state().display}
      </div>
      <div
        style={{
          display: 'grid',
          'grid-template-columns': 'repeat(4, 1fr)',
          gap: '8px',
        }}
      >
        <For each={LAYOUT}>
          {(b) => (
            <IrisButton
              variant={b.variant}
              onClick={() => dispatch(b.key)}
              style={{
                'grid-column': b.label === '0' ? 'span 2' : undefined,
                'min-height': '0',
              }}
            >
              {b.label}
            </IrisButton>
          )}
        </For>
      </div>
    </div>
  )
}
