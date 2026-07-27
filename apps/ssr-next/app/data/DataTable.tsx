'use client'

import { IrisTable, type IrisTableColumn } from '@iris-ui-kit/react'

export interface TeamRow extends Record<string, unknown> {
  id: number
  name: string
  role: string
  status: string
}

const columns: IrisTableColumn<TeamRow>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'role', title: 'Role' },
  { key: 'status', title: 'Status' },
]

export function DataTable({ rows }: { rows: TeamRow[] }) {
  return <IrisTable<TeamRow> columns={columns} data={rows} rowKey="id" />
}
