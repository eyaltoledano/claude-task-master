/**
 * @fileoverview Contract for semantic analysis of project tags
 */

import type { AIPrimitiveOptions, AIPrimitiveResult } from '../../ai/types/primitives.types.js';
import type { SemanticAnalysis } from './tag-semantic-analyzer.types.js';

export interface ITagSemanticAnalyzer {
	analyze(
		content: string,
		context: string,
		options: AIPrimitiveOptions
	): Promise<AIPrimitiveResult<SemanticAnalysis>>;
}
