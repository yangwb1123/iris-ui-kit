import { mergeProps, splitProps, type JSX } from 'solid-js'

export interface IrisAspectRatioProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Width / height ratio. Defaults to 16/9. */
  ratio?: number
  children?: JSX.Element
}

/**
 * Aspect-ratio box: constrains slot content to a fixed width/height ratio
 * via the CSS `aspect-ratio` property, with an absolutely-filled content layer.
 */
export function IrisAspectRatio(props: IrisAspectRatioProps): JSX.Element {
  const merged = mergeProps({ ratio: 16 / 9 }, props)
  const [local, rest] = splitProps(merged, ['ratio', 'style', 'children'])

  return (
    <div
      {...rest}
      data-iris-aspect-ratio=""
      data-ratio={local.ratio}
      style={{
        position: 'relative',
        width: '100%',
        'aspect-ratio': String(local.ratio),
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <div
        data-iris-aspect-ratio-content=""
        style={{ position: 'absolute', inset: '0', width: '100%', height: '100%' }}
      >
        {local.children}
      </div>
    </div>
  )
}
