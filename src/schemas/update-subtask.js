import { z } from 'zod';
import { SubtaskSchema } from './base-schemas.js';

export const UpdateSubtaskResponseSchema = z.object({
	subtask: SubtaskSchema
});
