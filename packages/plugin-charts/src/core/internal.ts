export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

export function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

export function nonNegative(value: number, fallback = 0): number {
  return Math.max(0, finiteOr(value, fallback))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, finiteOr(value, min)))
}

export function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function categoryLabel(categories: readonly string[], index: number): string {
  return categories[index] || String(index + 1)
}

export function formattedNumber(value: number): string {
  if (!Number.isFinite(value)) return ''
  return String(round(value))
}
