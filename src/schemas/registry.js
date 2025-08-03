import { AddTaskResponseSchema } from './add-task.js';
import { ComplexityAnalysisResponseSchema } from './analyze-complexity.js';
import { ExpandTaskResponseSchema } from './expand-task.js';
import { ParsePRDResponseSchema } from './parse-prd.js';
import { UpdateSubtaskResponseSchema } from './update-subtask.js';
import { UpdateTaskResponseSchema } from './update-task.js';
import { UpdateTasksResponseSchema } from './update-tasks.js';

export const COMMAND_SCHEMAS = {
	'update-tasks': UpdateTasksResponseSchema,
	'expand-task': ExpandTaskResponseSchema,
	'analyze-complexity': ComplexityAnalysisResponseSchema,
	'update-subtask-by-id': UpdateSubtaskResponseSchema,
	'update-task-by-id': UpdateTaskResponseSchema,
	'add-task': AddTaskResponseSchema,
	'parse-prd': ParsePRDResponseSchema
};

// Export individual schemas for direct access
export * from './update-tasks.js';
export * from './expand-task.js';
export * from './analyze-complexity.js';
export * from './update-subtask.js';
export * from './update-task.js';
export * from './add-task.js';
export * from './parse-prd.js';
export * from './base-schemas.js';
