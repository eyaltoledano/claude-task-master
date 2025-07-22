import { z } from 'zod';
import { BaseTaskSchema } from './base-schemas.js';

export const UpdatedTaskSchema = BaseTaskSchema.extend({
    subtasks: z.array(z.any()).nullable().default(null)
});

export const UpdateTasksResponseSchema = z.object({
    tasks: z.array(UpdatedTaskSchema)
});