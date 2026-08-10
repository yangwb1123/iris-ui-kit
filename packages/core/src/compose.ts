/**
 * Capability composition interface (IrisCompose).
 *
 * One declarative surface for composing ORTHOGONAL capabilities onto any
 * primitive — without creating new components. External capabilities
 * (resizable / movable / sortable / clickOutside / hotkey) wrap the child in
 * a fixed order; internal capabilities (virtual / multiple / roving) are
 * component props on the primitives themselves (see IrisSelect `virtual`).
 *
 * The framework adapters render `<IrisCompose features={…}>` as the thin
 * bridge; this module owns the resolution/ordering logic so all four
 * frameworks compose identically.
 */

export type ComposableFeature = 'resizable' | 'movable' | 'sortable' | 'clickOutside' | 'hotkey'

/** Fixed wrap order: renderless → interaction → containment. */
export const COMPOSE_ORDER: readonly ComposableFeature[] = [
  'hotkey',
  'clickOutside',
  'sortable',
  'movable',
  'resizable',
]

/**
 * Resolve which capabilities are enabled from a partial feature map, in
 * wrap order (outermost last — `resizable` ends up as the outer wrapper).
 */
export function composeFeatures(
  features: Partial<Record<ComposableFeature, unknown>>,
): ComposableFeature[] {
  return COMPOSE_ORDER.filter((f) => features[f] !== undefined && features[f] !== false)
}

/**
 * True when a feature map enables at least one capability.
 */
export function hasComposableFeatures(
  features: Partial<Record<ComposableFeature, unknown>>,
): boolean {
  return composeFeatures(features).length > 0
}
