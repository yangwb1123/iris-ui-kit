import { IrisButton, IrisBadge, IrisCard } from '@iris-ui-kit/react'

const LIGHT_TOKENS = [
  ['--iris-background', '#ffffff', '#0b1020'],
  ['--iris-foreground', '#0f172a', '#e2e8f0'],
  ['--iris-surface', '#f8fafc', '#111827'],
  ['--iris-border', '#e2e8f0', '#1f2937'],
  ['--iris-muted', '#64748b', '#94a3b8'],
  ['--iris-primary', '#6366f1', '#818cf8'],
  ['--iris-danger', '#ef4444', '#f87171'],
  ['--iris-success', '#10b981', '#34d399'],
  ['--iris-warning', '#f59e0b', '#fbbf24'],
]

export function SkinComparison() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section className="section">
        <h2 className="section-title">Token Comparison: Light vs Dark</h2>
        <p style={{ color: 'var(--iris-muted)', fontSize: 14, margin: '0 0 16px' }}>
          Every Iris UI token has distinct light and dark values. Switch between skins in the Skin
          System tab above to see all components re-theme instantly.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Light theme preview */}
          <IrisCard style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '12px 16px',
                fontWeight: 700,
                fontSize: 15,
                borderBottom: '1px solid var(--iris-border)',
              }}
            >
              ☀️ Light Theme
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <IrisButton variant="solid" size="sm">
                  Button
                </IrisButton>
                <IrisButton variant="outline" size="sm">
                  Outline
                </IrisButton>
                <IrisBadge tone="primary">Badge</IrisBadge>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--iris-border)', textAlign: 'left' }}>
                    <th style={{ padding: '4px 8px' }}>Token</th>
                    <th style={{ padding: '4px 8px' }}>Value</th>
                    <th style={{ padding: '4px 8px' }}>Swatch</th>
                  </tr>
                </thead>
                <tbody>
                  {LIGHT_TOKENS.map(([name, light]) => (
                    <tr key={name} style={{ borderBottom: '1px solid var(--iris-border)' }}>
                      <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 12 }}>
                        {name}
                      </td>
                      <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 12 }}>
                        {light}
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            background: light,
                            border: '1px solid var(--iris-border)',
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </IrisCard>

          {/* Dark theme preview */}
          <div
            style={{
              padding: 0,
              overflow: 'hidden',
              borderRadius: 'var(--iris-radius-lg)',
              border: '1px solid #1f2937',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                fontWeight: 700,
                fontSize: 15,
                borderBottom: '1px solid #1f2937',
                background: '#111827',
                color: '#e2e8f0',
              }}
            >
              🌙 Dark Theme
            </div>
            <div
              style={{
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                background: '#0b1020',
                color: '#e2e8f0',
                fontFamily: 'var(--iris-font-family)',
              }}
            >
              {/* Apply dark CSS vars locally */}
              <div
                style={
                  {
                    '--iris-background': '#0b1020',
                    '--iris-foreground': '#e2e8f0',
                    '--iris-border': '#1f2937',
                    '--iris-muted': '#94a3b8',
                    '--iris-primary': '#818cf8',
                    '--iris-surface': '#111827',
                    '--iris-danger': '#f87171',
                    '--iris-success': '#34d399',
                    '--iris-warning': '#fbbf24',
                    '--iris-primary-foreground': '#0b1020',
                  } as Record<string, string>
                }
              >
                <div style={{ display: 'flex', gap: 8 }}>
                  <IrisButton variant="solid" size="sm">
                    Button
                  </IrisButton>
                  <IrisButton variant="outline" size="sm">
                    Outline
                  </IrisButton>
                  <IrisBadge tone="primary">Badge</IrisBadge>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--iris-border)', textAlign: 'left' }}>
                      <th style={{ padding: '4px 8px' }}>Token</th>
                      <th style={{ padding: '4px 8px' }}>Value</th>
                      <th style={{ padding: '4px 8px' }}>Swatch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LIGHT_TOKENS.map(([name, , dark]) => (
                      <tr key={name} style={{ borderBottom: '1px solid var(--iris-border)' }}>
                        <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 12 }}>
                          {name}
                        </td>
                        <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 12 }}>
                          {dark}
                        </td>
                        <td style={{ padding: '4px 8px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 20,
                              height: 20,
                              borderRadius: 4,
                              background: dark,
                              border: '1px solid var(--iris-border)',
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
