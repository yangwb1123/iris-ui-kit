import type { Size } from '@iris-ui-kit/core'

export const SELECT_LISTBOX_MAX_HEIGHT = 240
export const SELECT_ROW_HEIGHT = 36

export const SELECT_SIZE_MAP: Record<
  Size,
  {
    paddingBlock: string
    paddingInlineStart: string
    paddingInlineEnd: string
    fontSize: string
    minHeight: string
  }
> = {
  sm: {
    paddingBlock: '4px',
    paddingInlineStart: '8px',
    paddingInlineEnd: '24px',
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
    paddingBlock: '8px',
    paddingInlineStart: '12px',
    paddingInlineEnd: '32px',
    fontSize: 'var(--iris-font-size-lg, 16px)',
    minHeight: '40px',
  },
}
