import * as React from 'react'
import { clamp01, hexToRgba, hsvaToRgba, rgbToHex, rgbaToHsva, type IrisHsva } from './colorUtils'

export interface IrisColorPickerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /** HEX string (`#rgb` / `#rrggbb` / `#rrggbbaa`). */
  value?: string
  defaultValue?: string
  onChange?: (next: string) => void
  /** Include the alpha strip + alpha input. Default false. */
  showAlpha?: boolean
  disabled?: boolean
}

const inputStyle: React.CSSProperties = {
  width: 48,
  height: 24,
  padding: '2px 4px',
  background: 'var(--iris-background)',
  color: 'var(--iris-foreground)',
  border: '1px solid var(--iris-border)',
  borderRadius: 'var(--iris-radius-sm, 4px)',
  fontSize: 12,
  fontFamily: 'inherit',
  textAlign: 'center',
}

/**
 * Color picker: SV pad + hue strip (+ optional alpha) with HEX + R/G/B(/A) inputs.
 * Binds a HEX string (`#rgb` / `#rrggbb` / `#rrggbbaa`) via `value` / `onChange`.
 *
 * Internal state is HSVA so hue survives grayscale RGB (black/white) without resetting —
 * mirrors the Vue adapter; the math (`colorUtils`) is shared verbatim, framework-agnostic.
 */
