import { z } from 'zod';
import { UpdatedTaskSchema } from './update-tasks.js';

export const UpdateTaskResponseSchema = z.object({
	task: UpdatedTaskSchema
});
