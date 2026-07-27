import { useField, useFieldArray } from '@iris-ui-kit/react/form'
import { arrayRowDefaults, type FieldSpec } from '../core'

/**
 * Field renderers for {@link IrisFormBuilder} (React). Split out of `index.tsx`
 * (ADR-008: no new oversized source files). Every control binds through
 * `@iris-ui-kit/react/form`'s `useField`, which keys per-field state by CANONICAL
 * PATH — so a sub-field nested under an array row (`items[2].sku`) tracks its own
 * error/touched/dirty independently of its siblings.
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
function renderScalarFieldInner(
  type: string,
  shared: Record<string, unknown>,
  f: ReturnType<typeof useField<unknown>>,
  field: FieldSpec,
): React.ReactNode {
  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => f.setValue((e.target as HTMLInputElement).value)
  const E = (tag: string, extra: Record<string, unknown>, children?: React.ReactNode) =>
    React.createElement(tag, { ...shared, ...extra, onChange }, children)
  if (type === 'textarea')
    return E('textarea', { placeholder: field.placeholder, value: String(f.value ?? '') })
  if (type === 'select')
    return E(
      'select',
      { value: String(f.value ?? '') },
      React.createElement('option', { value: '' }, field.placeholder ?? 'Select…'),
      ...(field.options ?? []).map((opt) =>
        React.createElement('option', { key: opt.value, value: opt.value }, opt.label),
      ),
    )
  if (type === 'checkbox')
    return React.createElement(
      'label',
      { htmlFor: String(shared.id), style: { display: 'flex', gap: 8, alignItems: 'center' } },
      React.createElement('input', {
        ...shared,
        type: 'checkbox',
        checked: Boolean(f.value),
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => f.setValue(e.target.checked),
      }),
      labelOf(field),
      field.required ? ' *' : '',
    )
  return E('input', { type, placeholder: field.placeholder, value: String(f.value ?? '') })
}

function renderScalarInput(
  type: string,
  id: string,
  f: ReturnType<typeof useField<unknown>>,
  field: FieldSpec,
  describedBy: string | undefined,
): React.ReactNode {
  const shared = {
    id,
    'aria-describedby': describedBy,
    'aria-required': field.required || undefined,
    'aria-invalid': f.error ? true : undefined,
    onBlur: () => f.setTouched(),
  }
  return renderScalarFieldInner(type, shared, f, field)
}

function ScalarField({ field, prefix }: { field: FieldSpec; prefix?: string }) {
  const path = pathOf(field, prefix)
  const f = useField<unknown>(path)
  const id = `iris-fb-${path}`
  const type = field.type ?? 'text'
  const describedBy = f.error ? `${id}-error` : undefined

  return (
    <div data-iris-form-field={path}>
      {type !== 'checkbox' && (
        <label htmlFor={id} style={{ display: 'block', color: 'var(--iris-form-label)' }}>
          {labelOf(field)}
          {field.required ? ' *' : ''}
        </label>
      )}
      {renderScalarInput(type, id, f, field, describedBy)}

      {f.error && (
        <div id={`${id}-error`} role="alert" style={{ color: 'var(--iris-form-error)' }}>
          {f.error}
        </div>
      )}
    </div>
  )
}

/**
 * An `array` (repeater) field: zero rows initially, an "Add" button appends a row
 * built from {@link arrayRowDefaults}, and each row renders the sub-fields bound
 * to their nested path plus a "Remove" button. Mutations route through
 * `useFieldArray`, which re-keys per-row state across remove/move.
 */
function ArrayField({ field }: { field: FieldSpec }) {
  const arr = useFieldArray<Record<string, unknown>>(field.name)
  const error = useField<unknown>(field.name).error
  const id = `iris-fb-${field.name}`
  const subFields = field.fields ?? []

  return (
    <div data-iris-form-field={field.name}>
      <label style={{ display: 'block', color: 'var(--iris-form-label)' }}>
        {labelOf(field)}
        {field.required ? ' *' : ''}
      </label>
      <div data-iris-fb-array={field.name}>
        {arr.fields.map((_, index) => {
          const prefix = `${field.name}[${index}]`
          return (
            <div key={index} data-iris-fb-row={index}>
              {field.itemLabel && (
                <div data-iris-fb-item-label="">{`${field.itemLabel} ${index + 1}`}</div>
              )}
              {subFields.map((sub) => (
                <ScalarField key={sub.name} field={sub} prefix={prefix} />
              ))}
              <button type="button" data-iris-fb-remove={index} onClick={() => arr.remove(index)}>
                {field.removeLabel ?? 'Remove'}
              </button>
            </div>
          )
        })}
      </div>
      <button
        type="button"
        data-iris-fb-add={field.name}
        onClick={() => arr.push(arrayRowDefaults(field))}
      >
        {field.addLabel ?? 'Add'}
      </button>
      {error && (
        <div id={`${id}-error`} role="alert" style={{ color: 'var(--iris-form-error)' }}>
          {error}
        </div>
      )}
    </div>
  )
}

/**
 * Render one schema field — dispatch to {@link ArrayField} for repeaters, else a
 * {@link ScalarField}. `prefix` is set when rendering a sub-field inside an array
 * row so the control binds to its nested path.
 */
export function FieldControl({ field, prefix }: { field: FieldSpec; prefix?: string }) {
  if (field.type === 'array' && !prefix) return <ArrayField field={field} />
  return <ScalarField field={field} prefix={prefix} />
}
