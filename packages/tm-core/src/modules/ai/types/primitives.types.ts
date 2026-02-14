/**
 * @fileoverview Shared types for AI operations
 */

export interface AIPrimitiveOptions {
	readonly systemPrompt?: string;
	readonly temperature?: number;
	readonly maxTokens?: number;
	readonly commandName: string;
}

export interface AIPrimitiveResult<T> {
	readonly data: T;
	readonly usage: {
		readonly inputTokens: number;
		readonly outputTokens: number;
		readonly model: string;
		readonly provider: string;
		readonly duration: number;
	};
}
