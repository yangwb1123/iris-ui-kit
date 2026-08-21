export type IrisSelectSizeKey = 'sm' | 'md' | 'lg'

export const SELECT_SIZE_MAP: Record<
  IrisSelectSizeKey,
  { padding: string; fontSize: string; minHeight: string }
> = {
  sm: {
    padding:
      'var(--iris-space-xxs, 4px) var(--iris-space-xl, 24px) var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
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
    padding:
      'var(--iris-space-xs, 8px) var(--iris-space-2xl, 32px) var(--iris-space-xs, 8px) var(--iris-padding-md, 12px)',
    fontSize: 'var(--iris-font-size-lg, 16px)',
    minHeight: '40px',
  },
}

export const SELECT_LISTBOX_MAX_HEIGHT = 240
export const SELECT_ROW_HEIGHT = 36
