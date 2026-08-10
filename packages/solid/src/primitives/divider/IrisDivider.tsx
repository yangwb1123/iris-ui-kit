import { mergeProps, Show, splitProps, type JSX } from 'solid-js'

export type IrisDividerOrientation = 'horizontal' | 'vertical'
export type IrisDividerSpacing = 'sm' | 'md' | 'lg'

const SPACING_MAP: Record<IrisDividerSpacing, string> = {
  sm: '8px',
  md: '16px',
  lg: '24px',
}

export interface IrisDividerProps {
  orientation?: IrisDividerOrientation
  label?: string
  spacing?: IrisDividerSpacing
  style?: JSX.CSSProperties
  class?: string
  children?: JSX.Element
  [key: string]: unknown
}

function lineStyle(): JSX.CSSProperties {
  return { flex: '1', height: '1px', background: 'var(--iris-border)' }
}

/**
 * Visual separator. Horizontal renders an <hr> (or a labelled div with
 * role="separator" when a label is supplied). Vertical always renders a div.
 */
export function IrisDivider(props: IrisDividerProps): JSX.Element {
  const merged = mergeProps(
    {
      orientation: 'horizontal' as IrisDividerOrientation,
      spacing: 'md' as IrisDividerSpacing,
      label: '',
    },
    props,
  )
  const [local, rest] = splitProps(merged, ['orientation', 'label', 'spacing', 'style', 'children'])

  const isHorizontal = () => local.orientation === 'horizontal'
  const hasLabel = () => Boolean(local.label || local.children)

  return (
    <Show
      when={isHorizontal()}
      fallback={
        <div
          {...rest}
          role="separator"
          aria-orientation="vertical"
          data-iris-divider=""
          data-iris-divider-orientation="vertical"
          style={{
            display: 'inline-block',
            width: '1px',
            'align-self': 'stretch',
            background: 'var(--iris-border)',
            margin: `0 ${SPACING_MAP[local.spacing]}`,
            ...((local.style as JSX.CSSProperties) ?? {}),
          }}
        />
      }
    >
      <Show
        when={hasLabel()}
        fallback={
          <hr
            {...rest}
            data-iris-divider=""
            data-iris-divider-orientation="horizontal"
            style={{
              border: 'none',
              'border-top': '1px solid var(--iris-border)',
              margin: `${SPACING_MAP[local.spacing]} 0`,
              width: '100%',
              ...((local.style as JSX.CSSProperties) ?? {}),
            }}
          />
        }
      >
        <div
          {...rest}
          role="separator"
          aria-orientation="horizontal"
          data-iris-divider=""
          data-iris-divider-orientation="horizontal"
          data-iris-divider-has-label="true"
          style={{
            display: 'flex',
            'align-items': 'center',
            gap: '8px',
            margin: `${SPACING_MAP[local.spacing]} 0`,
            color: 'var(--iris-muted)',
            'font-size': 'var(--iris-font-size-xs, 12px)',
            'text-transform': 'uppercase',
            'letter-spacing': 'var(--iris-letter-spacing-wide, 0.04em)',
            ...((local.style as JSX.CSSProperties) ?? {}),
          }}
        >
          <span data-iris-divider-line="before" style={lineStyle()} />
          <span data-iris-divider-label="">{local.children ?? local.label}</span>
          <span data-iris-divider-line="after" style={lineStyle()} />
        </div>
      </Show>
    </Show>
  )
}
