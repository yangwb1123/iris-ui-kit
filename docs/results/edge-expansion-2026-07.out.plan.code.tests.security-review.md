现在我掌握了足够的信息来完成安全审查。

---

# 安全审查报告：Iris UI

## 总体安全态势：**需要改进**

该项目是一个设计良好的 UI 基础设施库，框架无关性、关注点分离和可测试性方面表现出色。然而，安全审查发现了**2 个关键漏洞**（XSS 绕过）、**1 个严重配置问题**（iframe sandbox 绕过）和**多个高风险发现**，这些在生产部署前必须解决。

---

## 发现

### 1. Markdown 清理器绕过 — 未引号事件处理程序（XSS）

| 字段         | 描述                                                                                                                                                                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **类别**     | 输入验证                                                                                                                                                                                                                                                        |
| **严重性**   | **严重**                                                                                                                                                                                                                                                        |
| **标题**     | `stripEventHandlers` 未清理未引号的事件处理程序属性值                                                                                                                                                                                                           |
| **位置**     | `packages/plugin-markdown/src/core/index.ts` 第 63-65 行                                                                                                                                                                                                        |
| **描述**     | `stripEventHandlers` 函数使用正则表达式 `/\s+on\w+\s*=\s*(['"])[\s\S]*?\1/gi`，它只匹配带引号的事件处理程序值（`onerror="..."` 或 `onerror='...'`）。未引号的属性值（例如 `onerror=alert(1)`）完全绕过此检查。                                                  |
| **攻击场景** | 攻击者将 Markdown 内容提交给 `IrisMarkdown` 组件。输入 `<img src=x onerror=alert(document.cookie)>` 被转换为 HTML（Markdown 解析器将其视为段落），清理器未能移除未引号的 `onerror` 属性，结果 HTML 使用 `dangerouslySetInnerHTML` / `{@html}` / `v-html` 渲染。 |
| **影响**     | **存储型跨站脚本（XSS）**。攻击者可以在任何渲染用户提供的 Markdown 的页面上下文中执行任意 JavaScript。可以窃取 cookie、冒充用户、篡改页面内容。                                                                                                                 |
| **建议**     | 修复 `stripEventHandlers` 以同时处理引号和未引号的属性值。更好的方法是使用更健壮的方法，例如 DOMPurify 或属性级正则表达式：```ts                                                                                                                                |

function stripEventHandlers(html: string): string {
// 也匹配未引号的值：onerror=alert(1)，以及带引号的值
return html.replace(/\s+on\w+\s*=\s*(?:(['"])[\s\S]\*?\1|[^\s>]+)/gi, '')
}

````|
| **工作量** | S（< 1 天） |

### 2. Markdown 清理器绕过 — 额外的向量

| 字段 | 描述 |
|-------|-------------|
| **类别** | 输入验证 |
| **严重性** | **严重** |
| **标题** | `stripJavascriptHrefs` 和 `stripDataUrls` 覆盖不完整；SVG/details 向量未被处理 |
| **位置** | `packages/plugin-markdown/src/core/index.ts` 第 40-60 行 |
| **描述** | 多个绕过向量：（1）`stripJavascriptHrefs` 仅覆盖 `href` 和 `src`，但不覆盖 `formaction`、`action`、`xlink:href`（SVG）或 `background`。（2）`stripDataUrls` 仅覆盖 `href`。（3）`stripIframes` 留下 `<object>` 和 `<embed>` 未处理。（4）未引号的 SVG 事件处理程序（`<svg onload=alert(1)>`）和 `<details ontoggle=alert(1)>` 完全绕过。 |
| **攻击场景** | 攻击者使用 `<form><button formaction=javascript:alert(1)>Click</button></form>` — `onclick` 被阻挡，但 `formaction` 被完全忽略。或者 `<svg onload=alert(1)>` — SVG 命名空间元素上的未引号事件处理程序完全通过。 |
| **影响** | **存储型跨站脚本（XSS）**，向量比 #1 更多。 |
| **建议** | （1）扩展 `stripJavascriptHrefs` 以覆盖 `formaction`、`action`、`xlink:href`、`background`、`poster`、`srcset`。（2）扩展 `stripDataUrls` 以覆盖除 `href` 之外的所有 URL 属性。（3）添加 `<object>`、`<embed>`、`<math>` 剥离。（4）考虑使用 DOMPurify 而不是自定义正则表达式来保持健壮性：```ts
import DOMPurify from 'dompurify'
function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p','br','strong','em','code','pre','blockquote','ul','ol','li','h1','h2','h3','h4','h5','h6','a','table','thead','tbody','tr','th','td','img','hr'], ALLOWED_ATTR: ['href','src','alt','title','class','id','width','height'] })
}
``` |
| **工作量** | M（1-3 天） |

### 3. Iframe sandbox 配置错误 — 同源脚本执行

| 字段 | 描述 |
|-------|-------------|
| **类别** | Data Protection / Threat Model |
| **严重性** | **严重** |
| **标题** | `allow-same-origin` + `allow-scripts` = 绕过 iframe sandbox |
| **位置** | 所有 4 个桌面 OS 应用：`apps/desktop-os/src/components/Window.tsx` 第 166 行，`apps/desktop-os-vue/src/components/WindowBody.vue` 第 72 行，`apps/desktop-os-svelte/src/appviews/IframeApp.svelte` 第 27 行，`apps/desktop-os-solid/src/Window.tsx` 第 212 行 |
| **描述** | iframe sandbox 属性包含 `allow-scripts allow-same-origin`。根据 HTML 规范，这两个标志的组合**完全绕过了沙箱** — iframe 中的脚本可以访问父页面的 cookie、localStorage 和 DOM，因为它是同源的。 |
| **攻击场景** | 攻击者控制 `kind: 'iframe'` 应用的 URL（通过目录中的恶意条目，或通过 `kind: 'link'` 应用重定向到 iframe 可加载页面）。加载的页面可以执行 `top.document.cookie`、`parent.localStorage.setItem(...)` 或重定向整个页面到钓鱼网站。 |
| **影响** | **特权提升** — 嵌入的 iframe 可以像与父页面同源一样执行任意 JavaScript。可以窃取身份验证令牌、操纵应用程序状态、读取敏感数据。 |
| **建议** | 移除 `allow-same-origin`：```html
sandbox="allow-scripts allow-forms allow-popups"
``` 如果嵌入需要访问父页面，使用 `postMessage` 进行显式通信，并验证消息来源。 |
| **工作量** | S（< 1 天） |

### 4. `loadRemoteApp` — 运行时动态导入无 URL 验证

| 字段 | 描述 |
|-------|-------------|
| **类别** | 输入验证 / Threat Model |
| **严重性** | **严重** |
| **标题** | `loadRemoteApp` 接受任意 URL 且无方案/来源验证 |
| **位置** | `apps/desktop-os*/src/remoteApp.ts`（所有 4 个框架重复） |
| **描述** | `loadRemoteApp` 函数使用 `import(/* @vite-ignore */ u)` 从用户提供的 URL 获取并评估任意 JavaScript 模块。没有方案验证（例如，需要 `https://`）、来源检查或完整性检查。`@vite-ignore` 注释抑制了 Vite 的安全扫描。 |
| **攻击场景** | 当前目录使用硬编码 URL，但如果用户可以提供将安装的应用程序的 URL（通过配置文件、配置文件存储、或 MCP/插件系统），攻击者可以托管一个带有恶意 `mount()` 导出的 ESM 模块。导入后，恶意代码与主应用程序具有相同的权限，可以访问 DOM、cookie、localStorage 和绑定到窗口的本机桥接（例如，Wails 的 `SaveFile` 和 `ClipboardSetText`）。 |
| **影响** | **任意代码执行** — 远程 ESM 模块中的 JavaScript 与主应用程序具有相同的权限。可以窃取会话、读取/写入文件（通过本机桥接）、安装持久后门。 |
| **建议** | （1）添加 URL 验证 — 需要 `https://` 方案并选择加入允许列表。（2）使用 Subresource Integrity（SRI）或 importmap 完整性。（3）考虑使用 Web Worker 或 `<iframe sandbox="allow-scripts">` 沙箱化远程代码。（4）记录风险并要求明确的用户同意才能安装远程应用。 |
| **工作量** | M（1-3 天） |

