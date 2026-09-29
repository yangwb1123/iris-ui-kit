# Iris UI 只读架构审查报告

未修改文件。未发现 P0；共 8 条 P1、3 条 P2。

| ID  | 严重度 | 结论                                                  |
| --- | ------ | ----------------------------------------------------- |
| 1   | P1     | SSR/render/setup 阶段触发数据请求                     |
| 2   | P1     | `destroy()` 无法取消部分实际网络请求                  |
| 3   | P1     | ProTable store 缺少生命周期出口                       |
| 4   | P1     | 异步 `hydrate()` 会覆盖用户更新                       |
| 5   | P1     | Plugin runtime 动态卸载与 React render 生命周期不一致 |
| 6   | P1     | Svelte 使用进程级 ID 计数器导致 SSR 漂移              |
| 7   | P1     | 日历/倒计时直接读取墙上时钟导致 hydration 差异        |
| 8   | P1     | named views 在首轮渲染读取 `localStorage`             |
| 9   | P2     | ProTable 列宽拖拽监听器只在 `pointerup` 清理          |
| 10  | P2     | Drawer/focus-trap 的 RAF/timer 未完全归属组件生命周期 |
| 11  | P2     | core 层仍直接依赖浏览器 DOM 能力                      |

## 1. P1：SSR/render/setup 阶段触发数据请求

**证据**

- `packages/core/src/resource.ts:32-38,160`：`immediate` 默认开启，构造时执行 `ds.load()`。
- `packages/plugin-admin/src/core/controller.ts:188`：创建 resource 时未传 `immediate: false`。
- 四个 Admin DataPage 都在 render/setup 中创建 controller：
  - React `packages/plugin-admin/src/react/DataPage.tsx:28`
  - Vue `packages/plugin-admin/src/vue/DataPage.ts:48`
  - Solid `packages/plugin-admin/src/solid/DataPage.tsx:62`
  - Svelte `packages/plugin-admin/src/svelte/DataPage.svelte:31`
- Solid/Svelte `useResourceController` 直接传入 config：`packages/{solid,svelte}/src/resource/useResourceController.ts:25`；React/Vue 则显式关闭 immediate。

**复现**

SSR 或 React StrictMode/中断渲染时传入延迟 `fetcher`，请求会在 mount 前执行；SSR 不会执行 cleanup。

**修复方向**

统一构造期 `immediate: false`，仅在 `onMounted`/`useEffect`/`onMount` 中加载。

**测试**

SSR 中断言 `fetcher` 调用次数为 0；StrictMode 下验证未提交 render 不产生请求。

---

## 2. P1：`destroy()` 无法取消部分实际网络请求

**证据**

- `ResourceControllerConfig.fetcher` 不接收 `AbortSignal`：`packages/core/src/resource.ts:32-34`。
- 转交给 data source 时主动丢弃 signal：`packages/core/src/resource.ts:129-133`。
- SWR 分支会立即返回旧数据并在后台启动请求：`packages/core/src/query-cache.ts:242-249`。
- 此时 `DataSourceEngine` 已在 `packages/core/src/data-source.ts:334-338` 清空 `inFlight`，随后 `destroy()` 的 `inFlight?.abort()` 无对象可取消：`packages/core/src/data-source.ts:462-472`。

**复现**

1. 首次加载后让缓存过期；
2. 使用 `staleWhileRevalidate: true` 再次加载；
3. `await load()` 后立即 `destroy()`；
4. 后台请求的 `AbortSignal.aborted` 仍为 `false`。

**修复方向**

让 resource fetcher 透传 signal；让 query cache/SWR 自己持有并取消后台 `AbortController`，而不是只做 epoch orphan。

**测试**

覆盖普通请求、resource 请求、SWR 后台请求在 `destroy()` 后均收到 abort。

---

## 3. P1：ProTable store 缺少生命周期出口

**证据**

- `ProTableStore` 接口没有 `destroy()`：`packages/plugin-pro-table/src/core/types.ts:163`。
- 以下订阅均未保存 unsubscribe：
  - `expansion.store.subscribe`：`store-engine.ts:136`
  - `dataSource.subscribe`：`store-engine.ts:143`
  - `cellEdit.store.subscribe`：`store-engine.ts:204`
  - 本地 store 订阅：`store-engine.ts:224`
- 构造时立即加载：`store-engine.ts:278`。
- 虽然底层 `dataSource` 有 `destroy()`，但未暴露或调用。

**复现**

反复创建/卸载 server-mode ProTable store；慢请求完成后仍会触发旧 store 的内部回调，订阅闭包持续保留。

**修复方向**

为 `ProTableStore` 增加幂等 `destroy()`，用 `createDisposableScope` 管理所有订阅、请求和子控制器，并由 adapter/owner 调用。

**测试**

