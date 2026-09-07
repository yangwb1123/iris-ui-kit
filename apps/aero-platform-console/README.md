# Aero Platform Console

基于 Iris UI React 适配器的独立平台控制台。当前端到端切片负责：

- 通过 Snaplink Authorization Code + PKCE（S256）登录，并使用 discovery/JWKS 校验 ID Token 的 EdDSA/RS256 签名、nonce、issuer、audience 和有效期；
- 在浏览器内存中持有短期 access token，不写入 localStorage/sessionStorage；
- 退出时调用 discovery 声明的 `end_session_endpoint`，销毁 Snaplink 会话后回跳；
- 调用 aero-id `/v1/me`、Profile、来源、成员关系、活动、同步/导出任务和 Operation API；
- 按 aero-id allow-list 查询单个数据投影，展示来源区域、版本、partial/stale 和来源错误；
- 在账户概览显示 Snaplink、Aero IM、Aero Vault 的脱敏连接健康状态；
- 可从账户概览仅刷新 allow-list 内的过期投影，并轮询同步任务；`unknown` 只提示对账，不自动重试；
- 展示 Aero IM 权威通知收件箱的有界无正文投影，并把通知处理动作留在 Aero IM；
- 展示 Aero Vault 权威租户、存储桶和配额用量投影，文件内容与写操作仍留在 Aero Vault；
- 展示 Snaplink 权威身份、安全状态、租户及授权投影，密码、MFA、会话和角色写操作仍留在 Snaplink；
- 对同步/导出任务提供详情、`unknown` 对账和受限的带认证导出下载；存在运行中任务时仅在页面可见时执行列表级刷新，刷新失败保留旧数据；
- 通过账户 ID 二次确认创建异步 erase Saga，不把 `unknown` 当作可直接重试的失败；
- 按 Operation/Request/来源/动作/时间查询脱敏审计事实，并按来源分区校验追加式哈希链；
- 明确展示 partial、stale、unavailable 和 unknown 状态；
- 使用独立链接进入 Audit Governance、Aero IM 和 Aero Vault 控制台，不跨 audience 转发 token。

## Snaplink client

注册独立 public client，不能复用 `snaplink-console`：

```text
client_id: aero-account-console
token_endpoint_auth_method: none
grant_types: authorization_code
response_types: code
require_pkce: true
redirect_uri: https://accounts.example.com/
tenant_id: <Snaplink tenant ID>
allowed_resources: aero-id
scopes: openid profile account:read account:write operation:read source:sync
```

Snaplink 当前把 `tenant_id` 从 client 绑定写入 access token，而 aero-id 的生产校验要求非空
tenant claim。因此每个租户应注册独立 client（或使用独立域名/运行配置选择对应 client_id），不能
用一个无租户 client 给所有租户签发 token。

Snaplink discovery 的 `authorization_endpoint` 是 `/auth/login` JSON API，不是可导航的
登录页面。`snaplinkHostedLoginUrl` 必须指向单独部署的 Hosted Login UI（例如 Snaplink
Console 的 `/login/`）；Token endpoint 始终来自 OIDC discovery。

## 运行配置

生产部署应在加载应用前提供 `/runtime-config.js`：

```js
window.__AERO_PLATFORM_CONFIG__ = {
  snaplinkIssuer: 'https://identity.example.com',
  snaplinkHostedLoginUrl: 'https://identity.example.com/login/',
  snaplinkClientId: 'aero-account-console',
  snaplinkResource: 'aero-id',
  snaplinkScopes: [
    'openid',
    'profile',
    'account:read',
    'account:write',
    'operation:read',
    'source:sync',
    'audit:read',
  ],
  redirectUri: 'https://accounts.example.com/',
  aeroIdApiBase: 'https://accounts-api.example.com/v1',
  auditConsoleUrl: 'https://audit.example.com',
  snaplinkConsoleUrl: 'https://identity.example.com/admin/',
  aeroImConsoleUrl: 'https://messages.example.com',
  aeroVaultConsoleUrl: 'https://files.example.com',
}
```

也可以复制 `.env.example` 用于本地构建。不要把 client secret、service credential 或
bearer token 写进任何前端配置。

容器提供 `GET /healthz` 存活探针；该探针只验证 Nginx 与静态资源服务已就绪，不把
aero-id 等上游的瞬时故障放大成前端容器重启。

## 开发与验证

控制台按普通 npm consumer 使用已发布的 Iris UI 包，不允许通过 `workspace:`、Vite alias
或相对路径直接读取 `packages/*/src`。依赖使用精确版本并在每次构建前核验实际安装路径与
registry 元数据，防止退回 monorepo 隐式链接。当前锁定 `@iris-ui-kit/react@0.2.2`：
`0.2.3` 的依赖错误保留了 `workspace:*`，`0.3.0` 则依赖尚未发布 `maskValue` 的
`@iris-ui-kit/core@0.2.1`；升级必须等待 Core 与 React 联合发布兼容版本。

```bash
pnpm --filter aero-platform-console dev
pnpm --filter aero-platform-console test
pnpm --filter aero-platform-console lint
pnpm --filter aero-platform-console build
```
