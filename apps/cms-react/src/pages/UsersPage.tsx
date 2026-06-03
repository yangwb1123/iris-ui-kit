import { IrisAvatar, IrisBadge } from '@iris-ui/react'

type Status = 'active' | 'invited' | 'suspended'
const users: { name: string; email: string; role: string; status: Status }[] = [
  { name: 'Ada Lovelace', email: 'ada@iris.dev', role: 'Owner', status: 'active' },
  { name: 'Alan Turing', email: 'alan@iris.dev', role: 'Admin', status: 'active' },
  { name: 'Grace Hopper', email: 'grace@iris.dev', role: 'Editor', status: 'invited' },
  { name: 'Linus T.', email: 'linus@iris.dev', role: 'Viewer', status: 'suspended' },
]
const tone = (s: Status): 'success' | 'warning' | 'danger' =>
  s === 'active' ? 'success' : s === 'invited' ? 'warning' : 'danger'

export function UsersPage() {
  return (
    <section>
      <h1 className="page-title">All users</h1>
      <p className="page-desc">
        A plain table themed by Iris tokens, with Avatar + Badge primitives.
      </p>
      <table className="cms-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.email}>
              <td>
                <span className="cms-user">
                  <IrisAvatar name={u.name} size={32} />
                  <span>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div style={{ color: 'var(--iris-muted)', fontSize: 12 }}>{u.email}</div>
                  </span>
                </span>
              </td>
              <td>{u.role}</td>
              <td>
                <IrisBadge tone={tone(u.status)} variant="subtle">
                  {u.status}
                </IrisBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
