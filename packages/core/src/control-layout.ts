/**
 * Framework-agnostic layout decisions for the two places every app re-writes the
 * same CSS: the form field (label column + control sizing) and the dialog
 * surface (preset widths + viewport clamping).
 *
 * Both are *pure* — they take props and return plain style records the four
 * adapters bridge onto their `style` prop (React/Vue/Solid objects, Svelte a
 * serialized string). Nothing here touches the DOM, reads globals, or knows a
 * framework exists; that is the point: `IrisFormField` / `IrisDialogContent`
 * must lay out identically in react/vue/solid/svelte instead of each adapter
 * re-deriving "50rem for lg, clamp to the viewport, keep the label from
 * pushing the control out of the field".
 *
 * Two invariants the adapters must not re-implement:
 *
 *   1. **Invalid numeric dimensions reject.** `NaN` / `±Infinity` / negative
 *      numbers never reach the style object — they resolve to `undefined` and
 *      the caller falls back to its default. A `width={NaN}` renders exactly
 *      like no width at all, never `width: NaNpx`.
 *   2. **Default rendering is untouched.** `resolveFormFieldLayout({})` and
 *      `resolveDialogLayout({})` return the pre-existing styles verbatim, so
 *      adding these props cannot restyle anyone who doesn't pass them.
 */

/** A CSS length: `px` for finite non-negative numbers, or any CSS length string. */
export type LayoutLength = string | number

/** Inline style record; adapters cast it to their framework's CSSProperties. */
export type CssLayoutStyle = Record<string, string | undefined>

/**
 * Normalize a length prop to a CSS string. Finite non-negative numbers become
 * `px`; strings pass through trimmed; anything invalid (`NaN`, `±Infinity`,
 * negative numbers, blank strings, non-length values) returns `undefined` so
 * the caller keeps its default.
 */
export function normalizeLayoutLength(value: unknown): string | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? `${value}px` : undefined
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  return undefined
}

/** Fixed control floors must allow enlarged text to grow instead of clipping. */
export function resolveGrowableControlHeight(floor: LayoutLength): CssLayoutStyle {
  return { height: 'auto', minHeight: normalizeLayoutLength(floor), lineHeight: 'normal' }
}

/**
 * Convert a camelCase style record to CSS property names (`flexDirection` →
 * `flex-direction`), dropping `undefined` values. Solid assigns `style`
 * objects through `setProperty`, which only accepts hyphenated names — this
 * is the bridge that lets one core decision serve all four adapters. Custom
 * properties (`--x`) are passed through untouched.
 */
export function hyphenateLayoutStyle(style: CssLayoutStyle): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined) continue
    out[key.startsWith('--') ? key : key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)] = value
  }
  return out
}

/** Toast boxes own their padding/border budget without relying on a host reset. */
export function resolveToastBoxLayout() {
  return {
    viewport: { boxSizing: 'border-box' as const },
    toast: { boxSizing: 'border-box' as const, minWidth: 'min(280px, 100%)' },
  }
}

// ── Form field ─────────────────────────────────────────────────────────────────

/** Where the label sits relative to the control. `top` is the original layout. */
export type FormFieldLabelPlacement = 'top' | 'start'

/** Raw layout props shared by every adapter's `IrisFormField`. */
export interface FormFieldLayoutInput {
  labelPlacement?: FormFieldLabelPlacement
  labelWidth?: LayoutLength
  controlWidth?: LayoutLength
  fullWidth?: boolean
}

/** The style contract every adapter renders. */
export interface FormFieldLayout {
  /** Resolved placement (`top` unless `labelPlacement="start"`). */
  placement: FormFieldLabelPlacement
  /**
   * True when the control + hint/error must be emitted inside a control-area
   * wrapper. Required for the horizontal layout (help/error belong under the
   * control, not beside the label) and for control-width sizing; false for the
   * default vertical field, whose DOM stays exactly as it was.
   */
  grouped: boolean
  /** Style for the field root. */
  root: CssLayoutStyle
  /** Style merged onto the `<label>` (font/color stay the adapter's). */
  label: CssLayoutStyle
  /** Style for the control-area wrapper. Only rendered when `grouped`. */
  control: CssLayoutStyle
}

