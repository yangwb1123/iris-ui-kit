import { useState, useCallback, useEffect } from 'react'
import { IrisButton, IrisBadge, useSkin, IrisCard, IrisSwitch } from '@iris-ui/react'

interface TokenGroup {
  label: string
  tokens: { var: string; label: string; type: 'color' | 'size' | 'radius' | 'number' }[]
}

const GROUPS: TokenGroup[] = [
  {
    label: 'Colors',
    tokens: [
      { var: '--iris-background', label: 'Background', type: 'color' },
      { var: '--iris-foreground', label: 'Foreground', type: 'color' },
      { var: '--iris-primary', label: 'Primary', type: 'color' },
      { var: '--iris-surface', label: 'Surface', type: 'color' },
      { var: '--iris-border', label: 'Border', type: 'color' },
      { var: '--iris-muted', label: 'Muted', type: 'color' },
      { var: '--iris-danger', label: 'Danger', type: 'color' },
      { var: '--iris-success', label: 'Success', type: 'color' },
      { var: '--iris-warning', label: 'Warning', type: 'color' },
    ],
  },
  {
    label: 'Spacing',
    tokens: [
      { var: '--iris-padding-sm', label: 'Padding SM', type: 'size' },
      { var: '--iris-padding-md', label: 'Padding MD', type: 'size' },
      { var: '--iris-padding-lg', label: 'Padding LG', type: 'size' },
      { var: '--iris-gap-sm', label: 'Gap SM', type: 'size' },
      { var: '--iris-gap-md', label: 'Gap MD', type: 'size' },
      { var: '--iris-gap-lg', label: 'Gap LG', type: 'size' },
    ],
  },
  {
    label: 'Radii',
    tokens: [
      { var: '--iris-radius-sm', label: 'Radius SM', type: 'radius' },
      { var: '--iris-radius-md', label: 'Radius MD', type: 'radius' },
      { var: '--iris-radius-lg', label: 'Radius LG', type: 'radius' },
    ],
  },
]

function getCSSVar(name: string): string {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function TokenEditor({ token }: { token: TokenGroup['tokens'][0] }) {
  const { patch, resetPatch } = useSkin()
  const [value, setValue] = useState(() => getCSSVar(token.var))

  useEffect(() => {
    setValue(getCSSVar(token.var))
  }, [token.var])

  const handleChange = useCallback(
    (newValue: string) => {
      setValue(newValue)
      patch({ [token.var.replace('--iris-', 'iris.').replace(/-/g, '.')]: newValue })
    },
    [token.var, patch],
  )

  const handleReset = useCallback(() => {
    resetPatch()
    setValue(getCSSVar(token.var))
  }, [resetPatch, token.var])

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 28px',
        gap: 8,
        alignItems: 'center',
        padding: '4px 0',
      }}
    >
      <label style={{ fontSize: 13, color: 'var(--iris-foreground)' }}>{token.label}</label>
      {token.type === 'color' ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="color"
            value={value || '#000000'}
            onChange={(e) => handleChange(e.target.value)}
            style={{
              width: 32,
              height: 28,
              padding: 0,
              border: '1px solid var(--iris-border)',
              borderRadius: 4,
              cursor: 'pointer',
              background: 'none',
            }}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            style={{
              width: 90,
              fontSize: 12,
              fontFamily: 'monospace',
              padding: '2px 6px',
              border: '1px solid var(--iris-border)',
              borderRadius: 4,
              background: 'var(--iris-background)',
              color: 'var(--iris-foreground)',
            }}
          />
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          style={{
            width: 100,
            fontSize: 12,
            fontFamily: 'monospace',
            padding: '2px 6px',
            border: '1px solid var(--iris-border)',
            borderRadius: 4,
            background: 'var(--iris-background)',
            color: 'var(--iris-foreground)',
            textAlign: 'right',
          }}
        />
      )}
      <button
        onClick={handleReset}
        title="Reset to theme default"
        style={{
          width: 28,
          height: 28,
          border: '1px solid transparent',
          borderRadius: 4,
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 14,
          color: 'var(--iris-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ↺
      </button>
    </div>
  )
}

function LivePreview() {
  return (
    <div
      style={{
        padding: 24,
        background: 'var(--iris-surface)',
        borderRadius: 'var(--iris-radius-lg, 12px)',
        border: '1px solid var(--iris-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--iris-foreground)' }}>
        Live Preview
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <IrisButton variant="solid">Solid</IrisButton>
        <IrisButton variant="outline">Outline</IrisButton>
        <IrisButton variant="ghost">Ghost</IrisButton>
        <IrisButton variant="link">Link</IrisButton>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <IrisBadge tone="primary">Primary</IrisBadge>
        <IrisBadge tone="success">Success</IrisBadge>
        <IrisBadge tone="warning">Warning</IrisBadge>
        <IrisBadge tone="danger">Danger</IrisBadge>
        <IrisBadge tone="neutral">Neutral</IrisBadge>
      </div>

      <IrisCard style={{ padding: 16, background: 'var(--iris-background)' }}>
        <div style={{ fontSize: 14, color: 'var(--iris-foreground)' }}>
          This card uses <code>--iris-background</code>, <code>--iris-border</code>, and{' '}
          <code>--iris-radius-md</code>. Change the values above and watch it update.
        </div>
      </IrisCard>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
        }}
      >
        <div
          style={{
            padding: 'var(--iris-padding-md)',
            background: 'var(--iris-primary)',
            color: '#fff',
            borderRadius: 'var(--iris-radius-md)',
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          Primary Surface
        </div>
        <div
          style={{
            padding: 'var(--iris-padding-md)',
            background: 'var(--iris-surface)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-md)',
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          Surface + Border
        </div>
      </div>
    </div>
  )
}

export function ThemeEditor() {
  const [showEditor, setShowEditor] = useState(true)
  const { skin } = useSkin()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section className="section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Interactive Theme Editor
          </h2>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <IrisSwitch checked={showEditor} onChange={(v) => setShowEditor(v)} size="sm" />
            Show editor
          </label>
        </div>
        <p style={{ color: 'var(--iris-muted)', fontSize: 14, margin: '0 0 16px' }}>
          Edit Iris theme tokens in real-time. Changes are applied instantly via{' '}
          <code>useSkin().patch()</code> — no page reload needed.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: showEditor ? '380px 1fr' : '1fr',
            gap: 24,
          }}
        >
          {showEditor && (
            <div
              style={{
                padding: 16,
                background: 'var(--iris-surface)',
                borderRadius: 'var(--iris-radius-md, 6px)',
                border: '1px solid var(--iris-border)',
                maxHeight: 600,
                overflow: 'auto',
              }}
            >
              {GROUPS.map((group) => (
                <div key={group.label} style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: 'var(--iris-foreground)',
                      marginBottom: 8,
                      paddingBottom: 4,
                      borderBottom: '1px solid var(--iris-border)',
                    }}
                  >
                    {group.label}
                  </div>
                  {group.tokens.map((token) => (
                    <TokenEditor key={token.var} token={token} />
                  ))}
                </div>
              ))}
            </div>
          )}

          <LivePreview />
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Current Skin</h2>
        <pre
          style={{
            fontSize: 12,
            fontFamily: 'var(--iris-font-mono, monospace)',
            padding: 16,
            background: 'var(--iris-surface)',
            borderRadius: 8,
            border: '1px solid var(--iris-border)',
            overflow: 'auto',
            maxHeight: 300,
          }}
        >
          {JSON.stringify({ id: skin.id, type: skin.type, theme: skin.theme }, null, 2)}
        </pre>
      </section>
    </div>
  )
}
