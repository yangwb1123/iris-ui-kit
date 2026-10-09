import { createUniqueId, mergeProps, Show, splitProps, type JSX } from 'solid-js'
import {
  hyphenateLayoutStyle,
  resolveFormFieldLayout,
  type FormFieldLabelPlacement,
  type LayoutLength,
} from '@iris-ui-kit/core'
import { FormFieldContext } from './context'

export interface IrisFormFieldProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'children'> {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  /** Override the auto-generated control id. */
  labelFor?: string
  size?: 'sm' | 'md'
  /** Label above the control (default) or beside it. */
  labelPlacement?: FormFieldLabelPlacement
  /** Width of the label column — a number is read as px. Labels wrap inside it. */
  labelWidth?: LayoutLength
  /** Width of the control area (control + hint/error); a number is read as px. */
  controlWidth?: LayoutLength
  /** Stretch the field (and its control area) to the container width. */
  fullWidth?: boolean
  children?: JSX.Element
}

/**
 * Form-field wrapper handling the label / hint / error trio with a11y plumbing.
 * Solid has no `cloneElement`, so instead of injecting props into the child it
 * publishes `{ id, describedBy, invalid }` via context; field controls
 * (`IrisInput`, `IrisSwitch`) self-wire by reading `useFormFieldControl()`.
 * Behaviorally identical to the React/Vue IrisFormField.
 *
 * Layout is declarative — `labelPlacement` / `labelWidth` / `controlWidth` /
 * `fullWidth` exist in all four adapters and the decisions live in core
 * (`resolveFormFieldLayout`). Horizontal fields group the control with its
 * hint/error in a `data-iris-form-field-control` wrapper; that wrapper is only
 * emitted when a layout prop asks for it, so a plain field keeps its DOM.
 */
export function IrisFormField(props: IrisFormFieldProps): JSX.Element {
  const merged = mergeProps({ required: false, size: 'md' as 'sm' | 'md' }, props)
  const [local, others] = splitProps(merged, [
    'label',
    'hint',
    'error',
    'required',
    'labelFor',
    'size',
    'labelPlacement',
    'labelWidth',
    'controlWidth',
    'fullWidth',
    'style',
    'children',
  ])
  const generated = createUniqueId()
  const controlId = (): string => local.labelFor || `${generated}-control`
  const hintId = `${generated}-hint`
  const errorId = `${generated}-error`
  const describedBy = (): string | undefined => {
    const ids: string[] = []
    if (local.hint && !local.error) ids.push(hintId)
    if (local.error) ids.push(errorId)
    return ids.length ? ids.join(' ') : undefined
  }
  const layout = (): ReturnType<typeof resolveFormFieldLayout> =>
    resolveFormFieldLayout({
      labelPlacement: local.labelPlacement,
      labelWidth: local.labelWidth,
      controlWidth: local.controlWidth,
      fullWidth: local.fullWidth,
    })

  const hintNode = <FieldHint hint={local.hint} error={local.error} id={hintId} />
  const errorNode = <FieldError error={local.error} id={errorId} />

  return (
    <FormFieldContext.Provider
      value={{ id: controlId, describedBy, invalid: () => Boolean(local.error) }}
    >
      <div
        {...others}
        data-iris-form-field=""
        data-iris-form-field-state={local.error ? 'invalid' : 'valid'}
        data-iris-form-field-placement={
          layout().placement === 'top' ? undefined : layout().placement
        }
        style={{
          ...hyphenateLayoutStyle(layout().root),
          ...((local.style as JSX.CSSProperties) ?? {}),
        }}
      >
        <Show when={local.label}>
          <label
            for={controlId()}
            data-iris-form-field-label=""
            style={{
              'font-size':
                local.size === 'sm'
                  ? 'var(--iris-font-size-xs, 12px)'
                  : 'var(--iris-font-size-md, 14px)',
              'font-weight': 500,
              color: local.error ? 'var(--iris-danger)' : 'var(--iris-foreground)',
              display: 'inline-flex',
              'align-items': 'center',
              gap: '4px',
              ...hyphenateLayoutStyle(layout().label),
            }}
          >
            {local.label}
            <Show when={local.required}>
              <span
                aria-hidden="true"
                data-iris-form-field-required=""
                style={{ color: 'var(--iris-danger)' }}
              >
                *
              </span>
            </Show>
          </label>
        </Show>
        {/* The control area is grouped under its own wrapper when a layout prop
            asks for one (horizontal fields keep help/error under the control). */}
        <Show when={layout().grouped}>
          <div data-iris-form-field-control="" style={hyphenateLayoutStyle(layout().control)}>
            {local.children}
            {hintNode}
            {errorNode}
          </div>
        </Show>
        <Show when={!layout().grouped}>
          {local.children}
          {hintNode}
          {errorNode}
        </Show>
      </div>
    </FormFieldContext.Provider>
  )
}

/** Help text under the control — suppressed while an error is showing. */
function FieldHint(props: { hint?: string; error?: string; id: string }): JSX.Element {
  return (
    <Show when={props.hint && !props.error}>
      <div
        id={props.id}
        data-iris-form-field-hint=""
        style={{ 'font-size': 'var(--iris-font-size-xs, 12px)', color: 'var(--iris-muted)' }}
      >
        {props.hint}
      </div>
    </Show>
  )
}

/** Error message under the control — announced through `role="alert"`. */
function FieldError(props: { error?: string; id: string }): JSX.Element {
  return (
    <Show when={props.error}>
      <div
        id={props.id}
        data-iris-form-field-error=""
        role="alert"
        style={{ 'font-size': 'var(--iris-font-size-xs, 12px)', color: 'var(--iris-danger)' }}
      >
        {props.error}
      </div>
    </Show>
  )
}
