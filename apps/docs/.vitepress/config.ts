import { defineConfig } from 'vitepress'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Docs site for Iris UI. The Components page is generated from manifest.json
// (see generate-components.mjs) so the reference can't drift from the packages.
export default defineConfig({
  title: 'Iris UI',
  description: 'Token-driven, cross-framework (React · Vue · Solid · Svelte) UI infrastructure.',
  cleanUrls: true,
  vite: {
    plugins: [
      // The interactive Explorer mounts client-only @iris-ui-kit/svelte islands. Those
      // resolve to raw `.svelte` source (svelte-package ships .svelte, not compiled
      // JS), so VitePress's Vite needs the Svelte plugin to compile them. React /
      // Solid islands need no plugin (their dist is already compiled JS). The plugin
      // only claims `.svelte` files, so it can't touch VitePress's Vue/markdown.
      svelte(),
    ],
    // The Svelte runtime + the .svelte island chain must be excluded from SSR
    // externalization so Vite transforms (compiles) them in the SSR build graph.
    ssr: {
      noExternal: ['@iris-ui-kit/svelte', 'svelte'],
    },
  },
  themeConfig: {
    // Built-in, fully-offline full-text search over all pages — makes the
    // 149-component generated reference actually navigable.
    search: { provider: 'local' },
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Components', link: '/components' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Theming', link: '/guide/theming' },
          { text: 'AI-native usage', link: '/guide/ai-native' },
          { text: 'Cross-platform', link: '/guide/cross-platform' },
        ],
      },
      { text: 'Reference', items: [{ text: 'Components', link: '/components' }] },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/iris-ui/iris-ui' }],
  },
})
