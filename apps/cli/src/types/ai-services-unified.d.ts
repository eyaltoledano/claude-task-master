/**
 * Type declarations for legacy ai-services-unified.js
 * TODO: Remove when refactored to use @tm/core AI providers
 */

declare module '*/ai-services-unified.js' {
	export function generateObjectService(params: {
		role: string;
		systemPrompt: string;
		prompt: string;
		schema: unknown;
		objectName: string;
		commandName: string;
		outputType: string;
		session?: unknown;
		projectRoot?: string;
	}): Promise<{
		mainResult: unknown;
		telemetryData?: {
			inputTokens?: number;
			outputTokens?: number;
		} | null;
		providerName?: string;
		modelId?: string;
	}>;
}
