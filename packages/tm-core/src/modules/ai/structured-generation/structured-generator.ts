/**
 * @fileoverview Bridged implementation of IStructuredGenerator
 * Delegates to generateObjectService() from the legacy AI services module
 */

import type { z } from 'zod';
import type { AIPrimitiveOptions, AIPrimitiveResult } from '../types/primitives.types.js';
import type { IStructuredGenerator } from './structured-generator.interface.js';

interface GenerateObjectServiceParams {
	readonly role: string;
	readonly systemPrompt: string;
	readonly prompt: string;
	readonly schema: z.ZodSchema;
	readonly objectName: string;
	readonly commandName: string;
	readonly outputType: string;
}

interface GenerateObjectServiceResult {
	readonly mainResult: unknown;
	readonly telemetryData?: {
		readonly inputTokens?: number;
		readonly outputTokens?: number;
	} | null;
	readonly providerName?: string;
	readonly modelId?: string;
}

export type GenerateObjectServiceFn = (
	params: GenerateObjectServiceParams
) => Promise<GenerateObjectServiceResult>;

export class BridgedStructuredGenerator implements IStructuredGenerator {
	constructor(private readonly generateObjectService: GenerateObjectServiceFn) {}

	async generate<T>(
		prompt: string,
		schema: z.ZodSchema<T>,
		options: AIPrimitiveOptions & { objectName?: string }
	): Promise<AIPrimitiveResult<T>> {
		const startTime = Date.now();

		const result = await this.generateObjectService({
			role: 'main',
			systemPrompt: options.systemPrompt ?? 'You are a helpful assistant.',
			prompt,
			schema,
			objectName: options.objectName ?? 'generated_object',
			commandName: options.commandName,
			outputType: 'cli'
		});

		const duration = Date.now() - startTime;

		return {
			data: result.mainResult as T,
			usage: {
				inputTokens: result.telemetryData?.inputTokens ?? 0,
				outputTokens: result.telemetryData?.outputTokens ?? 0,
				model: result.modelId ?? 'unknown',
				provider: result.providerName ?? 'unknown',
				duration
			}
		};
	}
}
