import { For, Index, Show, type JSX } from 'solid-js'
import { useField, useFieldArray } from '@iris-ui/solid/form'
import { arrayRowDefaults, type FieldSpec } from '../core'

/**
 * Field renderers for {@link IrisFormBuilder} (SolidJS). Split out of `index.tsx`
 * (ADR-008: no new oversized source files), mirroring the React reference. Every
 * control binds through `@iris-ui/solid/form`'s `useField`, which keys per-field
 * state by CANONICAL PATH — so a sub-field nested under an array row
 * (`items[2].sku`) tracks its own error/touched/dirty independently of its
 * siblings, and that state RE-KEYS when rows are removed or reordered.
 */

/** Resolved label for a field (explicit, else humanized from its name). */
function humanize(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
const labelOf = (field: FieldSpec): string => field.label ?? humanize(field.name)

/**
 * The full path a field binds to: a top-level field is just its `name`; a
 * sub-field inside an array row is `${prefix}.${name}` where `prefix` is the row
 * path (`items[2]`). `useField` parses both into the same canonical key.
 */
function pathOf(field: FieldSpec, prefix?: string): string {
  return prefix ? `${prefix}.${field.name}` : field.name
}

/** A single scalar control (text/number/email/password/textarea/select/checkbox). */
function ScalarField(props: { field: FieldSpec; prefix?: string }): JSX.Element {
  const path = pathOf(props.field, props.prefix)
  const f = useField<unknown>(path)
  const id = `iris-fb-${path}`
  const type = () => props.field.type ?? 'text'
  const describedBy = () => (f.error() ? `${id}-error` : undefined)

  return (
    <div data-iris-form-field={path}>
      <Show when={type() !== 'checkbox'}>
        <label for={id} style={{ display: 'block', color: 'var(--iris-form-label)' }}>
          {labelOf(props.field)}
          {props.field.required ? ' *' : ''}
        </label>
      </Show>
      <Show when={type() === 'textarea'}>
        <textarea
          id={id}
          value={String(f.value() ?? '')}
          placeholder={props.field.placeholder}
          aria-required={props.field.required || undefined}
          aria-invalid={f.error() ? true : undefined}
          aria-describedby={describedBy()}
          onInput={(e) => f.setValue(e.currentTarget.value)}
          onBlur={() => f.setTouched()}
        />
      </Show>
      <Show when={type() === 'select'}>
        <select
          id={id}
          value={String(f.value() ?? '')}
          aria-required={props.field.required || undefined}
          aria-invalid={f.error() ? true : undefined}
          aria-describedby={describedBy()}
          onChange={(e) => f.setValue(e.currentTarget.value)}
          onBlur={() => f.setTouched()}
        >
          <option value="">{props.field.placeholder ?? 'Select…'}</option>
          <For each={props.field.options ?? []}>
            {(opt) => <option value={opt.value}>{opt.label}</option>}
          </For>
        </select>
      </Show>
      <Show when={type() === 'checkbox'}>
        <label for={id} style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
          <input
            id={id}
            type="checkbox"
            checked={Boolean(f.value())}
            aria-describedby={describedBy()}
            onChange={(e) => f.setValue(e.currentTarget.checked)}
            onBlur={() => f.setTouched()}
          />
          {labelOf(props.field)}
          {props.field.required ? ' *' : ''}
        </label>
      </Show>
      <Show when={type() !== 'textarea' && type() !== 'select' && type() !== 'checkbox'}>
        <input
          id={id}
          type={type()}
          value={String(f.value() ?? '')}
          placeholder={props.field.placeholder}
          aria-required={props.field.required || undefined}
          aria-invalid={f.error() ? true : undefined}
          aria-describedby={describedBy()}
          onInput={(e) => f.setValue(e.currentTarget.value)}
          onBlur={() => f.setTouched()}
        />
      </Show>
      <Show when={f.error()}>
        <div id={`${id}-error`} role="alert" style={{ color: 'var(--iris-form-error)' }}>
          {f.error()}
        </div>
      </Show>
    </div>
  )
}

/**
 * An `array` (repeater) field: zero rows initially, an "Add" button appends a row
 * built from {@link arrayRowDefaults}, and each row renders the sub-fields bound
 * to their nested path plus a "Remove" button. Mutations route through
 * `useFieldArray`, which re-keys per-row state across remove/move.
 */
function ArrayField(props: { field: FieldSpec }): JSX.Element {
  const arr = useFieldArray<Record<string, unknown>>(props.field.name)
  const error = useField<unknown>(props.field.name).error
  const id = `iris-fb-${props.field.name}`
  const subFields = () => props.field.fields ?? []

  return (
    <div data-iris-form-field={props.field.name}>
      <label style={{ display: 'block', color: 'var(--iris-form-label)' }}>
        {labelOf(props.field)}
        {props.field.required ? ' *' : ''}
      </label>
      <div data-iris-fb-array={props.field.name}>
        {/*
          `<Index>` (NOT `<For>`) keys rows by POSITION, mirroring the React
          reference's index-keyed `.map`. Sub-fields bind to the index-derived
          path `items[i].<name>`, so when an earlier row is removed the remaining
          rows re-render at their new index and re-bind to the shifted path — this
          is what makes the "remove row 0 → row 1's value is now at index 0" test
          pass. (`<For>` keys by value identity and would keep the stale path.)
        */}
        <Index each={arr.fields()}>
          {(_, index) => {
            const prefix = `${props.field.name}[${index}]`
            return (
              <div data-iris-fb-row={index}>
                <Show when={props.field.itemLabel}>
                  <div data-iris-fb-item-label="">{`${props.field.itemLabel} ${index + 1}`}</div>
                </Show>
                <For each={subFields()}>{(sub) => <ScalarField field={sub} prefix={prefix} />}</For>
                <button type="button" data-iris-fb-remove={index} onClick={() => arr.remove(index)}>
                  {props.field.removeLabel ?? 'Remove'}
                </button>
              </div>
            )
          }}
        </Index>
      </div>
      <button
        type="button"
        data-iris-fb-add={props.field.name}
        onClick={() => arr.push(arrayRowDefaults(props.field))}
      >
        {props.field.addLabel ?? 'Add'}
      </button>
      <Show when={error()}>
        <div id={`${id}-error`} role="alert" style={{ color: 'var(--iris-form-error)' }}>
          {error()}
        </div>
      </Show>
    </div>
  )
}

/**
 * Render one schema field — dispatch to {@link ArrayField} for repeaters, else a
 * {@link ScalarField}. `prefix` is set when rendering a sub-field inside an array
 * row so the control binds to its nested path.
 */
export function FieldControl(props: { field: FieldSpec; prefix?: string }): JSX.Element {
  return (
    <Show
      when={props.field.type === 'array' && !props.prefix}
      fallback={<ScalarField field={props.field} prefix={props.prefix} />}
    >
      <ArrayField field={props.field} />
    </Show>
  )
}
