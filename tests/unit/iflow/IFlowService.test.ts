/**
 * IFlowService 单元测试
 */

import { convertToStreamChunk } from '../../../src/core/iflow/convertToStreamChunk';
import { IFlowOptionsBuilder } from '../../../src/core/iflow/IFlowOptionsBuilder';
import { IFlowService } from '../../../src/core/iflow/IFlowService';
import { transformIFlowMessage } from '../../../src/core/sdk/transformIFlowMessage';

// Mock plugin
const mockPlugin = {
	settings: {
		permissionMode: 'normal',
		systemPrompt: 'You are a helpful assistant',
		model: 'sonnet',
	},
	mcpManager: {
		getServerConfigs: () => [],
	},
};

// Mock vault path
const mockVaultPath = '/path/to/vault';

describe('IFlowOptionsBuilder', () => {
	test('应该正确构建 IFlowOptions', () => {
		const options = IFlowOptionsBuilder.build(
			{
				plugin: mockPlugin as any,
				vaultPath: mockVaultPath,
				customEnv: {},
				enhancedPath: process.env.PATH || '',
			},
			{
				allowedTools: ['read', 'write'],
			}
		);

		expect(options.cwd).toBe(mockVaultPath);
		expect(options.autoStartProcess).toBe(true);
		expect(options.sessionSettings?.permission_mode).toBe('default');
		expect(options.sessionSettings?.allowed_tools).toContain('read');
	});

	test('应该正确映射权限模式', () => {
		const yoloPlugin = { ...mockPlugin, settings: { ...mockPlugin.settings, permissionMode: 'yolo' as const } };
		const options = IFlowOptionsBuilder.build(
			{
				plugin: yoloPlugin as any,
				vaultPath: mockVaultPath,
				customEnv: {},
				enhancedPath: process.env.PATH || '',
			}
		);

		expect(options.sessionSettings?.permission_mode).toBe('yolo');
	});

	test('应该正确映射 plan 模式', () => {
		const planPlugin = { ...mockPlugin, settings: { ...mockPlugin.settings, permissionMode: 'plan' as const } };
		const options = IFlowOptionsBuilder.build(
			{
				plugin: planPlugin as any,
				vaultPath: mockVaultPath,
				customEnv: {},
				enhancedPath: process.env.PATH || '',
			}
		);

		expect(options.sessionSettings?.permission_mode).toBe('plan');
	});
});

describe('convertToStreamChunk', () => {
	test('应该正确转换 assistant 消息', () => {
		const message = {
			type: 'assistant' as const,
			chunk: {
				text: 'Hello, world!',
				thought: 'Thinking about greeting...',
			},
		};

		const chunks = convertToStreamChunk(message);

		expect(chunks).toHaveLength(2);
		expect(chunks[0].type).toBe('thinking');
		expect((chunks[0] as any).content).toBe('Thinking about greeting...');
		expect(chunks[1].type).toBe('text');
		expect((chunks[1] as any).content).toBe('Hello, world!');
	});

	test('应该正确转换 tool_call 消息', () => {
		const message = {
			type: 'tool_call' as const,
			id: 'tool-123',
			toolName: 'read_file',
			label: 'read_file',
			icon: { type: 'emoji' as const, value: '📄' },
			args: { path: '/path/to/file' },
			status: 'completed' as const,
			output: 'File content',
		};

		const chunks = convertToStreamChunk(message);

		expect(chunks).toHaveLength(2);
		expect(chunks[0].type).toBe('tool_use');
		expect((chunks[0] as any).id).toBe('tool-123');
		expect((chunks[0] as any).name).toBe('read_file');
		expect(chunks[1].type).toBe('tool_result');
		expect((chunks[1] as any).id).toBe('tool-123');
		expect((chunks[1] as any).content).toBe('File content');
	});

	test('应该正确转换 task_finish 消息', () => {
		const message = {
			type: 'task_finish' as const,
			stopReason: 'end_turn' as const,
		};

		const chunks = convertToStreamChunk(message);

		expect(chunks).toHaveLength(1);
		expect(chunks[0].type).toBe('done');
	});

	test('应该正确转换 error 消息', () => {
		const message = {
			type: 'error' as const,
			code: 404,
			message: 'Not found',
		};

		const chunks = convertToStreamChunk(message);

		expect(chunks).toHaveLength(1);
		expect(chunks[0].type).toBe('error');
		expect((chunks[0] as any).content).toContain('Not found');
	});
});

describe('transformIFlowMessage', () => {
	test('应该正确转换 assistant 消息为 ChatMessage', () => {
		const message = {
			type: 'assistant' as const,
			chunk: {
				text: 'Hello, world!',
				thought: 'Thinking...',
			},
		};

		const chatMessage = transformIFlowMessage(message);

		expect(chatMessage).not.toBeNull();
		expect(chatMessage?.role).toBe('assistant');
		expect(chatMessage?.content).toBe('Hello, world!');
		expect(chatMessage?.contentBlocks).toHaveLength(1);
		expect(chatMessage?.contentBlocks?.[0].type).toBe('thinking');
	});

	test('应该正确转换 tool_call 消息为 ChatMessage', () => {
		const message = {
			type: 'tool_call' as const,
			id: 'tool-123',
			toolName: 'read_file',
			label: 'read_file',
			icon: { type: 'emoji' as const, value: '📄' },
			args: { path: '/path/to/file' },
			status: 'completed' as const,
			output: 'File content',
		};

		const chatMessage = transformIFlowMessage(message);

		expect(chatMessage).not.toBeNull();
		expect(chatMessage?.role).toBe('assistant');
		expect(chatMessage?.toolCalls).toHaveLength(1);
		expect(chatMessage?.toolCalls?.[0].id).toBe('tool-123');
		expect(chatMessage?.toolCalls?.[0].name).toBe('read_file');
	});

	test('应该返回 null 对于不支持的消息类型', () => {
		const message = {
			type: 'plan' as const,
			entries: [],
		};

		const chatMessage = transformIFlowMessage(message);

		expect(chatMessage).toBeNull();
	});
});

describe('IFlowService', () => {
	test('应该正确创建 IFlowService 实例', () => {
		const service = new IFlowService(mockPlugin as any, mockVaultPath);

		expect(service).toBeInstanceOf(IFlowService);
	});

	// 注意：实际的连接和查询测试需要 iFlow CLI 已安装
	// 这些测试应该在集成测试中进行
});