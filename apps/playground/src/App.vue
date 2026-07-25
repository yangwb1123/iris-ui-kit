<script setup lang="ts">
import { computed, defineComponent, h, ref } from 'vue'
import {
  SkinProvider,
  useSkin,
  IrisSidebarLayout,
  IrisHeaderLayout,
  IrisToastViewport,
  COLOR_TOKENS,
  SPACING_TOKENS,
  RADII_TOKENS,
} from '@iris-ui/vue'
import { skinEngine } from './demo-skins'
import SkinsShowcase from './sections/SkinsShowcase.vue'
import ButtonShowcase from './sections/ButtonShowcase.vue'
import FormShowcase from './sections/FormShowcase.vue'
import DataShowcase from './sections/DataShowcase.vue'
import LayoutShowcase from './sections/LayoutShowcase.vue'
import PopoverShowcase from './sections/PopoverShowcase.vue'
import TooltipShowcase from './sections/TooltipShowcase.vue'
import OverlayShowcase from './sections/OverlayShowcase.vue'
import DatesShowcase from './sections/DatesShowcase.vue'
import AdvancedFormShowcase from './sections/AdvancedFormShowcase.vue'
import CompositeShowcase from './sections/CompositeShowcase.vue'
import DisplayShowcase from './sections/DisplayShowcase.vue'
import SkeletonsShowcase from './sections/SkeletonsShowcase.vue'
import BehaviorsShowcase from './sections/BehaviorsShowcase.vue'
import ChartsShowcase from './sections/ChartsShowcase.vue'
import DataResilienceShowcase from './sections/DataResilienceShowcase.vue'
import CalendarShowcase from './sections/CalendarShowcase.vue'

interface SectionEntry {
  id: string
  label: string
  group: string
  component: ReturnType<typeof defineComponent> | null
}

const sections: SectionEntry[] = [
  { id: 'skins', label: 'Skin System', group: 'Skins', component: SkinsShowcase },
  { id: 'button', label: 'Buttons', group: 'Primitives', component: ButtonShowcase },
  { id: 'display', label: 'Display', group: 'Primitives', component: DisplayShowcase },
  { id: 'form', label: 'Form (basic)', group: 'Primitives', component: FormShowcase },
  {
    id: 'adv-form',
    label: 'Form (advanced)',
    group: 'Primitives',
    component: AdvancedFormShowcase,
  },
  { id: 'dates', label: 'Dates & Time', group: 'Primitives', component: DatesShowcase },
  { id: 'composite', label: 'Composite', group: 'Components', component: CompositeShowcase },
  { id: 'overlay', label: 'Overlays', group: 'Components', component: OverlayShowcase },
  { id: 'popover', label: 'Popover', group: 'Components', component: PopoverShowcase },
  { id: 'tooltip', label: 'Tooltip', group: 'Components', component: TooltipShowcase },
  { id: 'data', label: 'Data', group: 'Components', component: DataShowcase },
  { id: 'behaviors', label: 'Behaviors', group: 'Components', component: BehaviorsShowcase },
  { id: 'layout', label: 'Layouts', group: 'Layouts', component: LayoutShowcase },
  { id: 'skeletons', label: 'System Skeletons', group: 'Layer 4', component: SkeletonsShowcase },
  { id: 'charts', label: 'Charts', group: 'Components', component: ChartsShowcase },
  {
    id: 'data-resilience',
    label: 'Data & Resilience',
    group: 'Core',
    component: DataResilienceShowcase,
  },
  { id: 'calendar', label: 'Calendar', group: 'Components', component: CalendarShowcase },
  { id: 'tokens', label: 'Theme Tokens', group: 'Foundation', component: null },
]

const groupOrder = ['Skins', 'Core', 'Primitives', 'Components', 'Layouts', 'Layer 4', 'Foundation']
const groupedSections = computed(() => {
  const out: Record<string, SectionEntry[]> = {}
  for (const s of sections) {
    if (!out[s.group]) out[s.group] = []
    out[s.group]!.push(s)
  }
  return groupOrder.map((g) => ({ group: g, items: out[g] ?? [] }))
})

