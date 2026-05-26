import type { IrisTheme } from './types'

export const lightTheme: IrisTheme = {
  name: 'iris-light',
  type: 'light',
  colors: {
    'iris.background': '#ffffff',
    'iris.foreground': '#0f172a',
    'iris.surface': '#f8fafc',
    'iris.surface.hover': '#f1f5f9',
    'iris.border': '#e2e8f0',
    'iris.muted': '#64748b',
    'iris.primary': '#6366f1',
    'iris.primary.foreground': '#ffffff',
    'iris.accent': '#8b5cf6',
    'iris.danger': '#ef4444',
    'iris.success': '#10b981',
    'iris.warning': '#f59e0b',
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
