import { z } from 'zod';

/**
 * Base schemas that will be reused across commands.
 *
 * IMPORTANT: All object schemas use .strict() to add "additionalProperties: false"
 * to the generated JSON Schema. This is REQUIRED for OpenAI's Structured Outputs API,
 * which mandates that every object type explicitly includes additionalProperties: false.
 * Without .strict(), OpenAI API returns 400 Bad Request errors.
 *
 * Other providers (Anthropic, Google, etc.) safely ignore this constraint.
 * See: https://platform.openai.com/docs/guides/structured-outputs
 *
 * NOTE: The `metadata` field (user-defined task metadata) is intentionally EXCLUDED
 * from all AI schemas. This ensures AI operations cannot overwrite user metadata.
 * When tasks are updated via AI, the spread operator preserves existing metadata
 * since AI responses won't include a metadata field.
 */
export const TaskStatusSchema = z.enum([
	'pending',
	'in-progress',
	'blocked',
	'done',
	'cancelled',
	'deferred'
]);

export const BaseTaskSchema = z
	.object({
		id: z.number().int().positive(),
		title: z.string().min(1).max(200),
		description: z.string().min(1),
		status: TaskStatusSchema,
		dependencies: z.array(z.union([z.number().int().positive(), z.string()])),
		priority: z.enum(['low', 'medium', 'high', 'critical']).nullable(),
		details: z.string().nullable(),
		testStrategy: z.string().nullable()
	})
	.strict();

export const SubtaskSchema = z
	.object({
		id: z.number().int().positive(),
		title: z.string().min(5).max(200),
		description: z.string().min(10),
		dependencies: z.array(z.number().int().positive()),
		details: z.string().min(20),
		status: z.enum(['pending', 'done', 'completed']),
		testStrategy: z.string().nullable()
	})
	.strict();