export function IrisColorPicker({
  value,
  defaultValue,
  onChange,
  showAlpha = false,
  disabled = false,
  style,
  ...rest
}: IrisColorPickerProps): React.ReactElement {
  const initialHex = value ?? defaultValue ?? '#000000'
  const [hsva, setHsva] = React.useState<IrisHsva>(() =>
    rgbaToHsva(hexToRgba(initialHex) ?? { r: 0, g: 0, b: 0, a: 1 }),
  )
  const [hexDraft, setHexDraft] = React.useState<string | null>(null)

  const padRef = React.useRef<HTMLDivElement | null>(null)
  const hueRef = React.useRef<HTMLDivElement | null>(null)
  const alphaRef = React.useRef<HTMLDivElement | null>(null)

  // Re-sync internal HSVA when a controlled `value` changes from outside. Only
  // touch fields that meaningfully differ, and keep hue when the incoming color
  // is grayscale. Returning `prev` unchanged keeps the same reference, so React
  // skips the update and no render loop forms.
  React.useEffect(() => {
    if (value === undefined) return
    const parsed = hexToRgba(value)
    if (!parsed) return
    const next = rgbaToHsva(parsed)
    setHsva((prev) => {
      let changed = false
      const merged = { ...prev }
      if (Math.abs(next.s - prev.s) > 0.001) {
        merged.s = next.s
        changed = true
      }
      if (Math.abs(next.v - prev.v) > 0.001) {
        merged.v = next.v
        changed = true
      }
      if (Math.abs(next.a - prev.a) > 0.001) {
        merged.a = next.a
        changed = true
      }
      if (next.s > 0 && Math.abs(next.h - prev.h) > 0.5) {
        merged.h = next.h
        changed = true
      }
      return changed ? merged : prev
    })
  }, [value])

  const rgba = hsvaToRgba(hsva)
  const hex = rgbToHex(rgba)

  const commit = (nextHsva: IrisHsva) => {
    setHsva(nextHsva)
    onChange?.(rgbToHex(hsvaToRgba(nextHsva)))
  }
  const updateHsva = (patch: Partial<IrisHsva>) => commit({ ...hsva, ...patch })
  const setRgbChannel = (key: 'r' | 'g' | 'b', n: number) => {
    const next = { ...rgba, [key]: Math.max(0, Math.min(255, Math.round(n || 0))) }
    commit(rgbaToHsva(next))
  }
  const setHex = (raw: string) => {
    const parsed = hexToRgba(raw)
    if (!parsed) return
    commit(rgbaToHsva(parsed))
  }

  const fromPad = (e: React.PointerEvent) => {
    const el = padRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = clamp01((e.clientX - rect.left) / Math.max(1, rect.width))
    const y = clamp01((e.clientY - rect.top) / Math.max(1, rect.height))
    updateHsva({ s: x, v: 1 - y })
  }
  const fromHue = (e: React.PointerEvent) => {
    const el = hueRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const y = clamp01((e.clientY - rect.top) / Math.max(1, rect.height))
    updateHsva({ h: y * 360 })
  }
  const fromAlpha = (e: React.PointerEvent) => {
    const el = alphaRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const y = clamp01((e.clientY - rect.top) / Math.max(1, rect.height))
    updateHsva({ a: y })
  }
  const down = (fn: (e: React.PointerEvent) => void) => (e: React.PointerEvent) => {
    if (disabled) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    fn(e)
  }
  const move = (fn: (e: React.PointerEvent) => void) => (e: React.PointerEvent) => {
    if (disabled || e.buttons !== 1) return
    fn(e)
  }

  const hueRgb = hsvaToRgba({ h: hsva.h, s: 1, v: 1, a: 1 })
  const cursorX = hsva.s * 100
  const cursorY = (1 - hsva.v) * 100
  const hueY = (hsva.h / 360) * 100
  const alphaY = (1 - hsva.a) * 100

  return (
    <div
      {...rest}
      data-iris-color-picker=""
      data-disabled={disabled ? 'true' : undefined}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 8,
        padding: 'var(--iris-padding-md, 12px)',
        background: 'var(--iris-surface)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        color: 'var(--iris-foreground)',
        width: 240,
        ...style,
      }}
    >
      <div style={{ display: 'flex', gap: 8 }}>
        <div
          ref={padRef}
          data-iris-color-picker-pad=""
          onPointerDown={down(fromPad)}
          onPointerMove={move(fromPad)}
          style={{
            position: 'relative',
            flex: 1,
            height: 160,
            borderRadius: 'var(--iris-radius-sm, 4px)',
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, rgb(${hueRgb.r}, ${hueRgb.g}, ${hueRgb.b}))`,
            cursor: disabled ? 'not-allowed' : 'crosshair',
            touchAction: 'none',
          }}
        >
          <div
            data-iris-color-picker-pad-cursor=""
            style={{
              position: 'absolute',
              left: `${cursorX}%`,
              top: `${cursorY}%`,
              width: 10,
              height: 10,
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              border: '2px solid #fff',
              boxShadow: '0 0 0 1px rgba(0,0,0,.4)',
              pointerEvents: 'none',
            }}
          />
        </div>
        <div
          ref={hueRef}
          data-iris-color-picker-hue=""
          onPointerDown={down(fromHue)}
          onPointerMove={move(fromHue)}
          style={{
            position: 'relative',
            width: 16,
            height: 160,
            borderRadius: 'var(--iris-radius-sm, 4px)',
            background:
              'linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
            cursor: disabled ? 'not-allowed' : 'crosshair',
            touchAction: 'none',
          }}
        >
          <div
            data-iris-color-picker-hue-cursor=""
            style={{
              position: 'absolute',
              top: `${hueY}%`,
              left: -2,
              right: -2,
              height: 4,
              transform: 'translateY(-50%)',
              border: '2px solid #fff',
              borderRadius: 2,
              boxShadow: '0 0 0 1px rgba(0,0,0,.4)',
              pointerEvents: 'none',
            }}
          />
        </div>
        {showAlpha ? (
          <div
            ref={alphaRef}
            data-iris-color-picker-alpha=""
            onPointerDown={down(fromAlpha)}
            onPointerMove={move(fromAlpha)}
            style={{
              position: 'relative',
              width: 16,
              height: 160,
              borderRadius: 'var(--iris-radius-sm, 4px)',
              background: `linear-gradient(to bottom, rgba(${rgba.r},${rgba.g},${rgba.b},1) 0%, rgba(${rgba.r},${rgba.g},${rgba.b},0) 100%)`,
              cursor: disabled ? 'not-allowed' : 'crosshair',
              touchAction: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: `${alphaY}%`,
                left: -2,
                right: -2,
                height: 4,
                transform: 'translateY(-50%)',
                border: '2px solid #fff',
                borderRadius: 2,
                boxShadow: '0 0 0 1px rgba(0,0,0,.4)',
                pointerEvents: 'none',
              }}
            />
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
        <input
          data-iris-color-picker-hex=""
          aria-label="Hex"
          disabled={disabled}
          value={hexDraft ?? hex}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={() => {
            if (hexDraft != null) {
              setHex(hexDraft)
              setHexDraft(null)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && hexDraft != null) {
              setHex(hexDraft)
              setHexDraft(null)
            }
          }}
          style={{ ...inputStyle, width: 90 }}
        />
        <input
          type="number"
          data-iris-color-picker-r=""
          aria-label="Red"
          min={0}
          max={255}
          disabled={disabled}
          value={rgba.r}
          onChange={(e) => setRgbChannel('r', Number(e.target.value))}
          style={inputStyle}
        />
        <input
          type="number"
          data-iris-color-picker-g=""
          aria-label="Green"
          min={0}
          max={255}
          disabled={disabled}
          value={rgba.g}
          onChange={(e) => setRgbChannel('g', Number(e.target.value))}
          style={inputStyle}
        />
        <input
          type="number"
          data-iris-color-picker-b=""
          aria-label="Blue"
          min={0}
          max={255}
          disabled={disabled}
          value={rgba.b}
          onChange={(e) => setRgbChannel('b', Number(e.target.value))}
          style={inputStyle}
        />
        {showAlpha ? (
          <input
            type="number"
            data-iris-color-picker-a=""
            aria-label="Alpha"
            min={0}
            max={1}
            step={0.01}
            disabled={disabled}
            value={Number(hsva.a.toFixed(2))}
            onChange={(e) => updateHsva({ a: clamp01(Number(e.target.value)) })}
            style={inputStyle}
          />
        ) : null}
      </div>
    </div>
  )
}
