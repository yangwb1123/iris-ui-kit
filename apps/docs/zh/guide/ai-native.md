# AI 原生用法

Iris UI 提供 MCP 服务和 llms.txt，让 AI 代理可以发现组件、获取 API 信息并生成代码。

## MCP 服务

`@iris-ui/mcp` 提供 11 个工具供 AI Agent 消费：

| 工具                 | 用途                   |
| -------------------- | ---------------------- |
| `list_components`    | 列出所有组件           |
| `search_components`  | 搜索组件               |
| `get_component_api`  | 获取组件完整 API       |
| `scaffold_component` | 生成组件使用片段       |
| `scaffold_view`      | 组合多组件视图         |
| `generate_view`      | 生成带状态绑定视图     |
| `generate_test`      | 生成测试代码           |
| `suggest_components` | 根据需求推荐组件       |
| `validate_usage`     | 验证组件使用           |
| `get_architecture`   | 获取系统架构信息       |
| `generate_form`      | 从字段描述生成完整表单 |

## llms.txt

`llms.txt` 文件（815 行）包含完整的组件清单、属性、事件和插槽信息，AI 代理可直接读取。

## AGENTS.md

项目根目录的 `AGENTS.md` 是架构师指南，描述了：

- 五层架构模型
- A/B/C 下沉分类原则
- 插件系统契约
- 组合模式速查表
- 代码约定和质量门
