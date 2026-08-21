import type { Size } from '@iris-ui-kit/core'

export const SELECT_LISTBOX_MAX_HEIGHT = 240
export const SELECT_ROW_HEIGHT = 36

export const SELECT_SIZE_MAP: Record<
  Size,
  { padding: string; fontSize: string; minHeight: string }
> = {
  sm: {
    padding: '4px 24px 4px 8px',
    fontSize: 'var(--iris-font-size-xs, 12px)',
    minHeight: '28px',
  },
  md: {
    padding:
      'var(--iris-padding-sm, 6px) var(--iris-space-xl, 24px) var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
    fontSize: 'var(--iris-font-size-md, 14px)',
    minHeight: '34px',
  },
  lg: {
    padding: '8px 32px 8px 12px',
    fontSize: 'var(--iris-font-size-lg, 16px)',
    minHeight: '40px',
  },
}