卸载后断言请求被取消、所有内部订阅不再收到事件。

---

## 4. P1：异步 `hydrate()` 会覆盖用户更新

**证据**

- Profile 的 `hydrate()` 无版本检查，直接用 loaded `installed` 替换当前状态：`packages/core/src/profile.ts:282-297`。
- Admin preferences 直接用 loaded 覆盖当前状态：`packages/core/src/admin-preferences.ts:163-168`。
- 两个接口都没有 `destroy()`；Profile 还有 debounce timer：`profile.ts:257,373-374`。

**复现**

延迟 `storage.load()`；在其 resolve 前调用 `install()`、`setPref()` 或 `patch()`。hydrate 完成后，更新会被丢弃。并发调用两次 hydrate 时，旧请求也可能覆盖新请求。

**修复方向**

记录 hydrate epoch/mutation version，加载后 replay 或按字段合并变更；串行化 hydrate 与 save；增加生命周期销毁和 pending write 取消。

**测试**

覆盖 hydrate 期间 mutation、双 hydrate 乱序、卸载后 debounce save。

---

## 5. P1：Plugin runtime 生命周期不一致，且 React 在 render 阶段执行副作用

**证据**

- `registerStore` factory 在 `runPlugins()` 中 eager 执行：`packages/core/src/plugin.ts:99-103`。
- React 在 render 中调用 `runPlugins`：`packages/react/src/provider/IrisProvider.tsx:52`，cleanup 只在 effect：`:68`。中断 render 无 cleanup。
- `reloadPlugins()` 只调用 `plugin.destroy()`，没有旧 runtime 的 `teardown()`：`packages/core/src/plugin-runtime.ts:239-254`。
- Provider 动态换插件时调用 `collected.teardown()`，但四个 adapter 都没有按移除集合调用 `plugin.destroy()`；Vue 代表性代码：`packages/vue/src/provider/IrisProvider.ts:99-108`。
- `plugin.destroy()` 文档明确要求在 install teardown 后执行：`packages/core/src/plugin.ts:164-171`。

**复现**

插件 install 中注册 timer/global listener，再动态替换插件或用 React aborted render；旧资源未按预期清理，或同一插件被重复安装。

**修复方向**

由 core runtime 统一维护“安装实例”，保证 `teardown → destroy` 各执行一次；React 中避免在 render 执行有副作用的 install/factory，或引入可回滚的 commit 生命周期。

**测试**

插件动态增删、React StrictMode、中断 render，分别断言 install/teardown/destroy 次数。

---

## 6. P1：Svelte 使用进程级 ID 计数器导致 SSR 漂移

**证据**

- `packages/core/src/utils.ts:25-28` 使用模块级 `idCounter`。
- Svelte FormField 在初始化阶段调用 `generateId()`：`packages/svelte/src/primitives/form-field/FormField.svelte:19-22`。
- 同样模式存在于 Dialog、Select、Drawer、Popover 等组件。
- 现有测试也明确承认该计数器是 process-global：`packages/svelte/src/hydration.test.ts:45-54`。

**复现**

长驻 SSR 进程处理第二个请求后，浏览器端从 `iris-1` 开始 hydration；服务端可能已经输出 `iris-20`，导致 `for`、`aria-describedby`、`aria-controls` 不匹配。

**修复方向**

使用请求作用域的 `IdFactory`；Svelte 组件优先接受宿主传入 id，或建立 SSR/client 共享的 ID context。

**测试**

连续 SSR 两个请求后分别 hydration，并校验所有 ARIA 引用目标存在且一致。

---

## 7. P1：日历/倒计时直接读取墙上时钟导致 hydration 差异

**证据**

- Calendar core 初始化读取 `new Date()`：`packages/plugin-calendar/src/core/index.ts:83`。
- 四框架日历 renderer 也在渲染期读取当前日期，例如 React `packages/plugin-calendar/src/react/index.tsx:39`。
- Countdown 在初始化阶段读取 `Date.now()`，例如 React `packages/react/src/primitives/countdown/Countdown.tsx:59`；Vue/Solid/Svelte 也有对应实现。

**复现**

服务端在跨日/跨月前渲染，客户端在跨日/跨月后 hydration；或服务端与浏览器时区不同，初始月份、`today` 标记、倒计时文本不同。

**修复方向**

注入可序列化的 `now`/timezone；SSR 使用固定快照，mount 后再启动实时更新。

**测试**

固定 fake clock，覆盖跨午夜、跨月、不同 timezone 的 SSR/hydration。

---

## 8. P1：named views 在首轮渲染读取 `localStorage`

**证据**

