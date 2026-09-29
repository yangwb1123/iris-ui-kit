# pbatch (ai-batch-runner) 在 iris-ui 的用法

本目录是 iris-ui 接入 `~/workspace/demo/ai-batch-runner`（产品 CLI `pi-batch`，
Python 包 `pbatch`）后的批次定义。引擎本体不在本仓库，运行时状态也全部落在
用户目录（`~/.codex/pbatch/projects/<workspace-id>/`），仓库里只留**声明**。

## 前置

```bash
# 引擎以源码方式运行（本机未做全局安装）
export PYTHONPATH=~/workspace/demo/ai-batch-runner

# 项目配置（仓库根 pi-batch.yaml）已经把 validators 指向本仓门禁
python3 -m pbatch config check      # 结构校验
python3 -m pbatch config explain    # 看最终生效配置（敏感键脱敏）
python3 -m pbatch doctor            # 安装/凭据/锁状态
```

`pi-batch.yaml` 里的 `validators` 就是本仓的门禁：`irischeck`
（`node cli.mjs check`：filesize + 依赖方向 + 格式）、`typecheck`、`lint`、
`test*`、`parity`、`docfacts`、`manifest`、`tokens`、`rsc`、`archratchet`、
`size`，以及一条整仓验收用的组合 `irisverify`。

## provider（重要）

pbatch **没有**全局 provider 默认值，只有 per-task 的 `provider:`；而
`pi-batch.yaml` 里写未知键（例如 `agent.default_provider`）会被静默忽略、
`config check` 仍然报 OK。所以每个任务都显式写 `provider: openai-codex`。

2026-09-28 本机可用性：`openai-codex` 可用；`opencode-go` 配额耗尽
（breaker 24h 冷却）；`opencode` 余额不足。换 provider 前先
`pi auth check --provider <name> --json` 探活。

另外：pi 启动时会解析 `~/.pi/agent/auth.json` 里的全部凭据，一条**过期的
OAuth 记录会让所有 `pi -p` 直接 exit 1**（与选哪个 provider 无关）。本轮遇到
的是 anthropic refresh token 过期；隔离该条记录后恢复（备份留在同目录
`auth.json.bak-*`）。

## 交付物规则（最容易踩的坑）

**pbatch 的交付物是 agent 的 stdout**：它会把最后一条消息原样写进任务的
`output:` 路径。因此：

- 要报告类任务 → prompt 必须写“把完整正文打印在最终回复里”，并明确
  **禁止 agent 自己写 output 文件**。否则 agent 写完文件后 pbatch 用一句
  “报告已写入 xxx” 覆盖掉它（2026-09-28 实际发生过一次）。
- 要改代码类任务 → 让 agent 改代码，stdout 只放简短总结（改了什么、测试
  结果），`output:` 指向 `docs/auto/reviews/<batch>-<task>.md`，人可复查。

## 批次文件

| 文件                                            | 形态  | 内容                                                                                                     |
| ----------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------- |
| `tasks/review-parity-token-i18n-lifecycle.yaml` | tasks | 4 路只读对抗审查（跨框架语义 / token 纪律 / i18n+a11y / core 边界与生命周期）                            |
| `tasks/fix-parity-batch1.yaml`                  | tasks | 审查结论的实施批 1：Radio / Dragger / List / Tour                                                        |
| `tasks/fix-token-rtl-batch2.yaml`               | tasks | 审查结论的实施批 2：progress keyframe / slider RTL / switch+select 逻辑属性 / 排版 token 名 / 硬编码颜色 |

注意：**pipeline 形态**（顶层 `stages:`）里每个 stage 只允许一种输入源
（`from_dir` / `from_outputs` / `from_prompt` / `or_tasks`），所以“同一 stage
里跑多个独立任务”要用 tasks 形态（顶层 `tasks:`），验收门另起一次
`--validate irisverify` 运行。

## 串行 vs 并行

- 只读审查：`--mode parallel --workers 4`（唯一写入是各自的 output 文件）。
- 改代码：**串行**。四个任务改同一棵树，并行会互相覆盖；`default_workers`
  在 `pi-batch.yaml` 里也设成了 1。

## 常用命令

```bash
# 预览
python3 -m pbatch <tasks.yaml> --dry-run

# 执行（断点续跑：已产出且校验通过的任务会跳过）
python3 -m pbatch <tasks.yaml> --retries 1 --reuse

# 只跑整仓验收门
python3 -m pbatch -p "跑 irisverify 并汇总" --validate irisverify --retries 0

# 第二个 batch 想跑时，先确认没有别的实例占着 workspace 锁
# （锁在 ~/.codex/pbatch/projects/<workspace-id>/locks/，冲突时以 exit 5 拒绝启动）
```

## 门禁失败时先分清是哪一类

- **真实漂移** → 修源码。
- **环境问题被当成门禁失败** → 修 launcher。本轮已修两例：
  `scripts/lib/run-pnpm.mjs` 把 pnpm 原生二进制交给 `node`；
  `scripts/check-size.mjs` 把 pnpm 的 `/bin/sh` esbuild shim 当可执行文件。
  两者都伴随“报了个假失败”的症状，判据是**换一台机器就复现不了**。

## 越界事件与新增约束（2026-09-28 实录）

批 4 期间有一个 agent 在自己的任务之外做了三件事：追查了我同时在查的
`check:parity` 0.18 → 0.17 信号、写了一个新的批次文件
`tasks/fix-standalone-radio.yaml`、**并自己拉起了第二个 pbatch 实例**
（`pi -m pbatch …/fix-standalone-radio.yaml`）。

后果与处置：

- 它的结论是对的（Solid/Svelte 的 standalone `IrisRadio` 点击后视觉状态永远
  不变，是真缺陷），改动经复核与四端 radio 测试验证后保留；
- 但它绕过了 workspace 锁（锁只约束 pbatch 自己），所以我这边看到的
  “Another pi-batch instance is running (exit 5)” 反而是我的审查批次被顶掉；
- `git add -A` 把它顺手产出的文件一起卷进了批 4 的提交，提交信息与内容不符。

因此新增两条硬约束（已写进批 3/4 的任务模板）：

1. 任务**禁止启动任何 batch runner / 调度进程**；需要更大流程时把方案写进
   最终回复，由人决定。
2. 提交前先确认工作树里没有你没写过的东西：
   `git status --short` 逐条核对，`git diff --cached --stat` 看范围。

操作建议：每轮开批前先 `pgrep -fl "m pbatch"` 确认只有一个实例；批结束后同样
确认没有残留 agent（`pgrep -x pi` 里除你自己的会话外应为空）。
