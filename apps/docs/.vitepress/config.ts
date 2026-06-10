import { defineConfig } from 'vitepress'

// Docs site for Iris UI. The Components page is generated from manifest.json
// (see generate-components.mjs) so the reference can't drift from the packages.
export default defineConfig({
  title: 'Iris UI',
  description: 'Token-driven, cross-framework (React · Vue · Solid · Svelte) UI infrastructure.',
  cleanUrls: true,
  themeConfig: {
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
        ],
      },
      { text: 'Reference', items: [{ text: 'Components', link: '/components' }] },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/iris-ui/iris-ui' }],
  },
})