- core 默认 storage 直接访问 `globalThis.localStorage`：`packages/core/src/table-views.ts:53-65`。
- React 在 render 的 lazy ref 中读取：`packages/react/src/primitives/table/useTableViews.ts:127-130`。
- Solid/Vue/Svelte 在 controller 初始化时读取：
  - Solid `table-views.tsx:31`
  - Vue `table-views.ts:33`
  - Svelte `table-views.svelte.ts:31`

**复现**

服务端无 `localStorage`，首轮输出空 view list；客户端已有持久化 views，hydration 时 option 数量和内容不同。

**修复方向**

首轮使用确定性空状态，mount 后读取 storage；或由服务端注入已序列化 snapshot。

**测试**

预置 localStorage 后执行四框架 SSR + hydration，断言无 hydration warning。

---

## 9. P2：ProTable 列宽拖拽监听器只在 `pointerup` 清理

**证据**

React `packages/plugin-pro-table/src/react/index.tsx:337-351`、Vue `:162-176`、Solid `:345-361`、Svelte `:261-275` 均在 `pointerdown` 注册 document listeners，只在 `pointerup` 移除；卸载和 resize-handle 的 `pointercancel` 没有统一清理。

**复现**

拖拽开始后直接卸载表格，不发送 `pointerup`；随后 document 的 `pointermove` 仍调用旧 store。

**修复方向**

使用 Pointer Capture/lostpointercapture，或为拖拽控制器注册 adapter unmount cleanup，并覆盖 `pointercancel`/`blur`。

**测试**

监听器 spy + “拖拽中卸载”测试，断言无旧回调和残留 listener。

---

## 10. P2：Drawer/focus-trap 的 RAF/timer 未完全归属组件生命周期

**证据**

- Vue Drawer 的 RAF 和 exit timer：`packages/vue/src/primitives/drawer/DrawerContent.ts:128-136`，无 `onBeforeUnmount` 清理。
- Solid 只清理 exit timer，未保存/取消 open RAF：`packages/solid/src/primitives/drawer/IrisDrawerContent.tsx:136-150`。
- Vue/Solid/Svelte focus trap 的 activation/deactivation RAF 未保存；例如 Vue `useFocusTrap.ts:89-107`、Solid `:79-96`、Svelte `:92-110`。

**复现**

打开或关闭 Drawer 后立即卸载，下一帧仍可能修改已卸载状态或把焦点恢复到不再属于当前交互上下文的 trigger。

**修复方向**

所有 RAF/timer 纳入 disposable scope；unmount 时统一取消，并区分“正常关闭”和“宿主卸载”。

**测试**

fake RAF/timers 下在每个阶段卸载，断言 callback 不执行且焦点不被错误抢回。

---

## 11. P2：core 层仍直接依赖浏览器 DOM 能力

**证据**

- `packages/core/src/file-save.ts:94-108` 使用 `document`、`Blob`、`URL.createObjectURL`。
- `packages/core/src/table-clipboard.ts:187-229` 使用 `navigator`、`document`、`execCommand`。
- React 又重复实现 clipboard fallback：`packages/react/src/primitives/table/clipboard-display-helpers.tsx:123-145`。
- `packages/plugin-editor/src/core/index.ts:3,82,150` 直接依赖 CodeMirror `EditorView` 和 `HTMLElement` parent。

虽然这些路径有 SSR guard 或由 adapter 在 mount 调用，但它们不再是严格的 DOM/framework-agnostic core。

**修复方向**

core 只保留序列化、编辑器状态和纯逻辑；通过 `ClipboardPort`、`FileSavePort`、`EditorViewPort` capability 注入，浏览器实现放入 adapter/browser 层。

**测试**

Node/worker 环境导入 core；验证无 DOM 时纯 API 仍可用，浏览器 fallback 只在 browser package 测试。

## 建议优先补充的回归测试

1. 四框架 SSR + hydration：ID、日期、倒计时、localStorage views。
2. React StrictMode/aborted render：Admin resource、IrisProvider plugin install。
3. Deferred fetch：普通 resource、SWR、ProTable destroy 后的 abort。
4. fake timers/RAF：Drawer、focus trap、列拖拽卸载。
5. 延迟 storage hydrate：mutation 保留、乱序 hydrate、pending save。
6. Plugin 动态替换：`teardown` 与 `destroy` 各一次且顺序正确。

## Core 下沉候选

- 以 `createDisposableScope` 为统一 controller/store 生命周期协议。
- 为 data source、query cache、resource 统一 AbortSignal/background-job ownership。
- 增加可注入 `Clock` 与 request-scoped `IdFactory`。
- 将 plugin runtime 的安装、替换、销毁统一收回 core。
- 将 ProTable 的状态/查询/编辑逻辑保留在 core，DOM 拖拽监听留在 adapter，但通过 disposable contract 管理。
- 将 clipboard/file-save/editor 的浏览器实现拆出 core，core 只保留纯逻辑与 capability contract。
