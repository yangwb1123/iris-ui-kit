<script lang="ts">
  import { setStepperContext, type IrisStepperOrientation, type IrisStepStatus } from './context'

  let {
    value = 0,
    orientation = 'horizontal',
    linear = true,
    onchange,
    children,
    style,
    ...rest
  }: {
    value?: number
    orientation?: IrisStepperOrientation
    linear?: boolean
    onchange?: (value: number) => void
    children?: import('svelte').Snippet
    style?: string
    [key: string]: unknown
  } = $props()

  let stepCount = $state(0)
  const current = $derived(Math.max(0, Math.min(Math.max(0, stepCount - 1), value)))

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
  style="display:flex; flex-direction:{orientation === 'horizontal' ? 'row' : 'column'}; gap:0; margin:0; padding:0; list-style:none;{style ? ' ' + style : ''}"
>
  {@render children?.()}
</ol>
