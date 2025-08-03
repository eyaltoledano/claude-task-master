import { z } from 'zod';
import { SubtaskSchema } from './base-schemas.js';

export const ExpandTaskResponseSchema = z.object({
	subtasks: z.array(SubtaskSchema)
});
