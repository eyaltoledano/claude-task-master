import { z } from 'zod';
import { BaseTaskSchema, SubtaskSchema } from './base-schemas.js';

export const UpdatedTaskSchema = BaseTaskSchema.extend({
	subtasks: z.array(SubtaskSchema).nullable().default(null)
});

export const UpdateTasksResponseSchema = z.object({
	tasks: z.array(UpdatedTaskSchema)
});
