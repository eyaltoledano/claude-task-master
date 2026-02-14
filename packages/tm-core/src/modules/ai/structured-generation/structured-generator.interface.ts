/**
 * @fileoverview Contract for generic structured AI output generation
 */

import type { z } from 'zod';
import type {
	AIPrimitiveOptions,
	AIPrimitiveResult
} from '../types/primitives.types.js';

export interface IStructuredGenerator {
	generate<T>(
		prompt: string,
		schema: z.ZodSchema<T>,
		options: AIPrimitiveOptions & { objectName?: string }
	): Promise<AIPrimitiveResult<T>>;
}
