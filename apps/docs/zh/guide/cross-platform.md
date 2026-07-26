# 跨平台

Iris UI 支持浏览器、SSR 和桌面环境。

## 浏览器

标准 Vite 构建，使用 `@iris-ui/react` 或 `@iris-ui/vue` 等适配器包。

## SSR (服务器端渲染)

Iris UI 组件在以下框架中经过 SSR 验证：

| 框架       | 包                | 状态                   |
| ---------- | ----------------- | ---------------------- |
| Next.js    | `@iris-ui/react`  | ✅ 真实表单 + RSC      |
| Nuxt       | `@iris-ui/vue`    | ✅ SSR 兼容            |
| SolidStart | `@iris-ui/solid`  | ✅ SSR 兼容            |
| SvelteKit  | `@iris-ui/svelte` | ✅ SSR 兼容 + 水合测试 |

React 组件自动注入 `'use client'` 指令，可在 Server Component 中直接导入。

## Electron

`apps/desktop` 是一个完整的 Electron 桌面壳，包含：

- 四个 CMS 应用（React/Vue/Solid/Svelte）实时切换
- 原生文件保存对话框
- 系统剪贴板集成

## Tauri

`apps/desktop-tauri` 使用 Rust/Tauri v2，在 WebKitGTK 上运行，功能与 Electron 一致。

## Wails

`apps/desktop-wails` 使用 Go/Wails v2，在 WebKitGTK 上运行。

所有三个桌面壳（Electron/Tauri/Wails）共享相同的 `window.irisNative` 渲染器合约。
