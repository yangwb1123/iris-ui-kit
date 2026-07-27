// Live-preview wiring for the docs Component Explorer.
//
// SCOPING (intentional): full live preview in the React / Solid / Svelte runtimes
// inside VitePress is OUT OF SCOPE — island isolation (mounting three other
// framework runtimes in a Vue/VitePress page) is heavy and brittle. VitePress is
// Vue, so the LIVE preview renders the real `@iris-ui-kit/vue` component; the
// 4-framework CODE TABS (see explorer-codegen.ts) carry the parity story.
//
// This file declares which components are live-preview-wired and, for each, which
// manifest props are surfaced as controls plus how a manifest prop name maps to
// the Vue adapter prop name (the manifest is React-derived, so e.g. the controlled
// `checked` / `value` props are `modelValue`/v-model on the Vue side). Anything
// not listed here still gets controls + code tabs, but the preview panel shows a
// "no live preview" note.

export interface PreviewSpec {
  /** Manifest prop names to expose as controls, in display order. */
  controls: string[]
  /**
   * Map a manifest prop name -> the Vue adapter prop name to bind it to in the
   * LIVE preview. Omitted entries bind 1:1. Use this for the v-model props the
   * Vue adapters expose as `modelValue` where the manifest (React) calls them
   * `checked` / `value`.
   */
  vueBind?: Record<string, string>
  /**
   * Per-framework prop-name overrides for the React / Solid / Svelte LIVE islands
   * (ROADMAP v3 final item). The manifest is React-derived, so React/Solid/Vue
   * largely share names; these maps only cover the few places an adapter renamed a
   * controlled prop. Omitted maps / entries bind 1:1. E.g. the Svelte checkbox
   * exposes `value` where the manifest (React) calls it `checked`.
   */
  reactBind?: Record<string, string>
  solidBind?: Record<string, string>
  svelteBind?: Record<string, string>
  /** Default child text rendered in the component's default slot, if it takes one. */
  childText?: string
  /** Whether the component accepts/needs default-slot child text (a control for it). */
  hasChildText?: boolean
}

// Keyed by manifest component name. Curated to SSR-safe, standalone-renderable
// primitives with cleanly mappable visual props.
export const PREVIEW_SPECS: Record<string, PreviewSpec> = {
  IrisButton: {
    controls: ['variant', 'size', 'disabled', 'loading'],
    childText: 'Button',
    hasChildText: true,
  },
  IrisBadge: {
    controls: ['variant', 'tone', 'size'],
    childText: 'Badge',
    hasChildText: true,
  },
  IrisChip: {
    controls: ['variant', 'tone', 'size', 'closable', 'clickable', 'disabled'],
    childText: 'Chip',
    hasChildText: true,
  },
  IrisSwitch: {
    controls: ['checked', 'size', 'invalid'],
    vueBind: { checked: 'modelValue' },
  },
  IrisCheckbox: {
    controls: ['checked', 'size', 'invalid'],
    vueBind: { checked: 'modelValue' },
    // The Svelte checkbox names its controlled prop `value` (React/Solid use `checked`).
    svelteBind: { checked: 'value' },
    childText: 'Accept terms',
    hasChildText: true,
  },
  IrisInput: {
    controls: ['type', 'size', 'invalid'],
    childText: '',
  },
  IrisAlert: {
    controls: ['tone', 'title', 'closable'],
    childText: 'This is an alert message.',
    hasChildText: true,
  },
  IrisSpinner: {
    controls: ['size', 'color'],
  },
  IrisProgress: {
    controls: ['value', 'max', 'indeterminate', 'tone', 'size'],
  },
}

/** The component names that have a live Vue preview. */
export const LIVE_PREVIEW_NAMES = Object.keys(PREVIEW_SPECS)
