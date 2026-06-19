import * as React from 'react'

interface Tile {
  id: string
  emoji: string
  caption: string
  gradient: string
}

const TILES: Tile[] = [
  {
    id: 'sunset',
    emoji: '🌅',
    caption: 'Sunset',
    gradient: 'linear-gradient(135deg,#ff9a9e,#fad0c4)',
  },
  {
    id: 'ocean',
    emoji: '🌊',
    caption: 'Ocean',
    gradient: 'linear-gradient(135deg,#2193b0,#6dd5ed)',
  },
  {
    id: 'forest',
    emoji: '🌲',
    caption: 'Forest',
    gradient: 'linear-gradient(135deg,#11998e,#38ef7d)',
  },
  {
    id: 'desert',
    emoji: '🏜️',
    caption: 'Desert',
    gradient: 'linear-gradient(135deg,#f7971e,#ffd200)',
  },
  {
    id: 'aurora',
    emoji: '🌌',
    caption: 'Aurora',
    gradient: 'linear-gradient(135deg,#654ea3,#42c2ff)',
  },
  {
    id: 'bloom',
    emoji: '🌸',
    caption: 'Bloom',
    gradient: 'linear-gradient(135deg,#ee9ca7,#ffdde1)',
  },
  {
    id: 'peaks',
    emoji: '🏔️',
    caption: 'Peaks',
    gradient: 'linear-gradient(135deg,#83a4d4,#b6fbff)',
  },
  {
    id: 'night',
    emoji: '🌃',
    caption: 'Night',
    gradient: 'linear-gradient(135deg,#0f2027,#2c5364)',
  },
  {
    id: 'meadow',
    emoji: '🌻',
    caption: 'Meadow',
    gradient: 'linear-gradient(135deg,#f6d365,#fda085)',
  },
]

/** A simple gradient/emoji gallery grid; clicking a tile enlarges it. */
export function PhotosApp() {
  const [active, setActive] = React.useState<Tile | null>(null)

  if (active) {
    return (
      <button
        type="button"
        onClick={() => setActive(null)}
        aria-label={`Close ${active.caption}`}
        style={{
          height: '100%',
          width: '100%',
          border: 'none',
          cursor: 'zoom-out',
          display: 'grid',
          placeItems: 'center',
          gap: 16,
          background: active.gradient,
          color: '#fff',
          textShadow: '0 2px 8px rgba(0,0,0,0.35)',
        }}
      >
        <span style={{ fontSize: 120, lineHeight: 1 }}>{active.emoji}</span>
        <span style={{ fontSize: 22, fontWeight: 600 }}>{active.caption}</span>
        <span style={{ fontSize: 12, opacity: 0.8 }}>click to go back</span>
      </button>
    )
  }

  return (
    <div
      style={{
        padding: 14,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
        gap: 12,
        color: 'var(--os-window-fg)',
      }}
    >
      {TILES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setActive(t)}
          aria-label={`Enlarge ${t.caption}`}
          style={{
            border: 'none',
            padding: 0,
            cursor: 'zoom-in',
            borderRadius: 12,
            overflow: 'hidden',
            aspectRatio: '1 / 1',
            display: 'grid',
            placeItems: 'center',
            gap: 6,
            background: t.gradient,
            color: '#fff',
            textShadow: '0 1px 4px rgba(0,0,0,0.35)',
            transition: 'transform 120ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <span style={{ fontSize: 40, lineHeight: 1 }}>{t.emoji}</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{t.caption}</span>
        </button>
      ))}
    </div>
  )
}
