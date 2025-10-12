import { z } from 'zod';

// Base schemas that will be reused across commands
export const TaskStatusSchema = z.enum([
	'pending',
	'in-progress',
	'blocked',
	'done',
	'cancelled',
	'deferred'
]);

export const BaseTaskSchema = z.object({
	id: z.number().int().positive(),
	title: z.string().min(1).max(200),
	description: z.string().min(1),
	status: TaskStatusSchema,
	dependencies: z.array(z.union([z.number().int(), z.string()])).default([]),
	priority: z
		.enum(['low', 'medium', 'high', 'critical'])
		.nullable()
		.default(null),
	details: z.string().nullable().default(null),
	testStrategy: z.string().nullable().default(null)
});

export const SubtaskSchema = z.object({
	id: z.number().int().positive(),
	title: z.string().min(5).max(200),
	description: z.string().min(10),
	dependencies: z.array(z.number().int()).default([]),
	details: z.string().min(20),
	// Subtasks should have the same status options as main tasks for consistency.
	// This gives an error if mcp client decides to set status to "in-progress",
	// according to the schema in the prompt that eventually fails to validate. 
	status: TaskStatusSchema.default('pending'), 
	testStrategy: z.string().nullable().default(null)
});
