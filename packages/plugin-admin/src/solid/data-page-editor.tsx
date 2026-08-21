import { For, Show, type Accessor, type JSX } from 'solid-js'
import { IrisButton, IrisInput } from '@iris-ui-kit/solid'
import {
  adminFieldName,
  coerceAdminFieldValue,
  type AdminColumn,
  type AdminDataPage,
} from '@iris-ui-kit/plugin-admin/core'
import {
  ariaInvalid,
  errorReference,
  inputType,
  rowStyle,
  stackStyle,
  type AdminController,
  type AdminEditorState,
  type AdminMessage,
} from './data-page-types'

interface AdminFieldProps {
  column: AdminColumn
  fieldId: string
  errorId: string
  value: Accessor<unknown>
  invalid: Accessor<boolean>
  editor: Accessor<AdminEditorState>
  controller: AdminController
}

const AdminFieldControl = (props: AdminFieldProps): JSX.Element => {
  const field = adminFieldName(props.column)
  if (props.column.type === 'boolean') {
    return (
      <input
        id={props.fieldId}
        type="checkbox"
        checked={Boolean(props.value())}
        aria-invalid={ariaInvalid(props.invalid())}
        aria-describedby={errorReference(props.invalid(), props.errorId)}
        onChange={(event) => props.controller.setField(field, event.currentTarget.checked)}
      />
    )
  }
  if (props.column.type === 'select') {
    return (
      <select
        id={props.fieldId}
        value={String(props.value() ?? '')}
        aria-invalid={ariaInvalid(props.invalid())}
        aria-describedby={errorReference(props.invalid(), props.errorId)}
        onChange={(event) =>
          props.controller.setField(
            field,
            coerceAdminFieldValue(props.column, event.currentTarget.value),
          )
        }
      >
        <option value="">{props.column.placeholder ?? ''}</option>
        <For each={props.column.options}>
          {(option) => <option value={String(option.value)}>{option.label}</option>}
        </For>
      </select>
    )
  }
  if (props.column.type === 'date') {
    return (
      <input
        id={props.fieldId}
        type="date"
        value={String(props.value() ?? '')}
        aria-invalid={ariaInvalid(props.invalid())}
        aria-describedby={errorReference(props.invalid(), props.errorId)}
        onInput={(event) => props.controller.setField(field, event.currentTarget.value)}
      />
    )
  }
  return (
    <IrisInput
      id={props.fieldId}
      type={inputType(props.column)}
      value={String(props.value() ?? '')}
      placeholder={props.column.placeholder}
      invalid={props.invalid()}
      ariaDescribedby={errorReference(props.invalid(), props.errorId)}
      onInput={(event) =>
        props.controller.setField(
          field,
          coerceAdminFieldValue(props.column, event.currentTarget.value),
        )
      }
    />
  )
}

const AdminField = (props: {
  column: AdminColumn
  fieldPrefix: string
  editor: Accessor<AdminEditorState>
  controller: AdminController
}): JSX.Element => {
  const field = adminFieldName(props.column)
  const fieldId = `${props.fieldPrefix}-${field}`
  const errorId = `${fieldId}-error`
  const value = (): unknown => props.editor().draft[field]
  const invalid = (): boolean => Boolean(props.editor().errors[field])
  return (
    <div data-iris-admin-field={field} style={stackStyle}>
      <label for={fieldId}>
        {props.column.title}
        {props.column.required ? ' *' : ''}
      </label>
      <AdminFieldControl
        column={props.column}
        fieldId={fieldId}
        errorId={errorId}
        value={value}
        invalid={invalid}
        editor={props.editor}
        controller={props.controller}
      />
      <Show when={invalid()}>
        <span id={errorId} role="alert">
          {props.editor().errors[field]}
        </span>
      </Show>
    </div>
  )
}

/** Editor form for create/update mode, backed by the shared controller. */
export const AdminEditor = (props: {
  page: AdminDataPage
  controller: AdminController
  editor: Accessor<AdminEditorState>
  fieldPrefix: string
  message: AdminMessage
}): JSX.Element => (
  <form
    data-iris-admin-editor={props.editor().mode}
    aria-label={props.message(props.editor().mode === 'create' ? 'editorCreate' : 'editorEdit', {
      title: props.page.title ?? props.page.key,
    })}
    style={stackStyle}
    onSubmit={(event) => {
      event.preventDefault()
      void props.controller.save()
    }}
  >
    <For each={props.controller.editableColumns}>
      {(column) => (
        <AdminField
          column={column}
          fieldPrefix={props.fieldPrefix}
          editor={props.editor}
          controller={props.controller}
        />
      )}
    </For>
    <div style={rowStyle}>
      <IrisButton type="submit" loading={props.editor().saving}>
        {props.message('save')}
      </IrisButton>
      <IrisButton variant="outline" onClick={() => props.controller.cancelEdit()}>
        {props.message('cancel')}
      </IrisButton>
    </div>
  </form>
)
