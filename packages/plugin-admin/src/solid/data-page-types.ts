import type { JSX } from 'solid-js'
import { createAdminDataController } from '@iris-ui-kit/plugin-admin/core'
import type {
  AdminColumn,
  AdminDataPage,
  AdminMessageKey,
  AdminMessages,
} from '@iris-ui-kit/plugin-admin/core'

export type AdminController = ReturnType<typeof createAdminDataController>
export type AdminResourceState = ReturnType<AdminController['resource']['getState']>
export type AdminEditorState = ReturnType<AdminController['editor']['getState']>
export type AdminMessage = (
  key: AdminMessageKey,
  params?: Record<string, string | number>,
) => string

export const stackStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: 'var(--iris-gap-md)',
}

export const pageStackStyle: JSX.CSSProperties = {
  ...stackStyle,
  gap: 'var(--iris-admin-page-gap, var(--iris-gap-md))',
}

export const rowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'flex-wrap': 'wrap',
  gap: 'var(--iris-gap-sm)',
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function inputType(column: AdminColumn): 'text' | 'email' | 'number' {
  if (column.type === 'email' || column.type === 'number') return column.type
  return 'text'
}

export function ariaInvalid(invalid: boolean): 'true' | undefined {
  return invalid ? 'true' : undefined
}

export function errorReference(invalid: boolean, errorId: string): string | undefined {
  return invalid ? errorId : undefined
}

export type { AdminColumn, AdminDataPage, AdminMessages }
