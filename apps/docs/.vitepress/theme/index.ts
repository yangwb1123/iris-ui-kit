import DefaultTheme from 'vitepress/theme'
import type { App } from 'vue'
import * as Iris from '@iris-ui/vue'
import IrisDemo from './IrisDemo.vue'
import IrisExplorer from './components/IrisExplorer.vue'
import './iris-tokens.css'

// Iris Vue components used by the curated live demos in the generated
// components.md (must match the DEMOS map in generate-components.mjs). Registered
// globally so the generated markdown can use the tags; each demo renders
// client-only via <IrisDemo>, so nothing Iris-specific runs during SSR.
const DEMO_COMPONENTS = [
  'IrisButton',
  'IrisSwitch',
  'IrisSpinner',
  'IrisAvatar',
  'IrisBadge',
  'IrisProgress',
  'IrisDivider',
  'IrisKbd',
]

export default {
  extends: DefaultTheme,
  enhanceApp({ app }: { app: App }) {
    const registry = Iris as Record<string, unknown>
    for (const name of DEMO_COMPONENTS) {
      const comp = registry[name]
      if (comp) app.component(name, comp as never)
    }
    app.component('IrisDemo', IrisDemo)
    // R17 interactive explorer — resolves the live-preview Iris component itself
    // via the `Iris` namespace import (<component :is>), so the curated set needs
    // no extra global registration here.
    app.component('IrisExplorer', IrisExplorer)
  },
}
