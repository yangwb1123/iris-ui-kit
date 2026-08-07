import { mergeProps, splitProps, type JSX } from 'solid-js'

const SR_ONLY: JSX.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: 'calc(-1px)',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  'white-space': 'nowrap',
  border: '0',
}

export interface IrisVisuallyHiddenProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  children?: JSX.Element
}

/**
 * Visually-hidden content: present in the accessibility tree but clipped from
 * view. Forwards attributes like `aria-live` / `role`.
 */
export function IrisVisuallyHidden(props: IrisVisuallyHiddenProps): JSX.Element {
  const [local, rest] = splitProps(mergeProps(props), ['style', 'children'])
  return (
    <span
      {...rest}
      data-iris-visually-hidden=""
      style={{ ...SR_ONLY, ...((local.style as JSX.CSSProperties) ?? {}) }}
    >
      {local.children}
    </span>
  )
}
