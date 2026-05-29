import { useTheme, COLOR_TOKENS, SPACING_TOKENS, RADII_TOKENS } from '@iris-ui/react'

export function TokensShowcase() {
  const { theme } = useTheme()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section className="section">
        <h2 className="section-title">Colors</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          {COLOR_TOKENS.map((token) => (
            <div
              key={token}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: 12,
                background: 'var(--iris-background)',
                border: '1px solid var(--iris-border)',
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 6,
                  border: '1px solid var(--iris-border)',
                  background: `var(--${token.replace(/\./g, '-')})`,
                }}
              />
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{token}</span>
              <span
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 11,
                  color: 'var(--iris-muted)',
                }}
              >
                {theme.colors[token]}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Spacing</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          {SPACING_TOKENS.map((token) => (
            <div
              key={token}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: 12,
                background: 'var(--iris-background)',
                border: '1px solid var(--iris-border)',
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  height: 14,
                  background: 'var(--iris-primary)',
                  borderRadius: 2,
                  width: `var(--${token.replace(/\./g, '-')})`,
                }}
              />
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{token}</span>
              <span
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 11,
                  color: 'var(--iris-muted)',
                }}
              >
                {theme.spacing[token]}px
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Radii</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          {RADII_TOKENS.map((token) => (
            <div
              key={token}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: 12,
                background: 'var(--iris-background)',
                border: '1px solid var(--iris-border)',
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  background: 'var(--iris-primary)',
                  borderRadius: `var(--${token.replace(/\./g, '-')})`,
                }}
              />
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{token}</span>
              <span
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 11,
                  color: 'var(--iris-muted)',
                }}
              >
                {theme.radii[token]}px
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
