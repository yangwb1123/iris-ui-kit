import { createProTableStore, type ProTableColumn } from '@iris-ui-kit/plugin-pro-table/core'
import { IrisProTable } from '@iris-ui-kit/plugin-pro-table/react'

interface Product {
  id: number
  name: string
  category: string
  price: number
  stock: number
  status: string
}

const PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Ergonomic Keyboard',
    category: 'Electronics',
    price: 89.99,
    stock: 42,
    status: 'active',
  },
  { id: 2, name: 'USB-C Hub', category: 'Electronics', price: 34.5, stock: 120, status: 'active' },
  {
    id: 3,
    name: 'Standing Desk',
    category: 'Furniture',
    price: 399.0,
    stock: 15,
    status: 'active',
  },
  { id: 4, name: 'Monitor Arm', category: 'Furniture', price: 79.99, stock: 0, status: 'inactive' },
  {
    id: 5,
    name: 'Mechanical Mouse',
    category: 'Electronics',
    price: 59.99,
    stock: 88,
    status: 'active',
  },
  { id: 6, name: 'Laptop Stand', category: 'Furniture', price: 45.0, stock: 33, status: 'active' },
  {
    id: 7,
    name: 'Webcam 4K',
    category: 'Electronics',
    price: 129.99,
    stock: 0,
    status: 'inactive',
  },
  { id: 8, name: 'Desk Lamp', category: 'Furniture', price: 65.0, stock: 27, status: 'active' },
  {
    id: 9,
    name: 'Noise Canceling Headphones',
    category: 'Electronics',
    price: 249.99,
    stock: 54,
    status: 'active',
  },
  {
    id: 10,
    name: 'Cable Management Tray',
    category: 'Furniture',
    price: 29.99,
    stock: 200,
    status: 'active',
  },
  {
    id: 11,
    name: 'USB Microphone',
    category: 'Electronics',
    price: 99.99,
    stock: 18,
    status: 'active',
  },
  {
    id: 12,
    name: 'Ergonomic Chair',
    category: 'Furniture',
    price: 599.0,
    stock: 7,
    status: 'active',
  },
]

const COLUMNS: ProTableColumn[] = [
  { key: 'name', title: 'Product', sortable: true, filterable: true, editable: true, width: 200 },
  { key: 'category', title: 'Category', sortable: true, filterable: true, width: 130 },
  {
    key: 'price',
    title: 'Price',
    sortable: true,
    width: 100,
    align: 'right',
    editable: true,
    editor: 'number',
  },
  { key: 'stock', title: 'Stock', sortable: true, width: 90, align: 'right' },
  { key: 'status', title: 'Status', sortable: true, filterable: true, width: 110 },
]

const proTableStore = createProTableStore({
  columns: COLUMNS,
  data: PRODUCTS as unknown as Record<string, unknown>[],
  rowKey: 'id',
  mode: 'client',
  pageSize: 10,
})

/**
 * ProTable demo page — showcases @iris-ui-kit/plugin-pro-table with
 * client-mode data, sorting, filtering, inline editing, and column resize.
 */
export function ProTablePage() {
  return (
    <div data-page="pro-table">
      <h2 style={{ margin: '0 0 4px' }}>Products</h2>
      <p style={{ margin: '0 0 16px', color: 'var(--iris-muted)', fontSize: 14 }}>
        CRUD data table powered by <code>@iris-ui-kit/plugin-pro-table</code> with client-side
        sorting, filtering, inline editing, and column resize.
      </p>

      <IrisProTable store={proTableStore} columnReorder />
    </div>
  )
}