/** Preserved default gap of the vertical field (the pre-prop hard-coded value). */
const LEGACY_FIELD_GAP = '4px'
/** Horizontal fields breathe on the shared gap token instead. */
const ROW_FIELD_GAP = 'var(--iris-gap-md, 8px)'

/**
 * Resolve the form-field layout from the declarative props.
 *
 * `start` turns the field into a shrinkable row: the label can wrap and shrink
 * (`min-width: 0` + `overflow-wrap`), the control area grows from a zero basis
 * and carries the hint/error, and the root is `box-sizing: border-box` +
 * `min-width: 0` — so neither the label nor a long control can push content
 * outside the field.
 */
export function resolveFormFieldLayout(input: FormFieldLayoutInput): FormFieldLayout {
  const placement: FormFieldLabelPlacement = input.labelPlacement === 'start' ? 'start' : 'top'
  const labelWidth = normalizeLayoutLength(input.labelWidth)
  const controlWidth = normalizeLayoutLength(input.controlWidth)
  const fullWidth = input.fullWidth === true
  const horizontal = placement === 'start'
  // A control-area wrapper is needed whenever something has to be sized
  // separately from the label: the horizontal layout (so help/error stay under
  // the control) and every explicit control width.
  const grouped = horizontal || controlWidth !== undefined || fullWidth

  return {
    placement,
    grouped,
    root: fieldRootStyle({ horizontal, grouped, labelWidth, controlWidth, fullWidth }),
    label: fieldLabelStyle({
      horizontal,
      labelWidth,
      constrained: grouped || labelWidth !== undefined,
    }),
    control: fieldControlStyle(controlWidth),
  }
}

/** Style for the field root — the shrinkable box the whole field lives in. */
function fieldRootStyle(input: {
  horizontal: boolean
  grouped: boolean
  labelWidth: string | undefined
  controlWidth: string | undefined
  fullWidth: boolean
}): CssLayoutStyle {
  const { horizontal, grouped, labelWidth, controlWidth, fullWidth } = input
  const style: CssLayoutStyle = {
    display: 'flex',
    flexDirection: horizontal ? 'row' : 'column',
    gap: horizontal ? ROW_FIELD_GAP : LEGACY_FIELD_GAP,
  }
  // A vertical field with no sizing props renders exactly as it did before the
  // layout props existed; everything else opts into the shrinkable box model.
  if (grouped || labelWidth !== undefined) {
    style.boxSizing = 'border-box'
    style.minWidth = '0'
  }
  if (horizontal) style.alignItems = 'flex-start'
  if (fullWidth) style.width = '100%'
  // A vertical field has no control-area wrapper, so a requested control width
  // constrains the field column itself (label included). `fullWidth` still wins:
  // the field fills whatever its container gives it.
  if (controlWidth !== undefined && !horizontal) {
    if (!fullWidth) style.width = controlWidth
    style.maxWidth = '100%'
  }
  return style
}

/** Style merged onto the `<label>` — it wraps and yields instead of pushing. */
function fieldLabelStyle(input: {
  horizontal: boolean
  labelWidth: string | undefined
  constrained: boolean
}): CssLayoutStyle {
  const { horizontal, labelWidth, constrained } = input
  const style: CssLayoutStyle = {}
  if (constrained && !horizontal) {
    style.minWidth = '0'
    style.overflowWrap = 'anywhere'
    style.maxWidth = '100%'
  }
  if (horizontal) {
    style.flex = '0 1 auto'
    style.minWidth = '0'
    style.flexWrap = 'wrap'
    style.overflowWrap = 'anywhere'
  }
  if (labelWidth !== undefined) {
    // A width on a shrinkable label: it wraps at that width and still yields
    // when the field itself is narrower.
    style.width = labelWidth
    style.flex = '0 1 auto'
    style.maxWidth = '100%'
  }
  return style
}

