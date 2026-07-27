import { IrisAdminApp, type AdminAppSchema } from '@iris-ui-kit/plugin-admin/react'

const SCHEMA: AdminAppSchema = {
  title: 'My App',
  nav: [
    { key: 'users', title: 'Users', icon: 'more-horizontal', order: 1 },
    { key: 'products', title: 'Products', icon: 'file', order: 2 },
    { key: 'orders', title: 'Orders', icon: 'clock', order: 3 },
  ],
  pages: [
    {
      type: 'data',
      key: 'users',
      title: 'Users',
      columns: [
        { key: 'name', title: 'Name' },
        { key: 'email', title: 'Email' },
        { key: 'role', title: 'Role' },
      ],
      data: [
        { name: 'Ada Lovelace', email: 'ada@example.com', role: 'Admin' },
        { name: 'Alan Turing', email: 'alan@example.com', role: 'Editor' },
        { name: 'Grace Hopper', email: 'grace@example.com', role: 'Viewer' },
      ],
    },
    {
      type: 'data',
      key: 'products',
      title: 'Products',
      columns: [
        { key: 'name', title: 'Name' },
        { key: 'price', title: 'Price' },
        { key: 'stock', title: 'Stock' },
      ],
      data: [
        { name: 'Widget A', price: '$9.99', stock: '42' },
        { name: 'Widget B', price: '$14.99', stock: '120' },
        { name: 'Widget C', price: '$29.99', stock: '15' },
      ],
    },
    {
      type: 'data',
      key: 'orders',
      title: 'Orders',
      columns: [
        { key: 'id', title: 'Order #' },
        { key: 'customer', title: 'Customer' },
        { key: 'total', title: 'Total' },
        { key: 'status', title: 'Status' },
      ],
      data: [
        { id: 'ORD-001', customer: 'Ada Lovelace', total: '$59.99', status: 'Shipped' },
        { id: 'ORD-002', customer: 'Alan Turing', total: '$29.99', status: 'Pending' },
        { id: 'ORD-003', customer: 'Grace Hopper', total: '$89.99', status: 'Delivered' },
      ],
    },
  ],
}

export function AdminShowcase() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section className="section">
        <h2 className="section-title">Schema-Driven Admin</h2>
        <p style={{ color: 'var(--iris-muted)', fontSize: 14, margin: '0 0 16px' }}>
          A complete admin CRUD app generated from a declarative schema via{' '}
          <code>@iris-ui-kit/plugin-admin</code>. Each page is a paginated table with sorting,
          backed by the same data engine as IrisTable.
        </p>

        <div
          style={{
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-lg, 8px)',
            overflow: 'hidden',
          }}
        >
          <IrisAdminApp schema={SCHEMA} />
        </div>
      </section>
    </div>
  )
}
