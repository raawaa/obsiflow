/**
 * convertToStreamChunk - 将 iFlow SDK Message 转换为 StreamChunk
 *
 * 这样可以让现有的 StreamController 处理 iFlow SDK 的消息
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

import type { StreamChunk } from '../types';

/**
 * 将 iFlow 消息转换为 StreamChunk
 */
export function convertToStreamChunk(message: Message): StreamChunk[] {
	const chunks: StreamChunk[] = [];

	switch (message.type) {
		case MessageType.ASSISTANT: {
			const assistantMsg = message as AssistantMessage;

			// 思考内容
			if (assistantMsg.chunk.thought) {
				chunks.push({
					type: 'thinking',
					content: assistantMsg.chunk.thought,
					parentToolUseId: assistantMsg.agentId,
				});
			}

			// 文本内容
			if (assistantMsg.chunk.text) {
				chunks.push({
					type: 'text',
					content: assistantMsg.chunk.text,
					parentToolUseId: assistantMsg.agentId,
				});
			}

			break;
		}

		case MessageType.TOOL_CALL: {
			const toolMsg = message as ToolCallMessage;

			chunks.push({
				type: 'tool_use',
				id: toolMsg.id,
				name: toolMsg.toolName || 'unknown',
				input: (toolMsg.args as Record<string, unknown>) || {},
				parentToolUseId: toolMsg.agentId,
			});

			// 如果工具调用已完成，添加结果
			if (
				toolMsg.status === ToolCallStatus.COMPLETED ||
				toolMsg.status === ToolCallStatus.FAILED
			) {
				chunks.push({
					type: 'tool_result',
					id: toolMsg.id,
					content: toolMsg.output || '',
					isError: toolMsg.status === ToolCallStatus.FAILED,
					parentToolUseId: toolMsg.agentId,
				});
			}

			break;
		}

		case MessageType.TASK_FINISH: {
			const finishMsg = message as TaskFinishMessage;

			// 任务完成，添加 done 标记
			chunks.push({ type: 'done' });

			// 如果有错误信息，添加错误块
			if (finishMsg.stopReason === 'refusal') {
				chunks.push({
					type: 'error',
					content: 'Request was refused by the AI',
				});
			} else if (finishMsg.stopReason === 'cancelled') {
				chunks.push({
					type: 'error',
					content: 'Request was cancelled',
				});
			}

			break;
		}

		case MessageType.ERROR: {
			const errorMsg = message as ErrorMessage;

			chunks.push({
				type: 'error',
				content: `Error [${errorMsg.code}]: ${errorMsg.message}`,
			});

			break;
		}

		default:
			// 其他消息类型暂时忽略或添加 done 标记
			break;
	}

	return chunks;
}