const activeId = ref<string>(sections[0]!.id)
const activeSection = computed(() => sections.find((s) => s.id === activeId.value))

const TokensView = defineComponent({
  setup() {
    const { skin } = useSkin()
    const theme = computed(() => skin.value.theme)
    return () =>
      h('div', { class: 'tokens-view' }, [
        h('section', { class: 'section' }, [
          h('h2', { class: 'section-title' }, 'Colors'),
          h(
            'div',
            { class: 'color-grid' },
            COLOR_TOKENS.map((token) =>
              h('div', { class: 'color-tile', key: token }, [
                h('div', {
                  class: 'color-swatch',
                  style: { background: `var(--${token.replace(/\./g, '-')})` },
                }),
                h('span', { class: 'color-name' }, token),
                h('span', { class: 'color-value' }, theme.value.colors[token]),
              ]),
            ),
          ),
        ]),
        h('section', { class: 'section' }, [
          h('h2', { class: 'section-title' }, 'Spacing'),
          h(
            'div',
            { class: 'scale-grid' },
            SPACING_TOKENS.map((token) =>
              h('div', { class: 'scale-tile', key: token }, [
                h('div', {
                  class: 'scale-bar',
                  style: { width: `var(--${token.replace(/\./g, '-')})` },
                }),
                h('span', { class: 'scale-name' }, token),
                h('span', { class: 'scale-value' }, `${theme.value.spacing[token]}px`),
              ]),
            ),
          ),
        ]),
        h('section', { class: 'section' }, [
          h('h2', { class: 'section-title' }, 'Radii'),
          h(
            'div',
            { class: 'radii-grid' },
            RADII_TOKENS.map((token) =>
              h('div', { class: 'radii-tile', key: token }, [
                h('div', {
                  class: 'radii-box',
                  style: { borderRadius: `var(--${token.replace(/\./g, '-')})` },
                }),
                h('span', { class: 'scale-name' }, token),
                h('span', { class: 'scale-value' }, `${theme.value.radii[token]}px`),
              ]),
            ),
          ),
        ]),
      ])
  },
})

const Shell = defineComponent({
  setup() {
    const { skin, setSkin, setMode, getActiveId, availableSkins } = useSkin()
    const collapsed = ref(false)

    // Picking 'auto' follows the system; any other id pins a fixed skin. Keeps
    // the header picker, gallery, and follow toggle on the same logical id.
    const selectSkin = (id: string) => {
      if (id === 'auto') setMode('system')
      else setMode('fixed')
      setSkin(id)
    }

    return () =>
      h(
        IrisSidebarLayout,
        {
          collapsed: collapsed.value,
          'onUpdate:collapsed': (v: boolean) => (collapsed.value = v),
          width: 240,
          collapsedWidth: 60,
          style: { height: '100vh' },
        } as Record<string, unknown>,
        {
          sidebar: (state: { collapsed: boolean }) =>
            h('div', { class: 'side' }, [
              h('div', { class: 'brand' }, [
                h('div', { class: 'brand-mark' }, 'I'),
                state.collapsed
                  ? null
                  : h('div', { class: 'brand-text' }, [
                      h('div', { class: 'brand-title' }, 'Iris UI'),
                      h('div', { class: 'brand-sub' }, 'Playground'),
                    ]),
              ]),
              h(
                'nav',
                { class: 'nav', 'aria-label': 'Sections' },
                groupedSections.value.map((g) =>
                  h('div', { class: 'nav-group', key: g.group }, [
                    state.collapsed ? null : h('div', { class: 'nav-group-label' }, g.group),
                    ...g.items.map((s) =>
                      h(
                        'button',
                        {
                          key: s.id,
                          type: 'button',
                          class: ['nav-item', { active: s.id === activeId.value }],
                          onClick: () => (activeId.value = s.id),
                          'aria-current': s.id === activeId.value ? 'page' : undefined,
                        },
                        state.collapsed ? s.label[0] : s.label,
                      ),
                    ),
                  ]),
                ),
              ),
            ]),
          default: () =>
            h(IrisHeaderLayout, {} as Record<string, unknown>, {
              header: () =>
                h('div', { class: 'header' }, [
                  h('div', { class: 'header-title' }, [
                    h('span', { class: 'header-active' }, activeSection.value?.label ?? '—'),
                    h(
                      'span',
                      { class: 'header-meta' },
                      `skin: ${skin.value.name} (${skin.value.type})`,
                    ),
                  ]),
                  h('label', { class: 'skin-picker' }, [
                    h('span', { class: 'skin-picker-label' }, 'Skin'),
                    h(
                      'select',
                      {
                        class: 'skin-select',
                        'aria-label': 'Active skin',
                        value: getActiveId(),
                        onChange: (e: Event) => selectSkin((e.target as HTMLSelectElement).value),
                      },
                      availableSkins().map((s) =>
                        h('option', { key: s.id, value: s.id }, s.name ?? s.id),
                      ),
                    ),
                  ]),
                ]),
              default: () => {
                const sec = activeSection.value
                const body =
                  activeId.value === 'tokens'
                    ? h(TokensView)
                    : sec && sec.component
                      ? h(sec.component)
                      : h('div')
                return h('div', { class: 'content' }, [body])
              },
            }),
        },
      )
  },
})
</script>

