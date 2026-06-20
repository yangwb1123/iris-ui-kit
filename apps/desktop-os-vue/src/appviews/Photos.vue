<script setup lang="ts">
/**
 * A simple gradient/emoji gallery grid; clicking a tile enlarges it. The Vue
 * twin of the React `PhotosApp` — gradients/emoji are rendered via normal
 * template nodes (no raw-HTML injection).
 */
import { ref } from 'vue'

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

const active = ref<Tile | null>(null)
</script>

<template>
  <button
    v-if="active"
    type="button"
    class="photo-full"
    :aria-label="`Close ${active.caption}`"
    :style="{ background: active.gradient }"
    @click="active = null"
  >
    <span class="photo-full-emoji">{{ active.emoji }}</span>
    <span class="photo-full-caption">{{ active.caption }}</span>
    <span class="photo-full-hint">click to go back</span>
  </button>

  <div v-else class="photo-grid">
    <button
      v-for="t in TILES"
      :key="t.id"
      type="button"
      class="photo-tile"
      :aria-label="`Enlarge ${t.caption}`"
      :style="{ background: t.gradient }"
      @click="active = t"
    >
      <span class="photo-tile-emoji">{{ t.emoji }}</span>
      <span class="photo-tile-caption">{{ t.caption }}</span>
    </button>
  </div>
</template>

<style scoped>
.photo-grid {
  padding: 14px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
  color: var(--os-window-fg);
}
.photo-tile {
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
.photo-tile:hover {
  transform: scale(1.04);
}
.photo-tile-emoji {
  font-size: 40px;
  line-height: 1;
}
.photo-tile-caption {
  font-size: 12px;
  font-weight: 600;
}
.photo-full {
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
.photo-full-emoji {
  font-size: 120px;
  line-height: 1;
}
.photo-full-caption {
  font-size: 22px;
  font-weight: 600;
}
.photo-full-hint {
  font-size: 12px;
  opacity: 0.8;
}
</style>
