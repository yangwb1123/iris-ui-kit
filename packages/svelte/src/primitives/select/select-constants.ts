export type IrisSelectSizeKey = 'sm' | 'md' | 'lg'

export const SELECT_SIZE_MAP: Record<
  IrisSelectSizeKey,
  {
    paddingBlock: string
    paddingInlineStart: string
    paddingInlineEnd: string
    fontSize: string
    minHeight: string
  }
> = {
  sm: {
    paddingBlock: 'var(--iris-space-xxs, 4px)',
    paddingInlineStart: 'var(--iris-space-xs, 8px)',
    paddingInlineEnd: 'var(--iris-space-xl, 24px)',
    fontSize: 'var(--iris-font-size-xs, 12px)',
    minHeight: '28px',
  },
  md: {
    paddingBlock: 'var(--iris-padding-sm, 6px)',
    paddingInlineStart: 'var(--iris-padding-md, 12px)',
    paddingInlineEnd: 'var(--iris-space-xl, 24px)',
    fontSize: 'var(--iris-font-size-md, 14px)',
    minHeight: '34px',
  },
  lg: {
    paddingBlock: 'var(--iris-space-xs, 8px)',
    paddingInlineStart: 'var(--iris-padding-md, 12px)',
    paddingInlineEnd: 'var(--iris-space-2xl, 32px)',
    fontSize: 'var(--iris-font-size-lg, 16px)',
    minHeight: '40px',
  },
}

export const SELECT_LISTBOX_MAX_HEIGHT = 240
export const SELECT_ROW_HEIGHT = 36
