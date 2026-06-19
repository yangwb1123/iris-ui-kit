import { useField, useFieldArray } from '@iris-ui/react/form'
import { arrayRowDefaults, type FieldSpec } from '../core'

/**
 * Field renderers for {@link IrisFormBuilder} (React). Split out of `index.tsx`
 * (ADR-008: no new oversized source files). Every control binds through
 * `@iris-ui/react/form`'s `useField`, which keys per-field state by CANONICAL
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
function ScalarField({ field, prefix }: { field: FieldSpec; prefix?: string }) {
  const path = pathOf(field, prefix)
  const f = useField<unknown>(path)
  const id = `iris-fb-${path}`
  const type = field.type ?? 'text'
  const error = f.error
  const describedBy = error ? `${id}-error` : undefined

  return (
    <div data-iris-form-field={path}>
      {type !== 'checkbox' && (
        <label htmlFor={id} style={{ display: 'block', color: 'var(--iris-form-label)' }}>
          {labelOf(field)}
          {field.required ? ' *' : ''}
        </label>
      )}
      {type === 'textarea' ? (
        <textarea
          id={id}
          value={String(f.value ?? '')}
          placeholder={field.placeholder}
          aria-required={field.required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => f.setValue(e.target.value)}
          onBlur={() => f.setTouched()}
        />
      ) : type === 'select' ? (
        <select
          id={id}
          value={String(f.value ?? '')}
          aria-required={field.required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => f.setValue(e.target.value)}
          onBlur={() => f.setTouched()}
        >
          <option value="">{field.placeholder ?? 'Select…'}</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'checkbox' ? (
        <label htmlFor={id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            id={id}
            type="checkbox"
            checked={Boolean(f.value)}
            aria-describedby={describedBy}
            onChange={(e) => f.setValue(e.target.checked)}
            onBlur={() => f.setTouched()}
          />
          {labelOf(field)}
          {field.required ? ' *' : ''}
        </label>
      ) : (
        <input
          id={id}
          type={type}
          value={String(f.value ?? '')}
          placeholder={field.placeholder}
          aria-required={field.required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => f.setValue(e.target.value)}
          onBlur={() => f.setTouched()}
        />
      )}
      {error && (
        <div id={`${id}-error`} role="alert" style={{ color: 'var(--iris-form-error)' }}>
          {error}
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
