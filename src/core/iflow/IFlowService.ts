/**
 * IFlowService - iFlow CLI SDK 适配器
 *
 * 替代 ClaudianService，使用 iFlow CLI SDK 与 iFlow CLI 通信
 */

import {
	IFlowClient,
	type IFlowOptions,
	type Message,
} from '@iflow-ai/iflow-cli-sdk';

import type { ClaudeModel, StreamChunk } from '../types';
import { convertToStreamChunk } from './convertToStreamChunk';
import { IFlowOptionsBuilder, type IFlowQueryOptions } from './IFlowOptionsBuilder';

// ClaudianPlugin 使用默认导出
type ClaudianPlugin = any;

/**
 * 查询选项 - 与原 ClaudianService 兼容的接口
 */
export interface QueryOptions {
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
 * 消息回调类型 - 支持 StreamChunk（用于 StreamController）
 */
export type MessageCallback = (chunk: StreamChunk) => void;

/**
 * IFlowService - iFlow CLI 服务适配器
 */
export class IFlowService {
	private client: IFlowClient | null = null;
	private plugin: ClaudianPlugin;
	private vaultPath: string;
	private messageCallback: MessageCallback | null = null;
	private abortController: AbortController | null = null;
	private messageTask: AsyncIterator<Message> | null = null;
	private connected = false;

	constructor(plugin: ClaudianPlugin, vaultPath: string) {
		this.plugin = plugin;
		this.vaultPath = vaultPath;
	}

	/**
	 * 启动查询
	 */
	async query(
		prompt: string,
		options: QueryOptions = {},
		onMessage: MessageCallback
	): Promise<void> {
		if (!this.client || !this.connected) {
			throw new Error('IFlow client not connected');
		}

		this.messageCallback = onMessage;
		this.abortController = new AbortController();

		try {
			// 发送用户消息
			await this.client.sendMessage(prompt);

			// 接收并处理消息流
			this.messageTask = this.client.receiveMessages();
			await this.processMessages(this.messageTask);
		} catch (error) {
			if (error instanceof Error && error.name !== 'AbortError') {
				throw error;
			}
		}
	}

	/**
	 * 中断当前查询
	 */
	async abort(): Promise<void> {
		this.abortController?.abort();

		if (this.client) {
			await this.client.interrupt();
		}

		this.messageTask = null;
		this.messageCallback = null;
	}

	/**
	 * 连接到 iFlow CLI
	 */
	async connect(queryOptions: IFlowQueryOptions = {}): Promise<void> {
		if (this.connected) {
			return;
		}

		const options = this.buildIFlowOptions(queryOptions);

		this.client = new IFlowClient(options);

		await this.client.connect();

		// 如果指定了 sessionId，加载会话
		if (queryOptions.sessionId) {
			await this.client.loadSession(queryOptions.sessionId);
		}

		this.connected = true;
	}

	/**
	 * 断开连接
	 */
	async disconnect(): Promise<void> {
		if (this.client) {
			await this.client.disconnect();
			this.client = null;
		}

		this.connected = false;
		this.messageTask = null;
		this.messageCallback = null;
	}

	/**
	 * 检查是否已连接
	 */
	isConnected(): boolean {
		return this.connected && this.client !== null;
	}

	/**
	 * 批准工具调用
	 */
	async approveToolCall(
		toolId: string,
		alwaysApprove = false
	): Promise<void> {
		if (!this.client) {
			throw new Error('IFlow client not connected');
		}

		await this.client.approveToolCall(
			toolId,
			alwaysApprove ? 'alwaysAllow' : 'allow'
		);
	}

	/**
	 * 拒绝工具调用
	 */
	async rejectToolCall(toolId: string): Promise<void> {
		if (!this.client) {
			throw new Error('IFlow client not connected');
		}

		await this.client.rejectToolCall(toolId);
	}

	/**
	 * 单条消息超时时间（毫秒）
	 * 根据测试，iFlow 生成完整回复可能需要 20-30 秒
	 */
	private static readonly MESSAGE_TIMEOUT = 60000; // 60 秒

	/**
	 * 处理消息流
	 */
	private async processMessages(
		messageIterator: AsyncIterator<Message>
	): Promise<void> {
		let isComplete = false;

		try {
			while (!isComplete) {
				// 检查是否已中止
				if (this.abortController?.signal.aborted) {
					break;
				}

				// 使用超时包装获取下一条消息
				const result = await this.withTimeout(
					messageIterator.next(),
					IFlowService.MESSAGE_TIMEOUT,
					'Single message timeout'
				);

				if (result.done) {
					break;
				}

				const message = result.value;

				// 检查是否需要终止
				if (this.shouldTerminate(message)) {
					isComplete = true;
				}

				// 回调处理消息
				if (this.messageCallback) {
					const chunks = convertToStreamChunk(message);

					for (const chunk of chunks) {
						this.messageCallback(chunk);
					}
				}
			}
		} catch (error) {
			// 处理超时错误 - 发送 done 标记
			if (error instanceof Error && error.message.includes('timeout')) {
				if (this.messageCallback) {
					this.messageCallback({ type: 'done' });
				}
				return;
			}

			// 重新抛出非中止错误
			if (error instanceof Error && error.name !== 'AbortError') {
				throw error;
			}
		}
	}

	/**
	 * 检查消息是否表示流结束
	 */
	private shouldTerminate(message: Message): boolean {
		return message.type === 'task_finish' || message.type === 'error';
	}

	/**
	 * 带超时的 Promise 包装
	 */
	private withTimeout<T>(
		promise: Promise<T>,
		ms: number,
		message: string
	): Promise<T> {
		return Promise.race([
			promise,
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error(message)), ms)
			),
		]);
	}

	/**
	 * 构建 iFlow SDK 选项
	 */
	private buildIFlowOptions(queryOptions: IFlowQueryOptions = {}): IFlowOptions {
		return IFlowOptionsBuilder.build(
			{
				plugin: this.plugin,
				vaultPath: this.vaultPath,
				customEnv: {},
				enhancedPath: process.env.PATH || '',
			},
			queryOptions
		);
	}

	/**
	 * 使用 AsyncGenerator 执行查询（与 ClaudianService 兼容的接口）
	 */
	async *queryGenerator(
		prompt: string,
		_options: QueryOptions = {}
	): AsyncGenerator<StreamChunk> {
		if (!this.client || !this.connected) {
			yield { type: 'error', content: 'IFlow client not connected' };
			return;
		}

		const chunks: StreamChunk[] = [];
		let resolveChunk: ((chunk: StreamChunk | null) => void) | null = null;
		let isDone = false;

		// 启动查询并收集 chunks
		const queryPromise = this.query(prompt, _options, (chunk) => {
			if (resolveChunk) {
				resolveChunk(chunk);
				resolveChunk = null;
			} else {
				chunks.push(chunk);
			}
		});

		// 当查询完成时标记结束
		queryPromise.then(() => {
			isDone = true;
			if (resolveChunk) {
				resolveChunk(null);
			}
		}).catch(() => {
			isDone = true;
			if (resolveChunk) {
				resolveChunk(null);
			}
		});

		// 生成 chunks
		while (!isDone || chunks.length > 0) {
			if (chunks.length > 0) {
				yield chunks.shift()!;
			} else if (!isDone) {
				const chunk = await new Promise<StreamChunk | null>((resolve) => {
					resolveChunk = resolve;
				});
				if (chunk) {
					yield chunk;
				}
			} else {
				break;
			}
		}
	}
}