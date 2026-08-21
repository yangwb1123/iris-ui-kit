import * as React from 'react'
import { IrisButton, IrisInput } from '@iris-ui-kit/react'
import {
  adminFieldName,
  coerceAdminFieldValue,
  type AdminColumn,
  type AdminDataController,
  type AdminDataPage,
  type AdminMessageKey,
} from '@iris-ui-kit/plugin-admin/core'

export const stackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--iris-gap-md)',
}
export const pageStackStyle: React.CSSProperties = {
  ...stackStyle,
  gap: 'var(--iris-admin-page-gap, var(--iris-gap-md))',
}
export const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--iris-gap-sm)',
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function inputType(column: AdminColumn): 'text' | 'email' | 'number' {
  if (column.type === 'email' || column.type === 'number') return column.type
  return 'text'
}

export type AdminController = AdminDataController
export type AdminResourceState = ReturnType<AdminController['resource']['getState']>
export type AdminEditorSnapshot = ReturnType<AdminController['editor']['getState']>
export type AdminMessage = (
  key: AdminMessageKey,
  params?: Record<string, string | number>,
) => string

interface AdminFieldProps {
  column: AdminColumn
  fieldId: string
  errorId: string
  value: unknown
  invalid: boolean
  error?: string
  setField: (field: string, value: unknown) => void
}

function AdminBooleanField({
  fieldId,
  errorId,
  value,
  invalid,
  setField,
  column,
}: AdminFieldProps) {
  return (
    <input
      id={fieldId}
      type="checkbox"
      checked={Boolean(value)}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? errorId : undefined}
      onChange={(event) => setField(adminFieldName(column), event.currentTarget.checked)}
    />
  )
}

function AdminSelectField({ column, fieldId, errorId, value, invalid, setField }: AdminFieldProps) {
  return (
    <select
      id={fieldId}
      value={String(value ?? '')}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? errorId : undefined}
      onChange={(event) =>
        setField(adminFieldName(column), coerceAdminFieldValue(column, event.currentTarget.value))
      }
    >
      <option value="">{column.placeholder ?? ''}</option>
      {column.options?.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function AdminDateField({ column, fieldId, errorId, value, invalid, setField }: AdminFieldProps) {
  return (
    <input
      id={fieldId}
      type="date"
      value={String(value ?? '')}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? errorId : undefined}
      onChange={(event) => setField(adminFieldName(column), event.currentTarget.value)}
    />
  )
}

function AdminTextField({ column, fieldId, errorId, value, invalid, setField }: AdminFieldProps) {
  return (
    <IrisInput
      id={fieldId}
      type={inputType(column)}
      value={String(value ?? '')}
      placeholder={column.placeholder}
      invalid={invalid}
      ariaDescribedby={invalid ? errorId : undefined}
      onChange={(event) =>
        setField(adminFieldName(column), coerceAdminFieldValue(column, event.currentTarget.value))
      }
    />
  )
}

function AdminFieldControl(props: AdminFieldProps): React.ReactElement {
  if (props.column.type === 'boolean') return <AdminBooleanField {...props} />
  if (props.column.type === 'select') return <AdminSelectField {...props} />
  if (props.column.type === 'date') return <AdminDateField {...props} />
  return <AdminTextField {...props} />
}

function AdminField({
  column,
  fieldId,
  errorId,
  value,
  invalid,
  error,
  setField,
}: AdminFieldProps) {
  const field = adminFieldName(column)
  return (
    <div data-iris-admin-field={field} style={stackStyle}>
      <label htmlFor={fieldId}>
        {column.title}
        {column.required ? ' *' : ''}
      </label>
      <AdminFieldControl
        column={column}
        fieldId={fieldId}
        errorId={errorId}
        value={value}
        invalid={invalid}
        setField={setField}
      />
      {invalid ? (
        <span id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
}

export function AdminEditor({
  page,
  controller,
  editor,
  message,
  id,
}: {
  page: AdminDataPage
  controller: AdminController
  editor: AdminEditorSnapshot
  message: AdminMessage
  id: string
}): React.ReactElement | null {
  if (editor.mode === 'idle') return null
  return (
    <form
      data-iris-admin-editor={editor.mode}
      aria-label={message(editor.mode === 'create' ? 'editorCreate' : 'editorEdit', {
        title: page.title ?? page.key,
      })}
      style={stackStyle}
      onSubmit={(event) => {
        event.preventDefault()
        void controller.save()
      }}
    >
      {controller.editableColumns.map((column) => {
        const field = adminFieldName(column)
        const fieldId = `${id}-${field}`
        const errorId = `${fieldId}-error`
        return (
          <AdminField
            key={column.key}
            column={column}
            fieldId={fieldId}
            errorId={errorId}
            value={editor.draft[field]}
            invalid={Boolean(editor.errors[field])}
            error={editor.errors[field]}
            setField={controller.setField}
          />
        )
      })}
      <div style={rowStyle}>
        <IrisButton type="submit" loading={editor.saving}>
          {message('save')}
        </IrisButton>
        <IrisButton variant="outline" onClick={() => controller.cancelEdit()}>
          {message('cancel')}
        </IrisButton>
      </div>
    </form>
  )
}