### 5. CSV 注入（公式注入）

| 字段 | 描述 |
|-------|-------------|
| **类别** | 输入验证 |
| **严重性** | **高** |
| **标题** | `toCsv` 未转义以 `=`, `+`, `-`, `@` 开头的值 |
| **位置** | `packages/core/src/table-export.ts` 第 17-19 行 |
| **描述** | RFC 4180 CSV 导出函数在将值写入 CSV 之前不检查值是否以 `=`, `+`, `-` 或 `@` 开头。Excel、Google Sheets 和 LibreOffice 将这些前缀解释为公式，可能导致公式注入（也称为 CSV 注入）。 |
| **攻击场景** | 用户在表格中编辑一个单元格，值为 `=SUM(1+1)*cmd|' /C calc!A0` 或 `=HYPERLINK("http://evil.com","Click here")`。当管理员导出一个 CSV 并打开它时，Excel 执行公式，可能运行命令或引诱用户点击链接。 |
| **影响** | **信息泄露 / 社会工程学** — 公式可以 exfiltrate 数据（例如，通过 HTTP 请求的 `=WEBSERVICE`），在 Windows 上运行命令（`=DDE` 或 `=MSEXCEL` 向量），或误导用户。 |
| **建议** | 为以 `=`, `+`, `-` 或 `@` 开头的值添加制表符前缀，根据 OWASP CSV 注入指南：```ts
function csvField(value: unknown): string {
  if (value == null) return ''
  const text = String(value)
  // 防止公式注入
  const safe = /^[=+\-@\t]/.test(text) ? `\t${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
``` |
| **工作量** | S（< 1 天） |

### 6. Wails `injectBridge` — 字符串插值到 JavaScript

| 字段 | 描述 |
|-------|-------------|
| **类别** | 输入验证 |
| **严重性** | **高** |
| **标题** | 框架名称通过字符串连接注入内联 `<script>` 标签 |
| **位置** | `apps/desktop-wails/main.go` 第 64-67 行 |
| **描述** | `injectBridge` 函数将 `fw` 变量直接连接到 JavaScript 代码中：`framework:'` + fw + `'`。虽然 `fw` 目前来自一个硬编码列表（`"react"`, `"vue"`, `"solid"`, `"svelte"`），但初始值也可以来自 `IRIS_FW` 环境变量。如果目录存在于嵌入式文件系统中，环境变量被接受。理论上，一个具有类似文件名的恶意目录可能导致 JavaScript 注入。 |
| **攻击场景** | 如果攻击者可以控制注入点（例如，通过创建具有恶意名称的嵌入式目录），他们可以注入任意 JavaScript，该 JavaScript 与 `irisNative` 桥接在相同权限下执行，可以访问文件系统和剪贴板。 |
| **影响** | **任意 JavaScript 注入**到 Wails 桌面应用程序的上下文中。 |
| **建议** | （1）使用 allowlist 验证框架名称：```go
var validFrameworks = map[string]bool{"react": true, "vue": true, "solid": true, "svelte": true}
func (a *App) SetFramework(fw string) {
    if !validFrameworks[fw] { return }
    ...
}
``` （2）使用 `json.Marshal` 而不是字符串连接将值嵌入到 JavaScript 中。 |
| **工作量** | S（< 1 天） |

### 7. 演示应用缺少安全头

| 字段 | 描述 |
|-------|-------------|
| **类别** | Compliance |
| **严重性** | **高** |
| **标题** | SSR 演示应用未配置 Content-Security-Policy 或安全头 |
| **位置** | `apps/ssr-next/`, `apps/ssr-nuxt/`, `apps/ssr-solidstart/`, `apps/ssr-sveltekit/` |
| **描述** | 四个 SSR 演示应用都没有配置 CSP 标头、X-Content-Type-Options、X-Frame-Options 或 Referrer-Policy。虽然这些是演示应用，但它们是文档中的参考实现，可能会被复制到生产配置中。 |
| **影响** | **缺乏纵深防御**。如果 XSS 漏洞确实通过（例如，之前的发现），没有 CSP 来限制损害。缺少 X-Frame-Options 允许点击劫持。 |
| **建议** | 向每个 SSR 演示应用添加严格的 CSP 标头。对于 Next.js，在 `next.config.js` 中添加 `headers`。对于 Nuxt，使用 `nuxt-security` 模块或 `render:headers`。例如：```ts
// next.config.js
async headers() {
  return [{ source: '/(.*)', headers: [
    { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'" },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
  ]}]
}
``` |
| **工作量** | S（< 1 天） |

### 8. CMS 演示 — Session 存储在不安全的 `localStorage` 中

| 字段 | 描述 |
|-------|-------------|
| **类别** | Session Management |
| **严重性** | **中** |
| **标题** | 身份验证 Session 以未加密的 JSON 存储在 `localStorage` 中 |
| **位置** | `apps/cms-react/src/auth.ts` 第 46-52 行 |
| **描述** | Mock 身份验证系统将 Session（用户名 + 角色）作为 JSON 持久化在 `localStorage` 中，没有加密或完整性保护。虽然这是演示模拟代码，但该模式可能被复制到生产代码中。 |
| **攻击场景** | 对页面有 XSS 的人可以读取 `localStorage.getItem('iris-cms-react-session')` 并窃取 Session。存储的 XSS 或浏览器扩展也可以读取它。 |
| **影响** | **Session 劫持** — Session cookie 或令牌应标记为 `httpOnly`；`localStorage` 中的 Session 数据在存在 XSS 时会被泄露。 |
| **建议** | 在文档中明确标记此代码为“仅演示，不得用于生产”。对于生产 auth，使用 `httpOnly` cookie 或加密的 Session 令牌。可以添加一个 `README.md` 注释，指出生产身份验证需要安全、符合 OWASP 标准的 Session 管理。 |
| **工作量** | S（< 1 天） |

### 9. `@vite-ignore` 抑制安全扫描

| 字段 | 描述 |
|-------|-------------|
| **类别** | Compliance |
| **严重性** | **中** |
| **标题** | `@vite-ignore` 注释禁用 Vite 的动态导入安全检查 |
| **位置** | `apps/desktop-os*/src/remoteApp.ts`（所有 4 个框架） |
| **描述** | `import(/* @vite-ignore */ u)` 告诉 Vite 不要分析或转换导入的 URL。这绕过了 Vite 的路径验证，并允许将运行时 URL 直接传递给浏览器的模块加载器。`@vite-ignore` 在功能上是必要的（以防止 Vite 在构建时捆绑该 URL），但消除了检查模块源头的机会。 |
| **攻击场景** | 此功能与 #4 结合，允许从任意 URL 代码导入，而 Vite 没有机会执行安全检查。 |
| **影响** | **缺乏代码来源验证**，加剧了 #4 的风险。 |
| **建议** | （1）记录 `@vite-ignore` 的安全含义。（2）考虑构建时替换，将允许的 URL 映射到固定的入口点，而不是直接传递用户 URL 给 `import()`。 |
| **工作量** | L（> 3 天） |

### 10. 输入渲染模式 — 通知字段可能承载 XSS 负载

| 字段 | 描述 |
|-------|-------------|
| **类别** | 输入验证 |
| **严重性** | **低** |
| **标题** | 通知 `title` 和 `body` 字段如果渲染为 HTML 可能承载 XSS |
| **位置** | `packages/core/src/notifications.ts` 第 60-64 行 |
| **描述** | `NotificationInput` 接口接受 `title` 和 `body` 字符串，这些字符串由消费组件渲染。虽然核心引擎不渲染 HTML，但适配器组件渲染这些字段的方式不同。如果任何适配器选择使用 `innerHTML` 而不是 `textContent`，这些字段将成为 XSS 向量。 |
| **攻击场景** | 攻击者调用 `notificationCenter.post({ title: '<img src=x onerror=alert(1)>' })`。如果渲染器使用 `innerHTML`，脚本文本执行。 |
| **影响** | **潜在的存储型 XSS**，取决于渲染器实现。 |
| **建议** | （1）使用 `textContent` 渲染通知字符串。（2）明确记录通知字段是纯文本，不得呈现为 HTML。（3）添加一个 linter 规则，防止使用 `innerHTML` 处理通知字段。 |
| **工作量** | S（< 1 天） |

---

## STRIDE 分析

| 类别 | 已识别风险 | 状态 |
|--------|-------------|--------|
| **S**poofing（欺骗） | 模拟 auth 在 demo 中使用 localStorage，没有加密签名。如果复制，攻击者可以篡改 localStorage 来冒充用户。 | **中风险** |
| **T**ampering（篡改） | CSV 注入允许修改导出的电子表格内容。皮肤 token 没有完整性保护。 | **高风险** |
| **R**epudiation（抵赖） | 没有审计日志或操作跟踪。命令注册表可以运行操作但不记录它们。 | **低风险**（设计如此） |
| **I**nformation Disclosure（信息泄露） | Iframe sandbox 绕过允许嵌入式页面读取父级 cookie/localStorage。错误消息包含 URL。 | **高风险** |
| **D**enial of Service（拒绝服务） | 没有 DoS 保护。Markdown 解析器在有问题的输入上可能表现不佳，但内存/CPU 耗尽是可能的。 | **低风险** |
| **E**levation of Privilege（特权提升） | `loadRemoteApp` 允许从任意 URL 进行动态代码评估，具有完整的宿主权限。`allow-same-origin` 赋予嵌入的 iframe 同源权限。 | **严重风险** |

---

## {OWASP|NIST} 合规性

| 标准 | 状态 |
|----------|--------|
| **OWASP Top 10 – A03:2021 (Injection)** | **未通过** — Markdown 清理器中的 XSS 绕过（发现 #1、#2） |
| **OWASP Top 10 – A05:2021 (Security Misconfiguration)** | **未通过** — iframe sandbox 错误配置（#3），缺少 CSP 标头（#7） |
| **OWASP Top 10 – A08:2021 (Software and Data Integrity Failures)** | **未通过** — 没有 SRI/完整性检查的运行时动态代码评估（#4、#9） |
| **OWASP CSV Injection** | **未通过** — CSV 导出转义不完整（#5） |
| **NIST SP 800-53 – SC-7 (Boundary Protection)** | **未通过** — iframe sandbox 绕过破坏了安全边界（#3） |
| **NIST SP 800-53 – SI-10 (Information Input Validation)** | **未通过** — Markdown 输入清理不完整（#1、#2） |

---

## 最终总结

### 整体安全态势：**需要改进**

**主要优势：**
- 插件系统架构良好，具有清晰的注册概念和有限的副作用
- 主题/皮肤系统正确使用 `textContent`，从未使用 `innerHTML`
- 图标组件使用结构化节点数据（无原始 HTML 注入）
- 核心包在大多数情况下避免使用 eval/动态代码执行
- 导出函数（CSV、HTML、SpreadsheetML）在适当的地方使用 XML 转义
- 组件通常通过 JSX/模板绑定安全地渲染 props（React/Vue/Solid 处理转义）
- 项目有**1500+ 测试**和**14 道 CI 门**，但零安全测试

### 需要立即关注的前 3 个关键问题

1.  **🔴 Markdown 清理器绕过（发现 #1、#2）** — `stripEventHandlers` 和相关的清理函数在正则表达式中存在多个 XSS 绕过。`IrisMarkdown` 组件跨 4 个框架使用 `dangerouslySetInnerHTML`/`{@html}`/`v-html`，这意味着任何成功的绕过都会导致存储型 XSS。**这是最关键的发现**，因为 Markdown 插件是一个 SHIP-ready 的插件。

2.  **🔴 Iframe sandbox 绕过（发现 #3）** — 所有 4 个桌面 OS 应用使用 `allow-scripts allow-same-origin`，这**完全绕过了沙箱**。嵌入的页面可以与父页面同源执行任意 JavaScript。需要在所有 4 个框架中修复：移除 `allow-same-origin`。

3.  **🔴 `loadRemoteApp` 任意代码评估（发现 #4、#9）** — 运行时动态代码加载机制没有 URL 验证、来源检查或完整性保证。虽然目前通过硬编码目录 URL 有所缓解，但应用程序安装或用户配置的任何用户输入控制路径都会打开任意代码执行。

### 前 3 个速赢项目（高影响，低工作量）

| 项目 | 工作量 | 影响 | 建议 |
|------|--------|--------|-------------|
| 修复 `stripEventHandlers` 以处理未引号的值 | 30 分钟 | **关键** | 在 Markdown 清理器中添加未引号属性值的匹配 |
| 从 iframe sandbox 移除 `allow-same-origin` | 10 分钟 | **关键** | 编辑 4 个文件，每个更改一个字符串 |
| 修复 CSV 注入 | 15 分钟 | **高** | 在 `csvField` 中添加公式注入预防 |

### 技术债务

| 债务 | 工作量 | 影响 | 备注 |
|--------|--------|--------|-------|
| 无安全测试 | **高** | **关键** | 零 XSS、注入、清理测试。添加安全测试需要专用工作。 |
| 自定义正则表达式清理器而不是 DOMPurify | M | **高** | 自定义正则表达式方法固有地脆弱。迁移到 DOMPurify 将消除整个类别的漏洞。 |
| 桌面原生桥接（Wails）在模板中没有转义 | S | **高** | `injectBridge` 中的字符串连接 — 需要 JSON 编码。 |
| 无 CSP/安全标头 | S | **中** | 演示应用缺少用于纵深防御的安全头。 |
| 无 SRI/完整性 | L | **中** | `loadRemoteApp` 中的动态导入没有完整性检查。 |

### 最终建议

Iris UI 在代码质量、测试覆盖和架构方面是一个优秀的项目。安全姿势需要改进，但关键问题集中在几个明确定义的区域，这些区域可以系统性地解决：

1.  **立即**：修复 iframe sandbox 配置错误和 Markdown 清理器绕过。
2.  **短期**：添加安全测试（XSS、注入、CSV 公式），用 DOMPurify 替换自定义清理器，添加 CSP 标头。
3.  **中期**：为 `loadRemoteApp` 实现 URL 验证和完整性检查，添加基于 Istanbul 的覆盖门槛并强制进行安全测试，考虑对远程代码进行评估的沙箱。
````
