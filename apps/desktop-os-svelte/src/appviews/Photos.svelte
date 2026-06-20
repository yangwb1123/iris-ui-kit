<script lang="ts">
  /**
   * A simple gradient/emoji gallery grid; clicking a tile enlarges it (and
   * clicking again returns to the grid). The Svelte 5 twin of the React
   * `PhotosApp` — every tile is plain markup with CSS gradients + an emoji, so
   * there is no raw-HTML injection (no `{@html}`).
   */
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

  let active = $state<Tile | null>(null)
</script>

{#if active}
  <button
    type="button"
    class="enlarged"
    style="background: {active.gradient}"
    aria-label={`Close ${active.caption}`}
    onclick={() => (active = null)}
  >
    <span class="enlarged-emoji">{active.emoji}</span>
    <span class="enlarged-caption">{active.caption}</span>
    <span class="enlarged-hint">click to go back</span>
  </button>
{:else}
  <div class="grid">
    {#each TILES as t (t.id)}
      <button
        type="button"
        class="tile"
        style="background: {t.gradient}"
        aria-label={`Enlarge ${t.caption}`}
        onclick={() => (active = t)}
      >
        <span class="tile-emoji">{t.emoji}</span>
        <span class="tile-caption">{t.caption}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .grid {
    padding: 14px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 12px;
    color: var(--os-window-fg);
  }
  .tile {
    border: none;
    padding: 0;
    cursor: zoom-in;
    border-radius: 12px;
    overflow: hidden;
    aspect-ratio: 1 / 1;
    display: grid;
    place-items: center;
    gap: 6px;
    color: #fff;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
    transition: transform 120ms ease;
  }
  .tile:hover {
    transform: scale(1.04);
  }
  .tile-emoji {
    font-size: 40px;
    line-height: 1;
  }
  .tile-caption {
    font-size: 12px;
    font-weight: 600;
  }
  .enlarged {
    height: 100%;
    width: 100%;
    border: none;
    cursor: zoom-out;
    display: grid;
    place-items: center;
    gap: 16px;
    color: #fff;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  }
  .enlarged-emoji {
    font-size: 120px;
    line-height: 1;
  }
  .enlarged-caption {
    font-size: 22px;
    font-weight: 600;
  }
  .enlarged-hint {
    font-size: 12px;
    opacity: 0.8;
  }
</style>
