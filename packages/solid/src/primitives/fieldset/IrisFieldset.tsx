import { mergeProps, Show, splitProps, type JSX } from 'solid-js'

export interface IrisFieldsetProps {
  legend?: string
  disabled?: boolean
  hint?: string
  children?: JSX.Element
  legendChildren?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
}

/**
 * Semantic fieldset/legend form grouping with native disabled cascade.
 * Solid port of the Vue/React IrisFieldset.
 */
export function IrisFieldset(props: IrisFieldsetProps): JSX.Element {
  const merged = mergeProps({ disabled: false }, props)
  const [local, rest] = splitProps(merged, [
    'legend',
    'disabled',
    'hint',
    'children',
    'legendChildren',
  ])

  return (
    <fieldset
      {...rest}
      data-iris-fieldset=""
      disabled={local.disabled}
      style={{
        'min-inline-size': '0',
        margin: '0',
        padding: '16px',
        border: '1px solid var(--iris-border)',
        'border-radius': 'var(--iris-radius-md, 6px)',
        opacity: local.disabled ? 0.6 : 1,
        ...((rest.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <Show when={local.legendChildren || local.legend != null}>
        <legend
          data-iris-fieldset-legend=""
          style={{
            padding: '0 6px',
            'font-size': '14px',
            'font-weight': '600',
            color: 'var(--iris-foreground)',
          }}
        >
          {local.legendChildren ?? local.legend}
        </legend>
      </Show>
      <Show when={local.hint != null}>
        <div
          data-iris-fieldset-hint=""
          style={{ 'font-size': '12px', color: 'var(--iris-muted)', 'margin-block-end': '8px' }}
        >
          {local.hint}
        </div>
      </Show>
      {local.children}
    </fieldset>
  )
}
