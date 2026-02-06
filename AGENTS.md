# Obsiflow 项目指南

> 基于 [Claudian](https://github.com/YishenTu/claudian) by Yishen Tu 的 iFlow CLI 专用分支

## 项目概述

**Obsiflow** 是一个 Obsidian 插件，将 iFlow CLI 嵌入到 Obsidian 侧边栏中。用户的 Vault 目录成为 iFlow 的工作目录，赋予其完整的智能体能力：文件读写、bash 命令执行和多步骤工作流。

- **版本**: 1.0.0
- **作者**: raawaa
- **许可证**: MIT
- **仓库**: https://github.com/raawaa/obsiflow

---

## 核心功能

| 功能 | 描述 |
|------|------|
| **智能体能力** | 文件读写/编辑、搜索、bash 命令执行 |
| **上下文感知** | 自动附加当前笔记、`@` 提及文件、编辑器选区 |
| **视觉支持** | 图片分析（拖放、粘贴、文件路径） |
| **内联编辑** | 直接编辑笔记中选中的文本，支持词级 diff 预览 |
| **指令模式 (`#`)** | 将自定义指令添加到系统提示词 |
| **斜杠命令** | 可复用的提示模板，支持参数占位符和 bash 替换 |
| **技能 (Skills)** | 基于上下文自动调用的能力模块 |
| **自定义智能体** | 支持工具限制和模型覆盖的子智能体 |
| **Claude Code 插件** | 自动发现并集成 `~/.claude/plugins` 中的插件 |
| **MCP 支持** | 通过 Model Context Protocol 连接外部工具和数据源 |
| **Plan 模式** | Shift+Tab 切换，先探索设计再实施 |
| **安全控制** | YOLO/Safe/Plan 权限模式、命令黑名单、Vault 隔离 |

---

## iFlow CLI 集成

Obsiflow 使用 `@iflow-ai/iflow-cli-sdk` 作为后端，通过 iFlow CLI 提供智能体能力。

### 集成架构

```
Obsiflow UI
    ↓
StreamController (处理 StreamChunk)
    ↓
IFlowService (服务适配器)
    ↓
IFlowOptionsBuilder (配置构建)
    ↓
@iflow-ai/iflow-cli-sdk (WebSocket + ACP 协议)
    ↓
iFlow CLI (独立进程)
```

### 核心组件

| 组件 | 路径 | 功能 |
|------|------|------|
| `IFlowService` | `src/core/iflow/IFlowService.ts` | iFlow CLI SDK 适配器，封装客户端连接和消息流处理 |
| `IFlowOptionsBuilder` | `src/core/iflow/IFlowOptionsBuilder.ts` | 构建 iFlow SDK 配置选项 |
| `convertToStreamChunk` | `src/core/iflow/convertToStreamChunk.ts` | 将 iFlow 消息转换为 StreamChunk 格式 |
| `transformIFlowMessage` | `src/core/sdk/transformIFlowMessage.ts` | 将 iFlow 消息转换为 Obsiflow ChatMessage |

### 与 Claude SDK 的差异

| 特性 | Claude Agent SDK | iFlow CLI SDK |
|------|------------------|---------------|
| **协议** | stdio (JSONL) | WebSocket (ACP v1) |
| **通信** | stdin/stdout | ws://localhost:8090/acp |
| **进程管理** | 手动 spawn | 自动管理（可选手动） |
| **核心 API** | `agentQuery()` 函数 | `IFlowClient` 类 |
| **消息模式** | `AsyncIterable<SDKMessage>` | `receiveMessages()` 异步迭代器 |
| **权限模式** | normal/plan/yolo | default/autoEdit/yolo/plan |

### 使用方式

```typescript
import { IFlowService } from './core/iflow/IFlowService';

// 创建服务
const service = new IFlowService(plugin, vaultPath);

// 连接到 iFlow CLI
await service.connect({
	sessionId: 'existing-session-id',
	allowedTools: ['read', 'write'],
});

// 发送查询
await service.query(
	'Hello, iFlow!',
	{},
	(chunk) => {
		// 处理 StreamChunk
		console.log('Received chunk:', chunk);
	}
);

// 中断查询
await service.abort();

// 断开连接
await service.disconnect();
```

### 测试

```bash
# 运行 iFlow 相关测试
npm run test -- --testPathPatterns="IFlowService"
```

---

## 开发命令

```bash
# 开发模式（监听）
npm run dev

# 生产构建
npm run build

# 类型检查
npm run typecheck

# 代码检查
npm run lint
npm run lint:fix

# 测试
npm run test
npm run test:watch
npm run test:coverage

# 仅运行单元测试
npm run test -- --selectProjects unit

# 仅运行集成测试
npm run test -- --selectProjects integration

# 构建 CSS
npm run build:css
```

---

## 项目架构

```
src/
├── main.ts                      # 插件入口点
├── core/                        # 核心基础设施（无功能依赖）
│   ├── agent/                   # iFlow SDK 包装
│   │   ├── ClaudianService.ts   # 主要服务（含 fork 会话跟踪）
│   │   ├── SessionManager.ts    # SDK 会话管理
│   │   ├── QueryOptionsBuilder.ts # 构建 SDK 选项（含 resumeSessionAt）
│   │   ├── MessageChannel.ts    # 消息通道
│   │   └── customSpawn.ts       # 跨平台进程创建
│   ├── agents/                  # 自定义智能体发现
│   │   ├── AgentManager.ts      # 智能体管理器
│   │   └── AgentStorage.ts      # 智能体存储
│   ├── commands/                # 内置命令操作
│   ├── hooks/                   # 安全钩子（PreToolUse/PostToolUse）
│   ├── iflow/                   # iFlow CLI SDK 集成
│   │   ├── IFlowService.ts      # iFlow 服务适配器
│   │   ├── IFlowOptionsBuilder.ts # iFlow 配置构建器
│   │   ├── convertToStreamChunk.ts # 消息转换
│   │   └── poc.ts               # 概念验证脚本
│   ├── mcp/                     # Model Context Protocol
│   │   ├── McpServerManager.ts  # MCP 服务器管理
│   │   └── McpTester.ts         # MCP 测试工具
│   ├── plugins/                 # Claude Code 插件
│   ├── prompts/                 # 系统提示词
│   ├── sdk/                     # SDK 消息转换
│   │   ├── transformSDKMessage.ts   # Claude SDK 消息转换
│   │   ├── transformIFlowMessage.ts # iFlow 消息转换
│   │   ├── typeGuards.ts        # 类型守卫
│   │   └── types.ts             # SDK 类型定义
│   ├── security/                # 访问控制
│   ├── storage/                 # 持久化层
│   ├── tools/                   # 工具工具
│   └── types/                   # 类型定义
├── features/                    # 功能模块
│   ├── chat/                    # 主侧边栏界面
│   ├── inline-edit/             # 内联编辑模态框
│   └── settings/                # 设置标签页
├── shared/                      # 可复用 UI
├── i18n/                        # 国际化（10 种语言）
├── utils/                       # 工具函数
└── style/                       # 模块化 CSS
```

### 依赖规则

```
types/ ← (所有模块可导入)
storage/ ← security/, agent/, mcp/
security/ ← agent/
sdk/ ← agent/
hooks/ ← agent/
prompts/ ← agent/
```

---

## 存储结构

| 文件/目录 | 内容 |
|-----------|------|
| `{vault}/.claude/settings.json` | CC 兼容设置：权限、环境变量、启用插件 |
| `{vault}/.claude/claudian-settings.json` | Obsiflow 专属设置（模型、UI 等） |
| `{vault}/.claude/settings.local.json` | 本地覆盖（gitignored） |
| `{vault}/.claude/mcp.json` | MCP 服务器配置 |
| `{vault}/.claude/commands/*.md` | 斜杠命令（YAML frontmatter） |
| `{vault}/.claude/agents/*.md` | 自定义智能体（YAML frontmatter） |
| `{vault}/.claude/skills/*/SKILL.md` | 技能定义 |
| `{vault}/.claude/sessions/*.meta.json` | 会话元数据 |
| `~/.claude/projects/{vault}/*.jsonl` | SDK 原生会话消息 |

---

## 开发规范

### SDK 优先原则
- 优先使用原生 Claude SDK 功能，而非自定义实现
- 开发 SDK 相关功能时，先在 `dev/` 编写测试脚本调用真实 SDK
- 检查 `~/.claude/` 或 `{vault}/.claude/` 中的真实输出

### 注释规范
- **只注释 WHY，不注释 WHAT**
- 不使用重复函数名的 JSDoc（如 `/** Get servers. */` 在 `getServers()` 上）
- 不在 barrel `index.ts` 文件上写模块级文档
- 仅在添加非显而易见的上下文时保留 JSDoc（边界情况、约束、意外行为）

### TDD 工作流
1. 先在 `tests/unit/`（或 `tests/integration/`）镜像路径中编写失败的测试
2. 使用 `npm run test -- --selectProjects unit --testPathPattern <pattern>` 确认失败
3. 编写最小实现使测试通过
4. 重构，保持测试通过

**例外**: 简单更改（重命名、移动文件、配置调整）可跳过 TDD，但需验证现有测试通过

### 代码规范
- 编辑后运行: `npm run typecheck && npm run lint && npm run test && npm run build`
- 生产代码中 **禁止** 使用 `console.*`
  - 如需通知用户，使用 Obsidian 的通知系统
  - 调试可使用 `console.log`，但提交前需移除
- 生成的文档/测试脚本放入 `dev/`

---

## CSS 规范

### 结构
```
src/style/
├── base/           # 容器、动画、变量
├── components/     # 头部、历史、消息、代码、思考、工具调用等
├── toolbar/        # 模型选择器、思考选择器、权限切换等
├── features/       # 文件上下文、图片上下文、内联编辑等
├── modals/         # 指令、MCP、fork 目标
├── settings/       # 设置面板
├── accessibility.css
└── index.css       # 构建顺序
```

### 约定
- **前缀**: 所有类使用 `.claudian-` 前缀
- **BEM-lite**: `.claudian-{block}`, `.claudian-{block}-{element}`, `.claudian-{block}--{modifier}`
- **禁止 `!important`**: 除非覆盖 Obsidian 默认样式
- **CSS 变量**: 使用 Obsidian 的 `--background-*`, `--text-*`, `--interactive-*` 令牌

---

## 测试结构

```
tests/
├── unit/              # 单元测试
├── integration/       # 集成测试
├── __mocks__/         # Mock 实现
└── helpers/           # 测试辅助函数
```

测试镜像 `src/` 结构。运行方式：
```bash
npm run test -- --selectProjects unit        # 仅单元测试
npm run test -- --selectProjects integration # 仅集成测试
npm run test:coverage -- --selectProjects unit # 单元测试覆盖率
```

### Jest 配置

项目使用多项目配置（`projects`）：
- **unit**: 单元测试 (`tests/unit/**/*.test.ts`)
- **integration**: 集成测试 (`tests/integration/**/*.test.ts`)

模块映射：
- `@/*` → `src/*`
- `@test/*` → `tests/*`
- `@anthropic-ai/claude-agent-sdk` → `tests/__mocks__/claude-agent-sdk.ts`
- `obsidian` → `tests/__mocks__/obsidian.ts`

---

## 关键模块参考

| 模块 | 文档 |
|------|------|
| Core 基础设施 | [`src/core/CLAUDE.md`](src/core/CLAUDE.md) |
| Chat 功能 | [`src/features/chat/CLAUDE.md`](src/features/chat/CLAUDE.md) |
| CSS 样式 | [`src/style/CLAUDE.md`](src/style/CLAUDE.md) |

---

## 技术栈

- **语言**: TypeScript 5.x
- **构建**: esbuild 0.27.x
- **测试**: Jest 30.x + ts-jest
- **框架**: Obsidian API
- **SDK**: @anthropic-ai/claude-agent-sdk ^0.2.5
- **iFlow SDK**: @iflow-ai/iflow-cli-sdk ^0.1.9
- **MCP**: @modelcontextprotocol/sdk ~1.25.3
- **代码检查**: ESLint 8.x + @typescript-eslint 8.x

---

## 更多信息

详见项目根目录的 [`CLAUDE.md`](CLAUDE.md) 获取完整的项目文档。