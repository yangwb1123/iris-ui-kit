import * as React from 'react'

export type IrisVisuallyHiddenProps = React.HTMLAttributes<HTMLSpanElement>

const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

/**
 * Visually-hidden content: present in the accessibility tree (read by screen
 * readers) but clipped from view — for labels, live-region announcements, and
 * extra context. Forwards attributes like `aria-live` / `role`.
 *
 * React port of {@link import('@iris-ui-kit/vue').IrisVisuallyHidden}.
 */
export function IrisVisuallyHidden({
  children,
  style,
  ...rest
}: IrisVisuallyHiddenProps): React.ReactElement {
  return (
    <span data-iris-visually-hidden="" {...rest} style={{ ...SR_ONLY, ...style }}>
      {children}
    </span>
  )
}
