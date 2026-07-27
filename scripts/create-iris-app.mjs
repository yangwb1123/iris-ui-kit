#!/usr/bin/env node
/**
 * create-iris-app — Scaffold a new Iris UI project.
 *
 * Usage:
 *   node scripts/create-iris-app.mjs my-app [--framework=react|vue]
 *
 * Creates a minimal project structure with Iris UI pre-configured:
 * - package.json with Iris dependencies
 * - Vite config
 * - Entry point with ThemeProvider + IrisButton
 * - TypeScript config
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [,, appName] = process.argv
const framework = process.argv.find((a) => a.startsWith('--framework='))?.split('=')[1] ?? 'react'

if (!appName || appName.startsWith('--')) {
  console.error('Usage: node scripts/create-iris-app.mjs <app-name> [--framework=react|vue]')
  process.exit(1)
}

if (!['react', 'vue'].includes(framework)) {
  console.error('Error: framework must be "react" or "vue"')
  process.exit(1)
}

const dir = resolve(process.cwd(), appName)
mkdirSync(dir, { recursive: true })

const files = {
  'package.json': JSON.stringify({
    name: appName,
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: framework === 'vue' ? 'vue-tsc --noEmit && vite build' : 'tsc --noEmit && vite build',
      preview: 'vite preview',
    },
    dependencies: {
      [`@iris-ui-kit/${framework}`]: 'latest',
      '@iris-ui-kit/theme': 'latest',
      '@iris-ui-kit/tokens': 'latest',
      ...(framework === 'vue' ? { vue: '^3.5.0' } : { react: '^18.3.0', 'react-dom': '^18.3.0' }),
    },
    devDependencies: {
      vite: '^5.4.0',
      ...(framework === 'vue'
        ? { '@vitejs/plugin-vue': '^5.2.0', 'vue-tsc': '^2.1.0' }
        : { '@vitejs/plugin-react': '^4.3.0', typescript: '^5.5.0' }),
    },
  }, null, 2),

  'vite.config.ts': framework === 'vue'
    ? `import { defineConfig } from 'vite'\nimport vue from '@vitejs/plugin-vue'\nexport default defineConfig({ plugins: [vue()] })\n`
    : `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()] })\n`,

  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${appName}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.${framework === 'vue' ? 'ts' : 'tsx'}"></script>
</body>
</html>`,

  [`src/main.${framework === 'vue' ? 'ts' : 'tsx'}`]: framework === 'vue'
    ? `import { createApp } from 'vue'\nimport App from './App.vue'\ncreateApp(App).mount('#root')\n`
    : `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)\n`,

  ...(framework === 'vue'
    ? {
      'src/App.vue': `<script setup lang="ts">
import { ThemeProvider, IrisButton } from '@iris-ui-kit/vue'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'
const store = createThemeStore({ themes: { light: lightTheme, dark: darkTheme }, default: 'light' })
</script>
<template>
  <ThemeProvider :store="store">
    <main style="padding: 40px; max-width: 600px; margin: 0 auto;">
      <h1>Hello Iris UI!</h1>
      <IrisButton variant="solid">Get started</IrisButton>
    </main>
  </ThemeProvider>
</template>`,
    }
    : {
      'src/App.tsx': `import { ThemeProvider, IrisButton } from '@iris-ui-kit/react'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'

const store = createThemeStore({ themes: { light: lightTheme, dark: darkTheme }, default: 'light' })

export default function App() {
  return (
    <ThemeProvider store={store}>
      <main style={{ padding: 40, maxWidth: 600, margin: '0 auto' }}>
        <h1>Hello Iris UI!</h1>
        <IrisButton variant="solid">Get started</IrisButton>
      </main>
    </ThemeProvider>
  )
}`,
    }),
}

for (const [path, content] of Object.entries(files)) {
  const fullPath = resolve(dir, path)
  mkdirSync(resolve(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, content)
  console.log(`  ✓ ${path}`)
}

console.log(`\n✅ Created Iris UI project "${appName}" (${framework})`)
console.log(`\n  cd ${appName}`)
console.log(`  npm install`)
console.log(`  npm run dev`)