/** Style for the control-area wrapper that carries the control + hint/error. */
function fieldControlStyle(controlWidth: string | undefined): CssLayoutStyle {
  const style: CssLayoutStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: LEGACY_FIELD_GAP,
    boxSizing: 'border-box',
    minWidth: '0',
    maxWidth: '100%',
    // Grow from a zero basis so the label keeps its natural width and the
    // control takes the rest; shrink instead of overflowing when space is short.
    flex: '1 1 0',
  }
  if (controlWidth !== undefined) {
    style.flex = '0 1 auto'
    style.width = controlWidth
  }
  return style
}

// ── Dialog ─────────────────────────────────────────────────────────────────────

/** Preset dialog surface widths. */
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl'

/** `size` preset → surface width. */
export const DIALOG_SIZE_WIDTHS: Readonly<Record<DialogSize, string>> = {
  sm: '32rem',
  md: '40rem',
  lg: '50rem',
  xl: '60rem',
}

/** Backdrop gutter per side, in px (the surface is centered inside it). */
const GUTTER_PX = 24

/** Backdrop gutter per side — the padding the four adapters apply. */
export const DIALOG_BACKDROP_GUTTER = `${GUTTER_PX}px`

/** Default surface height cap of an open dialog. */
export const DIALOG_MAX_HEIGHT = '85vh'

/** Max width of a dialog that requested no width (unchanged legacy behavior). */
export const DIALOG_LEGACY_MAX_WIDTH = '90vw'

/** A sized surface never exceeds the viewport minus both backdrop gutters. */
export const DIALOG_VIEWPORT_CLAMP = `calc(100vw - ${GUTTER_PX * 2}px)`

/** Raw sizing props shared by every adapter's `IrisDialogContent`. */
export interface DialogLayoutInput {
  size?: DialogSize
  width?: LayoutLength
  maxHeight?: LayoutLength
}

/** The style contract every adapter renders onto the dialog surface. */
export interface DialogLayout {
  /** Echo of the accepted preset, for `data-iris-dialog-size`. */
  size?: DialogSize
  /** Requested width (explicit `width` wins over the `size` preset). */
  width?: string
  /** Viewport clamp — gutter-aware once a width is requested. */
  maxWidth: string
  /** Height cap, gutter-clamped for opted-in sizing; legacy default is `85vh`. */
  maxHeight: string
  /** True when a width preset or explicit width was accepted. */
  sized: boolean
}

/**
 * Resolve the dialog surface sizing.
 *
 * An explicit `width` overrides the `size` preset; both are clamped to the
 * viewport minus the backdrop gutters, so a 60rem dialog on a phone never
 * overflows horizontally. With neither prop the legacy `max-width: 90vw` is
 * returned unchanged.
 */
export function resolveDialogLayout(input: DialogLayoutInput): DialogLayout {
  const size =
    input.size && Object.prototype.hasOwnProperty.call(DIALOG_SIZE_WIDTHS, input.size)
      ? input.size
      : undefined
  const explicitWidth = normalizeLayoutLength(input.width)
  const width = explicitWidth ?? (size ? DIALOG_SIZE_WIDTHS[size] : undefined)
  const explicitHeight = normalizeLayoutLength(input.maxHeight)
  const height = explicitHeight ?? DIALOG_MAX_HEIGHT
  const maxHeight =
    width !== undefined || explicitHeight !== undefined
      ? `min(${height}, calc(100vh - ${GUTTER_PX * 2}px))`
      : height
  return {
    size,
    width,
    maxWidth: width === undefined ? DIALOG_LEGACY_MAX_WIDTH : DIALOG_VIEWPORT_CLAMP,
    maxHeight,
    sized: width !== undefined,
  }
}
