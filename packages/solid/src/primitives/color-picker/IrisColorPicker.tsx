import { createSignal, createMemo, mergeProps, splitProps, For, Show, type JSX } from 'solid-js'
import { type IrisHsva, hexToRgba, hsvaToRgba, rgbToHex, rgbaToHsva, clamp01 } from './colorUtils'
import { useI18n } from '../../i18n'

export interface IrisColorPickerProps {
  value?: string
  defaultValue?: string
  presets?: string[]
  disabled?: boolean
  onChange?: (hex: string) => void
}

const DEFAULT_PRESETS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#000000',
  '#6b7280',
  '#ffffff',
]

function hexToHsva(hex: string): IrisHsva {
  const rgba = hexToRgba(hex)
  if (!rgba) return { h: 0, s: 0, v: 1, a: 1 }
  return rgbaToHsva(rgba)
}

function hsvaToHex(hsva: IrisHsva): string {
  return rgbToHex(hsvaToRgba(hsva))
}

/**
 * Color picker with hue/saturation gradient, hex input, and presets.
 * Solid port of the Vue IrisColorPicker.
 */
export function IrisColorPicker(props: IrisColorPickerProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultValue: '#3b82f6',
      presets: DEFAULT_PRESETS,
      disabled: false,
    },
    props,
  )
  const [local] = splitProps(merged, ['value', 'defaultValue', 'presets', 'disabled', 'onChange'])

  const { t } = useI18n()

  const [internalHsva, setInternalHsva] = createSignal<IrisHsva>(
    hexToHsva(local.value ?? local.defaultValue),
  )
  const [hexInput, setHexInput] = createSignal(local.value ?? local.defaultValue)

  const currentHsva = (): IrisHsva =>
    local.value !== undefined ? hexToHsva(local.value) : internalHsva()

  const currentHex = createMemo(() => hsvaToHex(currentHsva()))

  const emit = (hsva: IrisHsva) => {
    const hex = hsvaToHex(hsva)
    if (local.value === undefined) setInternalHsva(hsva)
    setHexInput(hex)
    local.onChange?.(hex)
  }

  // Saturation-value gradient interaction
  let svRef: HTMLDivElement | undefined
  const onSvMouseDown = (e: MouseEvent) => {
    if (local.disabled) return
    const rect = svRef!.getBoundingClientRect()
    const move = (ev: MouseEvent) => {
      const s = clamp01((ev.clientX - rect.left) / rect.width)
      const v = clamp01(1 - (ev.clientY - rect.top) / rect.height)
      emit({ ...currentHsva(), s, v })
    }
    move(e)
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  // Hue slider interaction
  let hueRef: HTMLDivElement | undefined
  const onHueMouseDown = (e: MouseEvent) => {
    if (local.disabled) return
    const rect = hueRef!.getBoundingClientRect()
    const move = (ev: MouseEvent) => {
      const h = clamp01((ev.clientX - rect.left) / rect.width) * 360
      emit({ ...currentHsva(), h })
    }
    move(e)
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  const onHexInput = (e: Event) => {
    const val = (e.target as HTMLInputElement).value
    setHexInput(val)
    const rgba = hexToRgba(val)
    if (rgba) {
      const hsva = rgbaToHsva(rgba)
      if (local.value === undefined) setInternalHsva(hsva)
      local.onChange?.(rgbToHex(rgba))
    }
  }

  return (
    <div
      data-iris-color-picker=""
      data-disabled={local.disabled ? '' : undefined}
      style={{
        display: 'inline-flex',
        'flex-direction': 'column',
        gap: '10px',
        padding: '12px',
        background: 'var(--iris-surface)',
        border: '1px solid var(--iris-border)',
        'border-radius': 'var(--iris-radius-md, 6px)',
        'min-width': '240px',
        'user-select': 'none',
      }}
    >
      {/* Saturation/Value gradient */}
      <div
        ref={(el) => {
          svRef = el
        }}
        data-iris-color-picker-sv=""
        onMouseDown={onSvMouseDown}
        style={{
          position: 'relative',
          height: '160px',
          'border-radius': 'var(--iris-radius-sm, 4px)',
          background: `hsl(${currentHsva().h}, 100%, 50%)`,
          cursor: local.disabled ? 'not-allowed' : 'crosshair',
          overflow: 'hidden',
        }}
      >
        {/* White gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: '0',
            background: 'linear-gradient(to right, #fff 0%, transparent 100%)',
          }}
        />
        {/* Black gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: '0',
            background: 'linear-gradient(to bottom, transparent 0%, #000 100%)',
          }}
        />
        {/* Cursor */}
        <div
          style={{
            position: 'absolute',
            left: `${currentHsva().s * 100}%`,
            top: `${(1 - currentHsva().v) * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: '12px',
            height: '12px',
            'border-radius': '50%',
            border: '2px solid #fff',
            'box-shadow': '0 1px 3px rgba(0,0,0,0.4)',
            background: currentHex(),
            'pointer-events': 'none',
          }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={(el) => {
          hueRef = el
        }}
        data-iris-color-picker-hue=""
        onMouseDown={onHueMouseDown}
        style={{
          position: 'relative',
          height: '14px',
          'border-radius': '7px',
          background:
            'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
          cursor: local.disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `${(currentHsva().h / 360) * 100}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '14px',
            height: '14px',
            'border-radius': '50%',
            border: '2px solid #fff',
            'box-shadow': '0 1px 3px rgba(0,0,0,0.4)',
            background: `hsl(${currentHsva().h}, 100%, 50%)`,
            'pointer-events': 'none',
          }}
        />
      </div>

      {/* Hex input + swatch */}
      <div style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            'border-radius': 'var(--iris-radius-sm, 4px)',
            background: currentHex(),
            border: '1px solid var(--iris-border)',
            'flex-shrink': '0',
          }}
        />
        <input
          type="text"
          data-iris-color-picker-hex=""
          aria-label={t('colorPicker.hex')}
          value={hexInput()}
          onInput={onHexInput}
          disabled={local.disabled || undefined}
          maxLength={9}
          style={{
            flex: '1',
            padding: '4px 8px',
            background: 'transparent',
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-sm, 4px)',
            color: 'var(--iris-foreground)',
            'font-size': '13px',
            'font-family': 'monospace',
            outline: 'none',
          }}
        />
      </div>

      {/* Presets */}
      <Show when={local.presets.length > 0}>
        <div
          data-iris-color-picker-presets=""
          style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '4px' }}
        >
          <For each={local.presets}>
            {(preset) => (
              <button
                type="button"
                data-iris-color-picker-preset={preset}
                data-active={
                  currentHex().toLowerCase() === preset.toLowerCase() ? 'true' : undefined
                }
                disabled={local.disabled || undefined}
                title={preset}
                onClick={() => {
                  const rgba = hexToRgba(preset)
                  if (!rgba) return
                  emit(rgbaToHsva(rgba))
                  setHexInput(preset)
                }}
                style={{
                  width: '20px',
                  height: '20px',
                  'border-radius': '3px',
                  background: preset,
                  border:
                    currentHex().toLowerCase() === preset.toLowerCase()
                      ? '2px solid var(--iris-primary)'
                      : '1px solid var(--iris-border)',
                  cursor: local.disabled ? 'not-allowed' : 'pointer',
                  padding: '0',
                }}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
