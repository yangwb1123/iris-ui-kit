import { useEffect, useState, type CSSProperties } from 'react'
import { IrisButton, useSkin, type Skin, type SkinManifestEntry } from '@iris-ui-kit/react'
import { demoCatalog, sampleSkinJson, STORAGE_KEY } from '../demo-skins'

const mono: CSSProperties = { fontFamily: 'ui-monospace, monospace', fontSize: 12 }
const muted: CSSProperties = { ...mono, color: 'var(--iris-muted)' }

function hex(value: string | undefined): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#888888'
}

function swatchColor(skin: Skin, token: string): string {
  const v = skin.tokens?.[token as keyof NonNullable<Skin['tokens']>]
  return typeof v === 'string' ? v : 'var(--iris-muted)'
}

export function SkinsShowcase() {
  const {
    skin,
    setSkin,
    setMode,
    getMode,
    getActiveId,
    availableSkins,
    loadSkin,
    useFromCatalog,
    patch,
    resetPatch,
  } = useSkin()

  const [entries, setEntries] = useState<SkinManifestEntry[]>([])
  const [installing, setInstalling] = useState<string | null>(null)
  const [installed, setInstalled] = useState<string[]>([])
  const [installError, setInstallError] = useState<string | null>(null)
  const [json, setJson] = useState(sampleSkinJson)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [stored, setStored] = useState<string | null>(null)

  // The engine is the single source of truth: the logical selection (pre
  // system-variant remap) and the current mode drive all three controls.
  const activeId = getActiveId()
  const following = getMode() === 'system'

  // Picking 'auto' follows the system; any other id pins a fixed skin.
  const selectSkin = (id: string) => {
    if (id === 'auto') setMode('system')
    else setMode('fixed')
    setSkin(id)
  }

  useEffect(() => {
    demoCatalog
      .load()
      .then(setEntries)
      .catch(() => setEntries([]))
  }, [])

  // Reflect the persisted selection whenever the active skin changes.
  useEffect(() => {
    try {
      setStored(localStorage.getItem(STORAGE_KEY))
    } catch {
      setStored(null)
    }
  }, [skin.id])

  const toggleFollow = (next: boolean) => {
    selectSkin(next ? 'auto' : 'light')
  }

  const installFromCatalog = async (id: string) => {
    setInstalling(id)
    setInstallError(null)
    try {
      await useFromCatalog(id)
      setInstalled((prev) => (prev.includes(id) ? prev : [...prev, id]))
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : String(e))
    } finally {
      setInstalling(null)
    }
  }

  const loadFromJson = async () => {
    setLoadError(null)
    try {
      await loadSkin(JSON.parse(json) as Skin)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }

  const customEntries = Object.entries(skin.custom)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Active skin + custom-token visuals */}
      <section className="section">
        <h2 className="section-title">Active skin</h2>
        <div
          style={{
            borderRadius: 12,
            padding: 20,
            color: '#fff',
            background: 'var(--brand-gradient, var(--iris-primary))',
            boxShadow: 'var(--brand-shadow, none)',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700 }}>{skin.name}</div>
          <div style={{ ...mono, opacity: 0.9 }}>
            id: {skin.id} · type: {skin.type}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 16 }}>
          <div>
            <div style={muted}>lineage (base → leaf)</div>
            <div style={mono}>{skin.lineage.join(' → ')}</div>
          </div>
          <div>
            <div style={muted}>custom tokens</div>
            {customEntries.length === 0 ? (
              <div style={mono}>— none —</div>
            ) : (
              customEntries.map(([k, v]) => (
                <div key={k} style={mono}>
                  {k}: <span style={{ color: 'var(--iris-muted)' }}>{String(v)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="section">
        <h2 className="section-title">Skin gallery</h2>
        <p style={{ ...muted, marginTop: 0 }}>
          Built-in <code>light</code>/<code>dark</code> base skins plus presets composed via{' '}
          <code>extends</code> + token overrides. Click to switch.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          {availableSkins().map((s) => {
            const active = s.id === activeId
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSkin(s.id)}
                aria-pressed={active}
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  padding: 12,
                  borderRadius: 10,
                  background: 'var(--iris-background)',
                  border: `2px solid ${active ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
                  font: 'inherit',
                  color: 'var(--iris-foreground)',
                }}
              >
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {['iris.primary', 'iris.accent', 'iris.background'].map((t) => (
                    <span
                      key={t}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: '1px solid var(--iris-border)',
                        background: swatchColor(s, t),
                      }}
                    />
                  ))}
                </div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name ?? s.id}</div>
                <div style={muted}>
                  {s.id}
                  {s.extends ? ` · extends ${String(s.extends)}` : ''}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Follow system */}
      <section className="section">
        <h2 className="section-title">Follow system</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={following}
            onChange={(e) => toggleFollow(e.target.checked)}
          />
          <span>
            Follow OS light/dark — uses the <code>auto</code> skin&rsquo;s <code>variants</code> (
            {'{ light: sunrise, dark: ocean }'}) via <code>prefers-color-scheme</code>.
          </span>
        </label>
        <p style={muted}>Toggle your OS appearance to see the resolved skin flip live.</p>
      </section>

      {/* Live token editor */}
      <section className="section">
        <h2 className="section-title">Live token editor (non-destructive patch)</h2>
        <p style={{ ...muted, marginTop: 0 }}>
          Edits overlay the active skin via <code>patch()</code> without mutating the registered
          skin — <code>resetPatch()</code> clears them.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end' }}>
          {(['iris.primary', 'iris.background', 'iris.accent'] as const).map((token) => (
            <label key={token} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={mono}>{token}</span>
              <input
                type="color"
                value={hex(skin.theme.colors[token])}
                onChange={(e) => patch({ tokens: { [token]: e.target.value } })}
              />
            </label>
          ))}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={mono}>iris.radius.md: {skin.theme.radii['iris.radius.md']}px</span>
            <input
              type="range"
              min={0}
              max={24}
              value={skin.theme.radii['iris.radius.md']}
              onChange={(e) => patch({ tokens: { 'iris.radius.md': Number(e.target.value) } })}
            />
          </label>
          <IrisButton variant="outline" size="sm" onClick={() => resetPatch()}>
            Reset edits
          </IrisButton>
        </div>
      </section>

      {/* Marketplace catalog */}
      <section className="section">
        <h2 className="section-title">Marketplace catalog</h2>
        <p style={{ ...muted, marginTop: 0 }}>
          A manifest + skin documents served by an injected <code>fetch</code> (no server).
          &ldquo;Install&rdquo; lazy-fetches, validates, registers, and applies the skin.
        </p>
        {entries.length === 0 ? (
          <div style={muted}>Loading catalog…</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {entries.map((e) => (
              <div
                key={e.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: 'var(--iris-background)',
                  border: '1px solid var(--iris-border)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{e.name ?? e.id}</div>
                  <div style={muted}>{e.id}</div>
                </div>
                <IrisButton
                  size="sm"
                  disabled={installing === e.id}
                  onClick={() => installFromCatalog(e.id)}
                >
                  {installing === e.id
                    ? 'Installing…'
                    : installed.includes(e.id)
                      ? 'Use again'
                      : 'Install'}
                </IrisButton>
              </div>
            ))}
          </div>
        )}
        {installError ? (
          <p style={{ ...mono, color: 'var(--iris-danger)', marginTop: 10 }}>{installError}</p>
        ) : null}
      </section>

      {/* Load from JSON */}
      <section className="section">
        <h2 className="section-title">Load a skin from JSON</h2>
        <p style={{ ...muted, marginTop: 0 }}>
          Paste a skin document — <code>loadSkin()</code> validates it before applying.
        </p>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          spellCheck={false}
          rows={10}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 12,
            padding: 12,
            borderRadius: 8,
            border: '1px solid var(--iris-border)',
            background: 'var(--iris-background)',
            color: 'var(--iris-foreground)',
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <IrisButton size="sm" onClick={loadFromJson}>
            Load skin
          </IrisButton>
          {loadError ? (
            <span style={{ ...mono, color: 'var(--iris-danger)' }}>{loadError}</span>
          ) : null}
        </div>
      </section>

      {/* Persistence */}
      <section className="section">
        <h2 className="section-title">Persistence</h2>
        <p style={{ ...muted, marginTop: 0 }}>
          The selection is saved to <code>localStorage["{STORAGE_KEY}"]</code> and restored on
          reload (FOUC-safe via <code>skinBootScript</code> in production).
        </p>
        <div style={mono}>stored value: {stored ?? '—'}</div>
      </section>
    </div>
  )
}
