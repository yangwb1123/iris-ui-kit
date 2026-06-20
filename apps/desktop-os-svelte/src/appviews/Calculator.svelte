<script lang="ts">
  /**
   * A working calculator implemented as a small state machine (no `eval`) — the
   * Svelte 5 twin of the React `CalculatorApp`. The whole calculator state lives
   * in a single `$state` object; the keypad dispatches keys through `reducer`.
   */
  import { IrisButton } from '@iris-ui/svelte'

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

  function inputDigit(s: CalcState, digit: string): CalcState {
    if (s.resetNext) return { ...s, display: digit, resetNext: false }
    if (s.display === '0') return { ...s, display: digit }
    return { ...s, display: s.display + digit }
  }

  function inputDot(s: CalcState): CalcState {
    if (s.resetNext) return { ...s, display: '0.', resetNext: false }
    if (s.display.includes('.')) return s
    return { ...s, display: s.display + '.' }
  }

  function negate(s: CalcState): CalcState {
    if (s.display === '0') return s
    const flipped = s.display.startsWith('-') ? s.display.slice(1) : '-' + s.display
    return { ...s, display: flipped }
  }

  function inputOperator(s: CalcState, op: Op): CalcState {
    const current = Number(s.display)
    if (s.accumulator !== null && s.op !== null && !s.resetNext) {
      const result = apply(s.accumulator, s.op, current)
      return { display: format(result), accumulator: result, op, resetNext: true }
    }
    return { ...s, accumulator: current, op, resetNext: true }
  }

  function equals(s: CalcState): CalcState {
    if (s.accumulator === null || s.op === null) return { ...s, resetNext: true }
    const result = apply(s.accumulator, s.op, Number(s.display))
    return { display: format(result), accumulator: null, op: null, resetNext: true }
  }

  function isOp(key: string): key is Op {
    return key === '+' || key === '−' || key === '×' || key === '÷'
  }

  function reducer(s: CalcState, key: string): CalcState {
    if (s.display === 'Error' && key !== 'C') return s
    if (key === 'C') return INITIAL
    if (/^[0-9]$/.test(key)) return inputDigit(s, key)
    if (key === '.') return inputDot(s)
    if (key === '±') return negate(s)
    if (key === '%') return { ...s, display: format(Number(s.display) / 100), resetNext: true }
    if (isOp(key)) return inputOperator(s, key)
    if (key === '=') return equals(s)
    return s
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

  let state = $state<CalcState>(INITIAL)

  function dispatch(key: string): void {
    state = reducer(state, key)
  }
</script>

<div class="calc">
  <div class="display" aria-live="polite">{state.display}</div>
  <div class="keypad">
    {#each LAYOUT as b (b.label)}
      <IrisButton
        variant={b.variant}
        onclick={() => dispatch(b.key)}
        style={b.label === '0' ? 'grid-column: span 2; min-height: 0' : 'min-height: 0'}
      >
        {b.label}
      </IrisButton>
    {/each}
  </div>
</div>

<style>
  .calc {
    padding: 16px;
    display: grid;
    gap: 12px;
    height: 100%;
    box-sizing: border-box;
    grid-template-rows: auto 1fr;
    color: var(--os-window-fg);
  }
  .display {
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
  .keypad {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
</style>
