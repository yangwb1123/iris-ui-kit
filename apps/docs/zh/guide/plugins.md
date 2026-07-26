# 插件开发

Iris UI 的插件系统让你可以通过 `IrisProvider` 扩展自定义**令牌**、**消息**和**存储**。

## 架构

```
┌─────────────────────────────────────────────┐
│  <IrisProvider plugins={[myPlugin]}>          │
│    runPlugins() ─── 收集令牌 + 消息 + 存储    │
│      └─ applyCssVars(tokens)     ➜  CSS 变量 │
│      └─ mergeMessages(locale)    ➜  i18n     │
│      └─ exposeStores()           ➜  usePluginStore()
└─────────────────────────────────────────────┘
```

## 第一个插件

```ts
import { createPlugin } from '@iris-ui/core'

export const myPlugin = createPlugin({
  name: 'my-plugin',
  install(registry) {
    registry.registerTokens({
      '--iris-my-accent': '#6366f1',
    })
    registry.registerMessages('zh-CN', {
      'myPlugin.greeting': '你好，世界！',
    })
    registry.registerStore('settings', () => createStore({ theme: 'dark', fontSize: 14 }))
  },
})
```

## 使用插件

```tsx
import { IrisProvider } from '@iris-ui/react'
import { myPlugin } from './my-plugin'

function App() {
  return (
    <IrisProvider plugins={[myPlugin]}>
      <MyComponent />
    </IrisProvider>
  )
}
```

读取插件存储：

```tsx
import { usePluginStore } from '@iris-ui/react'

function MyComponent() {
  const settings = usePluginStore<{ theme: string }>('my-plugin::settings')
  return <div>Theme: {settings.theme}</div>
}
```

## 插件约定

| 规则                               | 原因                              |
| ---------------------------------- | --------------------------------- |
| 命名使用小写 kebab-case            | 避免 CSS 和存储键冲突             |
| 使用 `{namespace}::{key}` 访问存储 | 防止插件间冲突                    |
| 令牌前缀 `--iris-{namespace}-`     | 遵循 Iris 主题约定                |
| 不要调用 `registerComponent()`     | 组件应静态导入以支持 tree-shaking |

## 12 个现有插件

| 插件                   | 用途                    |
| ---------------------- | ----------------------- |
| `plugin-locale-zh`     | 简体中文语言包          |
| `plugin-editor`        | CodeMirror 6 代码编辑器 |
| `plugin-pro-table`     | CRUD 数据表格           |
| `plugin-charts`        | 零依赖 SVG 图表         |
| `plugin-form-builder`  | Schema 驱动表单         |
| `plugin-notifications` | 通知中心                |
| `plugin-admin`         | 管理后台                |
| `plugin-calendar`      | 日历                    |
| `plugin-dashboard`     | 仪表盘                  |
| `plugin-kanban`        | 看板                    |
| `plugin-markdown`      | Markdown                |
| `plugin-query-builder` | 查询构建器              |

## 包结构

```
plugin-name/
├── src/
│   ├── core/        # 框架无关逻辑
│   ├── react/       # React 适配器
│   ├── vue/         # Vue 适配器
│   ├── solid/       # Solid 适配器
│   └── svelte/      # Svelte 适配器
├── tsup.config.ts
└── package.json
```
