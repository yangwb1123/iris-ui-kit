import { computed, defineComponent, h, ref, watch } from 'vue'
import {
  clamp01,
  hexToRgba,
  hsvaToRgba,
  rgbToHex,
  rgbaToHsva,
  type IrisHsva,
} from './colorUtils'

/**
 * Color picker. Renders:
 *   - Saturation/value 2D pad (pointer drag updates both axes)
 *   - Hue strip (vertical) for cycling the hue (0..360°)
 *   - Optional alpha strip
 *   - HEX text input + R/G/B/A numeric inputs
 *
 * Two-way binds `modelValue` as a HEX string (`#rgb` / `#rrggbb` / `#rrggbbaa`).
 */
export const IrisColorPicker = defineComponent({
  name: 'IrisColorPicker',
  inheritAttrs: false,
  props: {
    /** HEX string (`#rgb` / `#rrggbb` / `#rrggbbaa`). */
    modelValue: { type: String, default: '#000000' },
    /** Include the alpha strip + alpha input. Default false. */
    showAlpha: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  emits: {
    'update:modelValue': (_value: string) => true,
  },
  setup(props, { attrs, emit }) {
    const padRef = ref<HTMLElement | null>(null)
    const hueRef = ref<HTMLElement | null>(null)
    const alphaRef = ref<HTMLElement | null>(null)

    const initial = hexToRgba(props.modelValue) ?? { r: 0, g: 0, b: 0, a: 1 }
    const hsva = ref<IrisHsva>(rgbaToHsva(initial))

    // Re-sync internal hsva if modelValue changes from outside.
    watch(
      () => props.modelValue,
      (value) => {
        const parsed = hexToRgba(value)
        if (!parsed) return
        const next = rgbaToHsva(parsed)
        // Avoid losing the user's hue when the displayed RGB is grayscale by
        // only updating fields that actually differ.
        if (Math.abs(next.s - hsva.value.s) > 0.001) hsva.value.s = next.s
        if (Math.abs(next.v - hsva.value.v) > 0.001) hsva.value.v = next.v
        if (Math.abs(next.a - hsva.value.a) > 0.001) hsva.value.a = next.a
        if (next.s > 0 && Math.abs(next.h - hsva.value.h) > 0.5) hsva.value.h = next.h
      },
    )

    const rgba = computed(() => hsvaToRgba(hsva.value))
    const hex = computed(() => rgbToHex(rgba.value))

    const emitChange = () => {
      emit('update:modelValue', hex.value)
    }

    const updateHsva = (next: Partial<IrisHsva>) => {
      hsva.value = { ...hsva.value, ...next }
      emitChange()
    }

    const setRgbChannel = (key: 'r' | 'g' | 'b', value: number) => {
      const next = { ...rgba.value, [key]: Math.max(0, Math.min(255, Math.round(value))) }
      const newHsv = rgbaToHsva(next)
      hsva.value = newHsv
      emitChange()
    }

    const setAlpha = (value: number) => {
      updateHsva({ a: clamp01(value) })
    }

    const setHex = (value: string) => {
      const parsed = hexToRgba(value)
      if (!parsed) return
      hsva.value = rgbaToHsva(parsed)
      emitChange()
    }

    // Pointer dragging on the pad → update s/v.
    const onPadPointerDown = (event: PointerEvent) => {
      if (props.disabled) return
      const el = padRef.value
      if (!el) return
      el.setPointerCapture?.(event.pointerId)
      updateFromPadEvent(event)
    }
    const onPadPointerMove = (event: PointerEvent) => {
      if (props.disabled) return
      if (event.buttons !== 1) return
      updateFromPadEvent(event)
    }
    const updateFromPadEvent = (event: PointerEvent) => {
      const el = padRef.value
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = clamp01((event.clientX - rect.left) / Math.max(1, rect.width))
      const y = clamp01((event.clientY - rect.top) / Math.max(1, rect.height))
      updateHsva({ s: x, v: 1 - y })
    }

    // Hue strip drag → update h.
    const onHuePointerDown = (event: PointerEvent) => {
      if (props.disabled) return
      const el = hueRef.value
      if (!el) return
      el.setPointerCapture?.(event.pointerId)
      updateFromHueEvent(event)
    }
    const onHuePointerMove = (event: PointerEvent) => {
      if (props.disabled) return
      if (event.buttons !== 1) return
      updateFromHueEvent(event)
    }
    const updateFromHueEvent = (event: PointerEvent) => {
      const el = hueRef.value
      if (!el) return
      const rect = el.getBoundingClientRect()
      const y = clamp01((event.clientY - rect.top) / Math.max(1, rect.height))
      updateHsva({ h: y * 360 })
    }

    // Alpha strip drag.
    const onAlphaPointerDown = (event: PointerEvent) => {
      if (props.disabled) return
      const el = alphaRef.value
      if (!el) return
      el.setPointerCapture?.(event.pointerId)
      updateFromAlphaEvent(event)
    }
    const onAlphaPointerMove = (event: PointerEvent) => {
      if (props.disabled) return
      if (event.buttons !== 1) return
      updateFromAlphaEvent(event)
    }
    const updateFromAlphaEvent = (event: PointerEvent) => {
      const el = alphaRef.value
      if (!el) return
      const rect = el.getBoundingClientRect()
      const y = clamp01((event.clientY - rect.top) / Math.max(1, rect.height))
      updateHsva({ a: y })
    }

    return () => {
      const hueRgb = hsvaToRgba({ h: hsva.value.h, s: 1, v: 1, a: 1 })
      const cursorX = hsva.value.s * 100
      const cursorY = (1 - hsva.value.v) * 100
      const hueY = (hsva.value.h / 360) * 100
      const alphaY = (1 - hsva.value.a) * 100

      const inputStyle: Record<string, string> = {
        width: '48px',
        height: '24px',
        padding: '2px 4px',
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-sm, 4px)',
        fontSize: '12px',
        fontFamily: 'inherit',
        textAlign: 'center',
      }

      return h(
        'div',
        {
          ...attrs,
          'data-iris-color-picker': '',
          'data-disabled': props.disabled ? 'true' : undefined,
          style: {
            display: 'inline-flex',
            flexDirection: 'column',
            gap: '8px',
            padding: 'var(--iris-padding-md, 12px)',
            background: 'var(--iris-surface)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-md, 6px)',
            color: 'var(--iris-foreground)',
            width: '240px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          h(
            'div',
            { style: { display: 'flex', gap: '8px' } },
            [
              // SV pad
              h(
                'div',
                {
                  ref: (el: unknown) => {
                    padRef.value = (el ?? null) as HTMLElement | null
                  },
                  'data-iris-color-picker-pad': '',
                  onPointerdown: onPadPointerDown,
                  onPointermove: onPadPointerMove,
                  style: {
                    position: 'relative',
                    flex: '1',
                    height: '160px',
                    borderRadius: 'var(--iris-radius-sm, 4px)',
                    background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, rgb(${hueRgb.r}, ${hueRgb.g}, ${hueRgb.b}))`,
                    cursor: props.disabled ? 'not-allowed' : 'crosshair',
                    touchAction: 'none',
                  },
                },
                [
                  h('div', {
                    'data-iris-color-picker-pad-cursor': '',
                    style: {
                      position: 'absolute',
                      left: `${cursorX}%`,
                      top: `${cursorY}%`,
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      transform: 'translate(-50%, -50%)',
                      border: '2px solid #fff',
                      boxShadow: '0 0 0 1px rgba(0,0,0,.4)',
                      pointerEvents: 'none',
                    },
                  }),
                ],
              ),
              // Hue strip
              h(
                'div',
                {
                  ref: (el: unknown) => {
                    hueRef.value = (el ?? null) as HTMLElement | null
                  },
                  'data-iris-color-picker-hue': '',
                  onPointerdown: onHuePointerDown,
                  onPointermove: onHuePointerMove,
                  style: {
                    position: 'relative',
                    width: '16px',
                    height: '160px',
                    borderRadius: 'var(--iris-radius-sm, 4px)',
                    background:
                      'linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
                    cursor: props.disabled ? 'not-allowed' : 'crosshair',
                    touchAction: 'none',
                  },
                },
                [
                  h('div', {
                    'data-iris-color-picker-hue-cursor': '',
                    style: {
                      position: 'absolute',
                      top: `${hueY}%`,
                      left: '-2px',
                      right: '-2px',
                      height: '4px',
                      transform: 'translateY(-50%)',
                      border: '2px solid #fff',
                      borderRadius: '2px',
                      boxShadow: '0 0 0 1px rgba(0,0,0,.4)',
                      pointerEvents: 'none',
                    },
                  }),
                ],
              ),
              props.showAlpha
                ? h(
                    'div',
                    {
                      ref: (el: unknown) => {
                        alphaRef.value = (el ?? null) as HTMLElement | null
                      },
                      'data-iris-color-picker-alpha': '',
                      onPointerdown: onAlphaPointerDown,
                      onPointermove: onAlphaPointerMove,
                      style: {
                        position: 'relative',
                        width: '16px',
                        height: '160px',
                        borderRadius: 'var(--iris-radius-sm, 4px)',
                        background: `linear-gradient(to bottom, rgba(${rgba.value.r},${rgba.value.g},${rgba.value.b},1) 0%, rgba(${rgba.value.r},${rgba.value.g},${rgba.value.b},0) 100%)`,
                        cursor: props.disabled ? 'not-allowed' : 'crosshair',
                        touchAction: 'none',
                      },
                    },
                    [
                      h('div', {
                        style: {
                          position: 'absolute',
                          top: `${alphaY}%`,
                          left: '-2px',
                          right: '-2px',
                          height: '4px',
                          transform: 'translateY(-50%)',
                          border: '2px solid #fff',
                          borderRadius: '2px',
                          boxShadow: '0 0 0 1px rgba(0,0,0,.4)',
                          pointerEvents: 'none',
                        },
                      }),
                    ],
                  )
                : null,
            ],
          ),
          // Inputs row
          h(
            'div',
            {
              style: {
                display: 'flex',
                gap: '6px',
                alignItems: 'center',
                fontSize: '12px',
              },
            },
            [
              h('input', {
                'data-iris-color-picker-hex': '',
                'aria-label': 'Hex',
                disabled: props.disabled || undefined,
                value: hex.value,
                onChange: (e: Event) => {
                  const input = e.target as HTMLInputElement
                  setHex(input.value)
                },
                style: { ...inputStyle, width: '90px' },
              }),
              h('input', {
                type: 'number',
                'data-iris-color-picker-r': '',
                'aria-label': 'Red',
                min: 0,
                max: 255,
                disabled: props.disabled || undefined,
                value: rgba.value.r,
                onInput: (e: Event) => {
                  setRgbChannel('r', Number((e.target as HTMLInputElement).value))
                },
                style: inputStyle,
              }),
              h('input', {
                type: 'number',
                'data-iris-color-picker-g': '',
                'aria-label': 'Green',
                min: 0,
                max: 255,
                disabled: props.disabled || undefined,
                value: rgba.value.g,
                onInput: (e: Event) => {
                  setRgbChannel('g', Number((e.target as HTMLInputElement).value))
                },
                style: inputStyle,
              }),
              h('input', {
                type: 'number',
                'data-iris-color-picker-b': '',
                'aria-label': 'Blue',
                min: 0,
                max: 255,
                disabled: props.disabled || undefined,
                value: rgba.value.b,
                onInput: (e: Event) => {
                  setRgbChannel('b', Number((e.target as HTMLInputElement).value))
                },
                style: inputStyle,
              }),
              props.showAlpha
                ? h('input', {
                    type: 'number',
                    'data-iris-color-picker-a': '',
                    'aria-label': 'Alpha',
                    min: 0,
                    max: 1,
                    step: 0.01,
                    disabled: props.disabled || undefined,
                    value: Number(hsva.value.a.toFixed(2)),
                    onInput: (e: Event) => {
                      setAlpha(Number((e.target as HTMLInputElement).value))
                    },
                    style: inputStyle,
                  })
                : null,
            ],
          ),
        ],
      )
    }
  },
})
