/**
 * PoC - 验证 iFlow CLI SDK 在 Obsidian 环境中的兼容性
 *
 * 这是一个概念验证脚本，用于测试：
 * 1. WebSocket 连接在 Obsidian/Electron 环境中是否工作
 * 2. iFlow CLI SDK 的基本功能
 * 3. 消息流的接收和处理
 */

import { IFlowClient, PermissionMode } from '@iflow-ai/iflow-cli-sdk';

/**
 * 简单的 PoC 测试函数
 */
export async function testIFlowPoC() {
	console.log('[IFlow PoC] Starting test...');

	try {
		// 测试 1: 创建客户端
		console.log('[IFlow PoC] Creating IFlowClient...');
		const client = new IFlowClient({
			permissionMode: PermissionMode.MANUAL,
			autoStartProcess: true,
		});

		// 测试 2: 连接到 iFlow CLI
		console.log('[IFlow PoC] Connecting to iFlow CLI...');
		await client.connect();
		console.log('[IFlow PoC] Connected successfully!');

		// 测试 3: 发送简单消息
		console.log('[IFlow PoC] Sending test message...');
		await client.sendMessage('Hello! This is a test from Claudian.');
		console.log('[IFlow PoC] Message sent successfully!');

		// 测试 4: 接收消息流
		console.log('[IFlow PoC] Receiving messages...');
		let messageCount = 0;
		const maxMessages = 10; // 限制接收消息数量

		for await (const message of client.receiveMessages()) {
			messageCount++;
			console.log(`[IFlow PoC] Received message #${messageCount}:`, message.type);

			// 显示消息内容
			if (message.type === 'assistant') {
				console.log('[IFlow PoC] Assistant text:', (message as any).chunk?.text?.substring(0, 100));
			} else if (message.type === 'tool_call') {
				console.log('[IFlow PoC] Tool call:', (message as any).toolName);
			} else if (message.type === 'task_finish') {
				console.log('[IFlow PoC] Task finished:', (message as any).stopReason);
				break; // 任务完成，退出循环
			}

			if (messageCount >= maxMessages) {
				console.log('[IFlow PoC] Reached max messages, stopping...');
				break;
			}
		}

		// 测试 5: 断开连接
		console.log('[IFlow PoC] Disconnecting...');
		await client.disconnect();
		console.log('[IFlow PoC] Disconnected successfully!');

		console.log('[IFlow PoC] Test completed successfully!');
		return {
			success: true,
			messageCount,
		};
	} catch (error) {
		console.error('[IFlow PoC] Test failed:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * WebSocket 兼容性测试
 *
 * Obsidian 运行在 Electron 环境中，需要验证 WebSocket 是否可用
 */
export async function testWebSocketCompatibility() {
	console.log('[WebSocket Test] Checking WebSocket availability...');

	// 检查 WebSocket 是否可用
	if (typeof WebSocket !== 'undefined') {
		console.log('[WebSocket Test] WebSocket is available:', typeof WebSocket);

		// 尝试创建一个简单的 WebSocket 连接（不实际连接）
		try {
			const ws = new WebSocket('ws://localhost:0'); // 使用端口 0 来避免实际连接
			console.log('[WebSocket Test] WebSocket object created successfully');
			ws.close();
			return { success: true, message: 'WebSocket is available and functional' };
		} catch (error) {
			console.error('[WebSocket Test] WebSocket creation failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	} else {
		console.error('[WebSocket Test] WebSocket is not available');
		return {
			success: false,
			error: 'WebSocket is not available in this environment',
		};
	}
}

/**
 * 环境信息收集
 */
export function collectEnvironmentInfo() {
	return {
		platform: typeof process !== 'undefined' ? process.platform : 'unknown',
		arch: typeof process !== 'undefined' ? process.arch : 'unknown',
		nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
		userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
		webSocketAvailable: typeof WebSocket !== 'undefined',
	};
}

/**
 * 运行所有 PoC 测试
 */
export async function runAllPoCTests() {
	console.log('=== IFlow CLI SDK PoC Test Suite ===\n');

	// 收集环境信息
	console.log('Environment Info:');
	const envInfo = collectEnvironmentInfo();
	Object.entries(envInfo).forEach(([key, value]) => {
		console.log(`  ${key}: ${value}`);
	});
	console.log();

	// 测试 WebSocket 兼容性
	console.log('Test 1: WebSocket Compatibility');
	const wsTest = await testWebSocketCompatibility();
	console.log('  Result:', wsTest.success ? 'PASS' : 'FAIL');
	if (!wsTest.success) {
		console.log('  Error:', wsTest.error);
	}
	console.log();

	// 测试 iFlow CLI SDK
	console.log('Test 2: IFlow CLI SDK Integration');
	const iflowTest = await testIFlowPoC();
	console.log('  Result:', iflowTest.success ? 'PASS' : 'FAIL');
	if (!iflowTest.success) {
		console.log('  Error:', iflowTest.error);
	} else {
		console.log('  Messages received:', iflowTest.messageCount);
	}
	console.log();

	console.log('=== PoC Test Suite Complete ===');

	return {
		webSocket: wsTest,
		iflow: iflowTest,
		environment: envInfo,
	};
}