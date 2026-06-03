import { For, type JSX } from 'solid-js'
import { IrisAvatar, IrisBadge } from '@iris-ui/solid'

type Status = 'active' | 'invited' | 'suspended'
const users: { name: string; email: string; role: string; status: Status }[] = [
  { name: 'Ada Lovelace', email: 'ada@iris.dev', role: 'Owner', status: 'active' },
  { name: 'Alan Turing', email: 'alan@iris.dev', role: 'Admin', status: 'active' },
  { name: 'Grace Hopper', email: 'grace@iris.dev', role: 'Editor', status: 'invited' },
  { name: 'Linus T.', email: 'linus@iris.dev', role: 'Viewer', status: 'suspended' },
]
const tone = (s: Status): 'success' | 'warning' | 'danger' =>
  s === 'active' ? 'success' : s === 'invited' ? 'warning' : 'danger'

export function UsersPage(): JSX.Element {
  return (
    <section>
      <h1 class="page-title">All users</h1>
      <p class="page-desc">A plain table themed by Iris tokens, with Avatar + Badge primitives.</p>
      <table class="cms-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <For each={users}>
            {(u) => (
              <tr>
                <td>
                  <span class="cms-user">
                    <IrisAvatar name={u.name} size={32} />
                    <span>
                      <div style={{ 'font-weight': 600 }}>{u.name}</div>
                      <div style={{ color: 'var(--iris-muted)', 'font-size': '12px' }}>
                        {u.email}
                      </div>
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
            )}
          </For>
        </tbody>
      </table>
    </section>
  )
}
