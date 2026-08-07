/** Sides relative to an anchor element. */
export type Side = 'top' | 'right' | 'bottom' | 'left'

/**
 * Alignment along the cross-axis of a side. Matches Floating UI's convention:
 * the unaligned placement (`'top'`) is implicitly centered, so there is no
 * `'center'` value here.
 */
export type Align = 'start' | 'end'

/**
 * Placement combines a side and an alignment, e.g. `'top-start'`. A bare side
 * (`'top'`) means centered on that side. Structurally compatible with
 * `@floating-ui/dom`'s `Placement`.
 */
export type Placement = `${Side}-${Align}` | Side

/** Common size scale used across primitives. */
export type Size = 'sm' | 'md' | 'lg'

/** Common visual variants. */
export type Variant = 'solid' | 'outline' | 'ghost' | 'link' | 'danger'
