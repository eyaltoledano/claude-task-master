/**
 * @fileoverview Bridged implementation of ITagSemanticAnalyzer
 * Delegates to generateObjectService() from the legacy AI services module
 */

import { z } from 'zod';
import type { GenerateObjectServiceFn } from '../../ai/structured-generation/structured-generator.js';
import type { AIPrimitiveOptions, AIPrimitiveResult } from '../../ai/types/primitives.types.js';
import type { ITagSemanticAnalyzer } from './tag-semantic-analyzer.interface.js';
import { tagSemanticAnalysisPrompt } from './tag-semantic-analyzer.prompt.js';
import type { SemanticAnalysis } from './tag-semantic-analyzer.types.js';

const semanticAnalysisSchema = z.object({
	summary: z.string().describe('A concise summary of the tag and its tasks'),
	themes: z.array(z.string()).describe('Key themes or categories of work'),
	capabilities: z.array(z.string()).describe('What this tag provides or enables'),
	technicalDomain: z.string().describe('The primary technical domain (e.g., "backend", "auth", "UI")'),
	keyEntities: z.array(z.string()).describe('Key entities, modules, or concepts involved')
});

const DEFAULT_SYSTEM_PROMPT = tagSemanticAnalysisPrompt().build();

export class BridgedTagSemanticAnalyzer implements ITagSemanticAnalyzer {
	constructor(private readonly generateObjectService: GenerateObjectServiceFn) {}

	async analyze(
		content: string,
		context: string,
		options: AIPrimitiveOptions
	): Promise<AIPrimitiveResult<SemanticAnalysis>> {
		const startTime = Date.now();

		const prompt = `Analyze the following tag and its tasks:\n\nContext: ${context}\n\n${content}`;

		const result = await this.generateObjectService({
			role: 'main',
			systemPrompt: options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
			prompt,
			schema: semanticAnalysisSchema,
			objectName: 'semantic_analysis',
			commandName: options.commandName,
			outputType: 'cli'
		});

		const duration = Date.now() - startTime;
		const data = result.mainResult as SemanticAnalysis | undefined;

		if (!data) {
			throw new Error('Semantic analysis failed: no result returned from generateObjectService');
		}

		return {
			data: {
				summary: data.summary,
				themes: data.themes,
				capabilities: data.capabilities,
				technicalDomain: data.technicalDomain,
				keyEntities: data.keyEntities
			},
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
