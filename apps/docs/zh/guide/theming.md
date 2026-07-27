# 主题系统

Iris UI 使用 CSS 自定义属性和可加载皮肤系统实现完整的主题化。

## 快速使用

```tsx
import { ThemeProvider, IrisButton } from '@iris-ui-kit/react'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'

const store = createThemeStore({
  themes: { light: lightTheme, dark: darkTheme },
  default: 'light',
})

function App() {
  return (
    <ThemeProvider store={store}>
      <IrisButton>Hello</IrisButton>
    </ThemeProvider>
  )
}
```

## 设计令牌

所有颜色、间距、圆角都是 `var(--iris-*)` CSS 变量：

- **颜色**: `--iris-background`, `--iris-foreground`, `--iris-primary` 等 21 个令牌
- **间距**: `--iris-padding-sm`, `--iris-gap-md` 等 8 个令牌
- **圆角**: `--iris-radius-sm`, `--iris-radius-md`, `--iris-radius-lg`
- **阴影**: `--iris-shadow-sm/md/lg`
- **Z 索引**: `--iris-z-dropdown/sticky/modal` 等 8 个令牌
- **过渡**: `--iris-transition-fast/normal/slow` 等 5 个令牌

## 皮肤系统

皮肤是主题层之上的可加载单元，支持继承：

```ts
const forestSkin = {
  id: 'forest',
  extends: 'dark',
  tokens: {
    'iris.background': '#0f1a12',
    'iris.primary': '#3BA7FF',
  },
}
```

- 继承：皮肤可以 `extends` 另一个皮肤
- 自定义命名空间：避免令牌冲突
- 持久化：自动保存到 localStorage
- FOUC 防闪：通过 `skinBootScript` 注入

## 方向支持

使用 CSS 逻辑属性（`margin-inline-start` 而非 `margin-left`），通过 `applyDirection('rtl')` 切换 RTL。

## 响应式

- `prefers-reduced-motion`：减少动画
- `prefers-color-scheme`：跟随系统亮暗模式
