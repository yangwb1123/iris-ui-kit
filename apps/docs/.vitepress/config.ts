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
  // i18n: English + Simplified Chinese
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      themeConfig: {
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
              { text: 'Data & Resilience', link: '/guide/data-layer' },
              { text: 'Resilience Examples', link: '/guide/resilience-examples' },
              { text: 'Plugin Development', link: '/guide/plugins' },
              { text: 'AI-native usage', link: '/guide/ai-native' },
              { text: 'Cross-platform', link: '/guide/cross-platform' },
              { text: 'Registry & marketplace', link: '/guide/registry-marketplace' },
              { text: 'Table conditional formatting', link: '/guide/table-conditional-formatting' },
            ],
          },
          { text: 'Reference', items: [{ text: 'Components', link: '/components' }] },
        ],
        socialLinks: [{ icon: 'github', link: 'https://github.com/iris-ui/iris-ui' }],
      },
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      themeConfig: {
        search: { provider: 'local' },
        nav: [
          { text: '指南', link: '/zh/guide/getting-started' },
          { text: '组件', link: '/zh/components' },
        ],
        sidebar: [
          {
            text: '指南',
            items: [
              { text: '快速开始', link: '/zh/guide/getting-started' },
              { text: '主题系统', link: '/zh/guide/theming' },
              { text: '数据与韧性', link: '/zh/guide/data-layer' },
              { text: '韧性示例', link: '/zh/guide/resilience-examples' },
              { text: '插件开发', link: '/zh/guide/plugins' },
              { text: 'AI 原生用法', link: '/zh/guide/ai-native' },
              { text: '跨平台', link: '/zh/guide/cross-platform' },
            ],
          },
          { text: '参考', items: [{ text: '组件列表', link: '/zh/components' }] },
        ],
        socialLinks: [{ icon: 'github', link: 'https://github.com/iris-ui/iris-ui' }],
      },
    },
  },
})
