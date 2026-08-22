# Aero Platform Console

基于 Iris UI React 适配器的独立平台控制台。当前端到端切片负责：

- 通过 Snaplink Authorization Code + PKCE（S256）登录；
- 在浏览器内存中持有短期 access token，不写入 localStorage/sessionStorage；
- 调用 aero-id `/v1/me`、Profile、来源、成员关系、活动、同步/导出任务和 Operation API；
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

Snaplink 的 `authorization_endpoint` 必须在部署入口上呈现 hosted login UI。如果 API 与
hosted login 分离，通过运行配置的 `snaplinkAuthorizationEndpoint` 指向 Snaplink Console
登录入口；Token endpoint 始终来自 OIDC discovery。

## 运行配置

生产部署应在加载应用前提供 `/runtime-config.js`：

```js
window.__AERO_PLATFORM_CONFIG__ = {
  snaplinkIssuer: 'https://identity.example.com',
  snaplinkAuthorizationEndpoint: 'https://identity.example.com/auth/login',
  snaplinkClientId: 'aero-account-console',
  snaplinkResource: 'aero-id',
  snaplinkScopes: [
    'openid',
    'profile',
    'account:read',
    'account:write',
    'operation:read',
    'source:sync',
  ],
  redirectUri: 'https://accounts.example.com/',
  aeroIdApiBase: 'https://accounts-api.example.com/v1',
  auditConsoleUrl: 'https://audit.example.com',
  aeroImConsoleUrl: 'https://messages.example.com',
  aeroVaultConsoleUrl: 'https://files.example.com',
}
```

也可以复制 `.env.example` 用于本地构建。不要把 client secret、service credential 或
bearer token 写进任何前端配置。

## 开发与验证

```bash
pnpm --filter aero-platform-console dev
pnpm --filter aero-platform-console test
pnpm --filter aero-platform-console lint
pnpm --filter aero-platform-console build
```
