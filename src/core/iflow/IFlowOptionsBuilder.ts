/**
 * IFlowOptionsBuilder - 构建 iFlow CLI SDK 的配置选项
 *
 * 将 Claudian 的设置转换为 IFlowOptions
 */

import {
	ApprovalMode,
	type IFlowOptions,
	type MCPServerConfig,
	PermissionMode,
} from '@iflow-ai/iflow-cli-sdk';

import type { ClaudeModel, PermissionMode as ClaudianPermissionMode } from '../types';

// ClaudianPlugin 使用默认导出
type ClaudianPlugin = any;

/**
 * 构建上下文 - 包含构建选项所需的所有信息
 */
interface BuildContext {
	plugin: ClaudianPlugin;
	vaultPath: string;
	customEnv: Record<string, string>;
	enhancedPath: string;
}

/**
 * 查询选项 - 与原 QueryOptionsBuilder 兼容的接口
 */
export interface IFlowQueryOptions {
	sessionId?: string;
	model?: ClaudeModel;
	forceColdStart?: boolean;
	allowedTools?: string[];
	mcpMentions?: Set<string>;
	enabledMcpServers?: Set<string>;
	externalContextPaths?: string[];
	maxThinkingTokens?: number;
}

/**
 * IFlowOptionsBuilder - 构建器类
 */
export class IFlowOptionsBuilder {
	/**
	 * 构建 iFlow SDK 选项
	 */
	static build(ctx: BuildContext, queryOptions: IFlowQueryOptions = {}): IFlowOptions {
		const { plugin, vaultPath, customEnv } = ctx;
		const settings = plugin.settings;

		// 映射权限模式
		const permissionMode = this.mapPermissionMode(settings.permissionMode);

		// 构建 MCP 服务器配置
		const mcpServers = this.buildMcpServers(plugin, queryOptions);

		// 构建会话设置
		const sessionSettings = this.buildSessionSettings(settings, queryOptions);

		// 构建 Hooks（可选）
		const hooks = this.buildHooks(plugin);

		// 构建完整的 IFlowOptions
		const options: IFlowOptions = {
			cwd: vaultPath,
			permissionMode,
			sessionSettings,
			mcpServers,
			hooks,
			autoStartProcess: true, // 自动启动 iFlow CLI
			timeout: 300000, // 5 分钟超时
		};

		// 添加环境变量
		if (Object.keys(customEnv).length > 0) {
			// iFlow SDK 通过进程环境变量传递，需要在启动 iFlow CLI 时设置
			// 这里暂时不处理，因为 SDK 会继承当前进程的环境
		}

		return options;
	}

	/**
	 * 映射权限模式
	 */
	private static mapPermissionMode(
		mode: ClaudianPermissionMode
	): PermissionMode {
		switch (mode) {
			case 'yolo':
				return PermissionMode.AUTO;
			case 'plan':
			case 'normal':
			default:
				return PermissionMode.MANUAL;
		}
	}

	/**
	 * 映射审批模式
	 */
	private static mapApprovalMode(
		mode: ClaudianPermissionMode
	): ApprovalMode {
		switch (mode) {
			case 'yolo':
				return ApprovalMode.YOLO;
			case 'plan':
				return ApprovalMode.PLAN;
			case 'normal':
			default:
				return ApprovalMode.DEFAULT;
		}
	}

	/**
	 * 构建 MCP 服务器配置
	 */
	private static buildMcpServers(
		plugin: ClaudianPlugin,
		queryOptions: IFlowQueryOptions
	): MCPServerConfig[] {
		const configs = plugin.mcpManager.getServerConfigs();

		return configs.map((server: any) => ({
			name: server.name,
			command: server.command,
			args: server.args || [],
			env: server.env || [],
		}));
	}

	/**
	 * 构建会话设置
	 */
	private static buildSessionSettings(
		settings: any,
		queryOptions: IFlowQueryOptions
	): IFlowOptions['sessionSettings'] {
		const sessionSettings: IFlowOptions['sessionSettings'] = {
			system_prompt: settings.systemPrompt || undefined,
			permission_mode: this.mapApprovalMode(settings.permissionMode),
		};

		// 添加模型信息到系统提示
		if (settings.model) {
			sessionSettings.system_prompt = sessionSettings.system_prompt || '';
		}

		// 限制工具
		if (queryOptions.allowedTools) {
			sessionSettings.allowed_tools = queryOptions.allowedTools;
		}

		// 最大轮次（可选）
		if (settings.maxTurns) {
			sessionSettings.max_turns = settings.maxTurns;
		}

		return sessionSettings;
	}

	/**
	 * 构建 Hooks
	 */
	private static buildHooks(plugin: ClaudianPlugin): IFlowOptions['hooks'] {
		// iFlow SDK 的 hooks 结构与 Claude SDK 不同
		// 这里暂时返回空对象，后续可以根据需要添加
		// 例如：
		// return {
		//   [HookEventType.PRE_TOOL_USE]: [
		//     {
		//       matcher: '*',
		//       hooks: [{ command: 'echo "Tool called"', timeout: 5 }],
		//     },
		//   ],
		// };
		return {};
	}
}