<template>
  <SkinProvider :engine="skinEngine">
    <Shell />
    <IrisToastViewport position="bottom-right" />
  </SkinProvider>
</template>

<style>
.side {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px 14px;
  border-bottom: 1px solid var(--iris-border);
  margin-bottom: 10px;
}
.brand-mark {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--iris-primary);
  color: var(--iris-primary-foreground, #fff);
  border-radius: 8px;
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}
.brand-title {
  font-weight: 700;
  font-size: 14px;
}
.brand-sub {
  font-size: 11px;
  color: var(--iris-muted);
}
.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  flex: 1;
}
.nav-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 6px;
}
.nav-group-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--iris-muted);
  padding: 8px 8px 4px;
}
.nav-item {
  display: flex;
  align-items: center;
  text-align: left;
  padding: 7px 10px;
  font-size: 13px;
  border: none;
  background: transparent;
  color: var(--iris-foreground);
  cursor: pointer;
  border-radius: 6px;
  font-family: inherit;
  outline: none;
  transition:
    background-color 100ms ease,
    color 100ms ease;
  white-space: nowrap;
  overflow: hidden;
}
.nav-item:hover {
  background: var(--iris-surface-hover);
}
.nav-item.active {
  background: var(--iris-primary);
  color: var(--iris-primary-foreground, #fff);
  font-weight: 600;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
}
.header-title {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.header-active {
  font-size: 16px;
  font-weight: 700;
}
.header-meta {
  font-size: 12px;
  color: var(--iris-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}
.skin-picker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.skin-picker-label {
  font-size: 12px;
  color: var(--iris-muted);
}
.skin-select {
  font: inherit;
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--iris-border);
  background: var(--iris-surface);
  color: var(--iris-foreground);
  cursor: pointer;
}
.content {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}
.section {
  background: var(--iris-surface);
  border: 1px solid var(--iris-border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
}
.section-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
}
.tokens-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.color-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: var(--iris-background);
  border: 1px solid var(--iris-border);
  border-radius: 8px;
}
.color-swatch {
  width: 100%;
  height: 40px;
  border-radius: 6px;
  border: 1px solid var(--iris-border);
}
.color-name {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
.color-value {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: var(--iris-muted);
}
.scale-grid,
.radii-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.scale-tile,
.radii-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: var(--iris-background);
  border: 1px solid var(--iris-border);
  border-radius: 8px;
}
.scale-bar {
  height: 14px;
  background: var(--iris-primary);
  border-radius: 2px;
}
.radii-box {
  width: 60px;
  height: 60px;
  background: var(--iris-primary);
}
.scale-name {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
.scale-value {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: var(--iris-muted);
}
</style>
