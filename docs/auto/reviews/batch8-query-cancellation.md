已完成：

- QueryCache 增加请求级 `AbortController`、epoch/entry 防护及 orphan abort。
- ResilientFetcher 透传 signal，并忽略 AbortError 的 breaker failure。
- DataSource/Resource/plugin-admin 全链路透传 signal，SWR destroy/supersede 可取消真实请求。
- 补充 core、resource、plugin-admin 相关回归测试，保留 batch7 的 `{ immediate: false }`。

验证通过：

- Core：2284 tests passed
- Plugin-admin：43 tests passed
- Core/plugin-admin typecheck、lint 通过（仅既有 complexity warnings）
- 相关文件 Prettier 通过

未执行 `git add`/commit。根目录 format check 仍被当前工作树中两个既有未格式化 review 文档阻塞，未修改它们。
