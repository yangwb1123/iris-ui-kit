import type { IrisTheme } from './types'

export const darkTheme: IrisTheme = {
  name: 'iris-dark',
  type: 'dark',
  colors: {
    'iris.background': '#0b1020',
    'iris.foreground': '#e2e8f0',
    'iris.surface': '#111827',
    'iris.surface.hover': '#1f2937',
    'iris.border': '#1f2937',
    'iris.muted': '#94a3b8',
    'iris.primary': '#818cf8',
    'iris.primary.foreground': '#0b1020',
    'iris.accent': '#a78bfa',
    'iris.danger': '#f87171',
    'iris.success': '#34d399',
    'iris.warning': '#fbbf24',
  },
  spacing: {
    'iris.gap.sm': 4,
    'iris.gap.md': 8,
    'iris.gap.lg': 16,
    'iris.padding.sm': 6,
    'iris.padding.md': 12,
    'iris.padding.lg': 20,
  },
  radii: {
    'iris.radius.sm': 2,
    'iris.radius.md': 6,
    'iris.radius.lg': 12,
  },
}
