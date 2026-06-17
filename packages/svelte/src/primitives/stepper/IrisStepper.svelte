<script lang="ts">
  import { setStepperContext, type IrisStepperOrientation, type IrisStepStatus } from './context'

  let {
    value = undefined,
    defaultValue = 0,
    orientation = 'horizontal',
    linear = true,
    onchange,
    children,
    style,
    ...rest
  }: {
    value?: number
    defaultValue?: number
    orientation?: IrisStepperOrientation
    linear?: boolean
    onchange?: (value: number) => void
    children?: import('svelte').Snippet
    style?: string
    [key: string]: unknown
  } = $props()

  // Controlled when `value` is supplied; otherwise self-manage from defaultValue.
  const isControlled = $derived(value !== undefined)
  // svelte-ignore state_referenced_locally
  let internal = $state(defaultValue)
  let stepCount = $state(0)
  const raw = $derived(isControlled ? (value as number) : internal)
  const current = $derived(Math.max(0, Math.min(Math.max(0, stepCount - 1), raw)))

  function registerStep(): number {
    const idx = stepCount
    stepCount += 1
    return idx
  }

  function unregisterStep(): void {
    // no-op for static step lists
  }

  function computeStatus(index: number): IrisStepStatus {
    if (index < current) return 'completed'
    if (index === current) return 'active'
    return 'pending'
  }

  function goTo(index: number): void {
    if (index < 0 || index >= stepCount) return
    if (linear && index > current) return
    if (index === current) return
    // Uncontrolled: advance internal state. Controlled: emit only (parent owns
    // state). Mirrors React/Solid and the fixed Accordion.
    if (!isControlled) internal = index
    onchange?.(index)
  }

  setStepperContext({
    get current() {
      return current
    },
    get total() {
      return stepCount
    },
    get orientation() {
      return orientation
    },
    get linear() {
      return linear
    },
    registerStep,
    unregisterStep,
    goTo,
    computeStatus,
  })
</script>

<ol
  {...rest}
  data-iris-stepper
  data-iris-stepper-orientation={orientation}
  role="list"
  style="display:flex; flex-direction:{orientation === 'horizontal'
    ? 'row'
    : 'column'}; gap:0; margin:0; padding:0; list-style:none;{style ? ' ' + style : ''}"
>
  {@render children?.()}
</ol>
