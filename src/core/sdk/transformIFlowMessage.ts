/**
 * transformIFlowMessage - 将 iFlow CLI SDK 消息转换为 Claudian 内部消息格式
 */

import {
	type AssistantMessage,
	type ErrorMessage,
	type Message,
	MessageType,
	type TaskFinishMessage,
	type ToolCallMessage,
	ToolCallStatus,
} from '@iflow-ai/iflow-cli-sdk';

import type { ChatMessage, ContentBlock, ToolCallInfo } from '../types';

/**
 * 将 iFlow 消息转换为 Claudian ChatMessage
 */
export function transformIFlowMessage(
	message: Message
): ChatMessage | null {
	switch (message.type) {
		case MessageType.ASSISTANT:
			return transformAssistantMessage(message as AssistantMessage);

		case MessageType.TOOL_CALL:
			return transformToolCallMessage(message as ToolCallMessage);

		case MessageType.TASK_FINISH:
			return transformTaskFinishMessage(message as TaskFinishMessage);

		case MessageType.ERROR:
			return transformErrorMessage(message as ErrorMessage);

		default:
			return null;
	}
}

/**
 * 转换助手消息
 */
function transformAssistantMessage(
	message: AssistantMessage
): ChatMessage {
	const contentBlocks: ContentBlock[] = [];
	let text = '';

	// 文本内容
	if (message.chunk.text) {
		text = message.chunk.text;
	}

	// 思考内容
	if (message.chunk.thought) {
		contentBlocks.push({
			type: 'thinking',
			content: message.chunk.thought,
		});
	}

	return {
		id: `iflow-${Date.now()}-${Math.random()}`,
		role: 'assistant',
		content: text,
		contentBlocks,
		timestamp: Date.now(),
	};
}

/**
 * 转换工具调用消息
 */
function transformToolCallMessage(
	message: ToolCallMessage
): ChatMessage {
	const toolCall: ToolCallInfo = {
		id: message.id,
		name: message.toolName || 'unknown',
		input: (message.args as Record<string, unknown>) || {},
		status: mapToolCallStatus(message.status),
		isExpanded: false,
	};

	// 工具输出
	if (message.output) {
		toolCall.result = message.output;
	}

	// 工具内容（用于 diff 显示）
	if (message.content && message.content.type === 'diff' && message.content.path) {
		// diff 数据会在渲染时计算
	}

	// 代理信息
	if (message.agentInfo) {
		// 如果有代理信息，可以添加 subagents 数组
	}

	return {
		id: `tool-${message.id}`,
		role: 'assistant',
		content: '',
		contentBlocks: [
			{
				type: 'tool_use',
				toolId: message.id,
			},
		],
		toolCalls: [toolCall],
		timestamp: Date.now(),
	};
}

/**
 * 转换任务完成消息
 */
function transformTaskFinishMessage(
	message: TaskFinishMessage
): ChatMessage {
	return {
		id: `finish-${Date.now()}`,
		role: 'assistant',
		content: '',
		timestamp: Date.now(),
	};
}

/**
 * 转换错误消息
 */
function transformErrorMessage(message: ErrorMessage): ChatMessage {
	return {
		id: `error-${Date.now()}`,
		role: 'assistant',
		content: `Error [${message.code}]: ${message.message}`,
		timestamp: Date.now(),
	};
}

/**
 * 映射工具调用状态
 */
function mapToolCallStatus(
	status: `${ToolCallStatus}`
): ToolCallInfo['status'] {
	switch (status) {
		case ToolCallStatus.PENDING:
			return 'running';
		case ToolCallStatus.IN_PROGRESS:
			return 'running';
		case ToolCallStatus.COMPLETED:
			return 'completed';
		case ToolCallStatus.FAILED:
			return 'error';
		default:
			return 'running';
	}
}