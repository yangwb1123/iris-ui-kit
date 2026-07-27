# 跨平台（Electron · Tauri · Wails · Cordova）

Iris UI 是纯 Web 技术，因此可以**在任何 WebView 包装器中运行**——Electron、Tauri、Wails、Cordova——基本无需修改。组件可直接挂载、路由和响应输入。需要处理的是**宿主集成**：在你的壳应用中执行少量一次性设置，以及两个可选的钩子用于原生文件保存和剪贴板。

本指南是完整的检查清单。大多数项目只需一行代码。

## 快速总览

| 事项                                 | 谁处理     | 操作                                    |
| ------------------------------------ | ---------- | --------------------------------------- |
| 严格 CSP 阻止样式                    | 宿主应用   | 添加 `style-src 'self' 'unsafe-inline'` |
| `file://` 导致 404 / 路由错误        | 宿主构建   | `base: './'` + hash 路由                |
| CSV/Excel 导出无法保存               | **库钩子** | `setFileSaveHandler(...)`               |
| 复制失败（无 `navigator.clipboard`） | **库钩子** | `setClipboardHandler(...)`              |
| 触摸拖拽（看板/仪表盘/表格重排）     | **自动**   | 内置 Pointer fallback                   |
| 刘海/HomeBar 遮挡 Toast 和 Drawer    | 宿主 meta  | `viewport-fit=cover`                    |
| 系统暗色模式未检测                   | 宿主应用   | 启用 OS 主题信号                        |

## 内容安全策略 (CSP)

Iris UI 使用内联样式和运行时注入的 `<style>` 元素来设置组件样式。在**严格** CSP 下（Electron 推荐、Tauri 默认），这些会被阻止，应用会**无样式但功能完整**。一条指令即可恢复：

```
style-src 'self' 'unsafe-inline';
```

这条指令同时覆盖注入的样式表和内联 `style=` 属性（`style-src-attr` 会回退到 `style-src`）。内联**样式**的风险远低于内联脚本，而 Iris UI 从不使用 `innerHTML`，因此这是行业标准的低风险选择——保持 `script-src` 严格。

> 唯一需要放宽 `script-src` 的功能是可选的防 FOUC 皮肤启动脚本。如果你不使用它，就不需要放宽。

## 从 `file://` 加载

Electron 和 Cordova（有时包括 Wails）从 `file://` 加载 bundle，此时绝对路径（`/assets/…`）会 404，history 模式路由会失效。在打包工具中：

```ts
// vite.config.ts
export default defineConfig({ base: './' })
```

并使用 **hash** 路由而非 history 路由。Iris UI 本身不硬编码任何 URL 或 `history` 调用——这完全是你的应用/路由配置。Tauri 使用自定义协议提供资产，拥有真实源，因此不受影响。

## 原生文件保存（CSV / Excel 导出）

浏览器默认的 `<a download>` 方式在系统 WebView 中不可靠（WKWebView 经常忽略 `download` 属性；自定义协议阻止 `blob:`）。在启动时注册**一个**处理器，所有表格导出都会通过它：

```ts
import { setFileSaveHandler } from '@iris-ui-kit/core'

// Tauri
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

setFileSaveHandler(async ({ filename, content }) => {
  const path = await save({ defaultPath: filename })
  if (path) await writeTextFile(path, content)
})
```

处理器接收 `{ filename, content, mimeType }`。返回 `false` 可以**拒绝**特定保存并回退到浏览器下载；返回其他值（或不返回）则 Iris UI 跳过 Web 路径。在 Web 或 Electron-with-Node 上完全省略处理器即可使用默认下载。

```ts
// Electron（renderer → main via IPC）
setFileSaveHandler(({ filename, content, mimeType }) =>
  window.electron.saveFile({ filename, content, mimeType }),
)

// Wails
import { SaveFile } from '../wailsjs/go/main/App'
setFileSaveHandler(({ filename, content }) => SaveFile(filename, content))

// Cordova（cordova-plugin-file）
setFileSaveHandler(({ filename, content }) => writeToCordovaFile(filename, content))
```

> 核心序列化器（`toCsv` / `toJson` / `toHtml` / `toSpreadsheetXml`）已返回纯字符串，你可以在不使用钩子的情况下构建完全自定义的导出流程。

## 原生剪贴板（复制按钮）

`navigator.clipboard` 需要安全上下文，在 Cordova `file://` 和某些自定义协议下为 `undefined`，因此 `IrisCopyButton` 会在那里静默失效。以同样方式注册剪贴板处理器：

```ts
import { setClipboardHandler } from '@iris-ui-kit/core'

// Tauri
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
setClipboardHandler((text) => writeText(text))

// Wails
import { ClipboardSetText } from '../wailsjs/runtime/runtime'
setClipboardHandler((text) => ClipboardSetText(text))
```

同样约定：返回 `false` 回退到 `navigator.clipboard`；在 Web 上省略以保持默认行为。

## 触摸拖拽 — 自动

看板卡片移动、仪表盘微件移动和 ProTable 列重排在桌面端使用原生 HTML5 拖放（鼠标），在触摸设备上使用**内置 Pointer fallback**——原生 HTML5 DnD 从不触发触摸事件，这在 Cordova 和触摸笔记本上至关重要。无需任何配置：Pointer 路径在 `touch`/`pen` 输入时自动激活，与鼠标路径共存。

## 移动端安全区域

在刘海屏/HomeBar 设备上，固定叠加层（Toast、Drawer）需要避开安全区域。Iris UI 的 Toast 视口和 Drawer 面板已添加 `env(safe-area-inset-*)` 内边距——你只需在 WebView 中启用绘制到切口区域：

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

## 系统暗色模式

Iris UI 读取 `prefers-color-scheme`，但**信号**由宿主控制：

- **Electron**——在主进程中设置 `nativeTheme.themeSource = 'system'`
- **Tauri / Wails**——新版本的系统 WebView 会转发 OS 主题；请在目标 OS 上验证

没有该信号时，自动暗色模式安全地保持亮色；你可以随时通过主题存储显式驱动主题。

## 你不需要担心的

`forced-colors` / reduced-motion 兼容性、Portal、`position: sticky`、CSS 自定义属性、`ResizeObserver` / `IntersectionObserver` 以及 Pointer Capture 拖拽在 WebView2 / WKWebView / WebKitGTK / Android System WebView 上均可正常工作。Iris UI 还特意避免了可能导致 WebView 卡顿的 CSS 陷阱（`:has()`、`@container`、`@layer`、`backdrop-filter`），并且使用 `color-mix()` 的色调表面携带了预计算的 `--iris-{semantic}-subtle` 回退，因此即使是在 2022 年之前的旧版系统 WebView 上也能呈现正确的色调。完整的视觉面在当前的**和**旧的渲染引擎上都能正确显示。
