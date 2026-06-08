<script lang="ts">
  import { hexToRgba, hsvaToRgba, rgbToHex, rgbaToHsva, clamp01 } from './colorUtils'
  import type { IrisHsva } from './colorUtils'

  interface Props {
    value?: string
    presets?: string[]
    disabled?: boolean
    onValueChange?: (hex: string) => void
    style?: string
    class?: string
  }

  let {
    value = '#3b82f6',
    presets = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#000000','#ffffff'],
    disabled = false,
    onValueChange,
    style,
    class: className,
    ...rest
  }: Props = $props()

  function parseValue(hex: string): IrisHsva {
    const rgba = hexToRgba(hex)
    if (!rgba) return { h: 0, s: 0, v: 1, a: 1 }
    return rgbaToHsva(rgba)
  }

  // svelte-ignore state_referenced_locally
  let hsva = $state<IrisHsva>(parseValue(value))
  let hexInput = $state(value)

  $effect(() => {
    const rgba = hsvaToRgba(hsva)
    const hex = rgbToHex(rgba)
    hexInput = hex
    onValueChange?.(hex)
  })

  $effect(() => {
    const parsed = parseValue(value)
    if (parsed) {
      hsva = parsed
      hexInput = value
    }
  })

  let satValEl = $state<HTMLDivElement | undefined>(undefined)
  let hueEl = $state<HTMLDivElement | undefined>(undefined)

  function onSatValPointer(e: PointerEvent) {
    if (disabled || !satValEl) return
    e.preventDefault()
    const rect = satValEl.getBoundingClientRect()
    const s = clamp01((e.clientX - rect.left) / rect.width)
    const v = clamp01(1 - (e.clientY - rect.top) / rect.height)
    hsva = { ...hsva, s, v }
  }

  function onHuePointer(e: PointerEvent) {
    if (disabled || !hueEl) return
    e.preventDefault()
    const rect = hueEl.getBoundingClientRect()
    const h = clamp01((e.clientX - rect.left) / rect.width) * 360
    hsva = { ...hsva, h }
  }

  function onHexInput(e: Event) {
    const val = (e.target as HTMLInputElement).value
    hexInput = val
    const parsed = hexToRgba(val)
    if (parsed) {
      hsva = rgbaToHsva(parsed)
    }
  }

  function applyPreset(hex: string) {
    if (disabled) return
    const parsed = hexToRgba(hex)
    if (parsed) {
      hsva = rgbaToHsva(parsed)
      hexInput = hex
      onValueChange?.(hex)
    }
  }

  // Computed display colors
  const hueColor = $derived(`hsl(${hsva.h}, 100%, 50%)`)
  const currentHex = $derived(rgbToHex(hsvaToRgba(hsva)))

  function onSatValMousedown(e: MouseEvent) {
    if (disabled) return
    const moveHandler = (me: PointerEvent) => onSatValPointer(me)
    const upHandler = () => {
      document.removeEventListener('pointermove', moveHandler)
      document.removeEventListener('pointerup', upHandler)
    }
    document.addEventListener('pointermove', moveHandler)
    document.addEventListener('pointerup', upHandler)
    onSatValPointer(e as unknown as PointerEvent)
  }

  function onHueMousedown(e: MouseEvent) {
    if (disabled) return
    const moveHandler = (me: PointerEvent) => onHuePointer(me)
    const upHandler = () => {
      document.removeEventListener('pointermove', moveHandler)
      document.removeEventListener('pointerup', upHandler)
    }
    document.addEventListener('pointermove', moveHandler)
    document.addEventListener('pointerup', upHandler)
    onHuePointer(e as unknown as PointerEvent)
  }
</script>

<div
  data-iris-color-picker
  data-disabled={disabled ? '' : undefined}
  style:display="inline-flex"
  style:flex-direction="column"
  style:gap="10px"
  style:padding="12px"
  style:border="1px solid var(--iris-border)"
  style:border-radius="var(--iris-radius-md, 6px)"
  style:background="var(--iris-background)"
  style:width="220px"
  style={style}
  class={className}
  {...rest}
>
  <!-- Saturation / Value picker -->
  <div
    bind:this={satValEl}
    data-iris-color-picker-satval
    onmousedown={onSatValMousedown}
    style:position="relative"
    style:height="140px"
    style:border-radius="var(--iris-radius-sm, 4px)"
    style:cursor={disabled ? 'not-allowed' : 'crosshair'}
    style:background={hueColor}
    style:overflow="hidden"
  >
    <!-- White gradient (left to right) -->
    <div style:position="absolute" style:inset="0" style:background="linear-gradient(to right, #fff, transparent)"></div>
    <!-- Black gradient (top to bottom) -->
    <div style:position="absolute" style:inset="0" style:background="linear-gradient(to bottom, transparent, #000)"></div>
    <!-- Cursor -->
    <div
      style:position="absolute"
      style:width="12px"
      style:height="12px"
      style:border-radius="50%"
      style:border="2px solid white"
      style:box-shadow="0 0 0 1px rgba(0,0,0,0.3)"
      style:transform="translate(-50%, -50%)"
      style:pointer-events="none"
      style:left={`${hsva.s * 100}%`}
      style:top={`${(1 - hsva.v) * 100}%`}
    ></div>
  </div>

  <!-- Hue slider -->
  <div
    bind:this={hueEl}
    data-iris-color-picker-hue
    onmousedown={onHueMousedown}
    style:position="relative"
    style:height="12px"
    style:border-radius="6px"
    style:cursor={disabled ? 'not-allowed' : 'pointer'}
    style:background="linear-gradient(to right, #f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"
  >
    <div
      style:position="absolute"
      style:top="50%"
      style:width="14px"
      style:height="14px"
      style:border-radius="50%"
      style:border="2px solid white"
      style:box-shadow="0 0 0 1px rgba(0,0,0,0.3)"
      style:transform="translate(-50%, -50%)"
      style:pointer-events="none"
      style:left={`${(hsva.h / 360) * 100}%`}
    ></div>
  </div>

  <!-- Hex input + swatch -->
  <div style:display="flex" style:align-items="center" style:gap="8px">
    <div
      data-iris-color-picker-swatch
      style:width="28px"
      style:height="28px"
      style:border-radius="var(--iris-radius-sm, 4px)"
      style:border="1px solid var(--iris-border)"
      style:background={currentHex}
      style:flex-shrink="0"
    ></div>
    <input
      type="text"
      value={hexInput}
      oninput={onHexInput}
      data-iris-color-picker-hex
      spellcheck={false}
      disabled={disabled}
      style:flex="1"
      style:padding="4px 8px"
      style:border="1px solid var(--iris-border)"
      style:border-radius="var(--iris-radius-sm, 4px)"
      style:background="var(--iris-background)"
      style:color="var(--iris-foreground)"
      style:font-size="12px"
      style:font-family="monospace"
      style:outline="none"
    />
  </div>

  <!-- Presets -->
  {#if presets.length > 0}
    <div
      data-iris-color-picker-presets
      style:display="flex"
      style:flex-wrap="wrap"
      style:gap="4px"
    >
      {#each presets as preset (preset)}
        <button
          type="button"
          aria-label={preset}
          onclick={() => applyPreset(preset)}
          disabled={disabled}
          style:width="20px"
          style:height="20px"
          style:border-radius="var(--iris-radius-sm, 4px)"
          style:border={currentHex === preset ? '2px solid var(--iris-primary)' : '1px solid var(--iris-border)'}
          style:background={preset}
          style:cursor={disabled ? 'not-allowed' : 'pointer'}
          style:padding="0"
        ></button>
      {/each}
    </div>
  {/if}
</div>
