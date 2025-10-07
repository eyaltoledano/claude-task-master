import { z } from 'zod';

export const ComplexityAnalysisItemSchema = z.object({
	taskId: z.number().int().positive(),
	taskTitle: z.string(),
	complexityScore: z.number().min(1).max(10),
	recommendedSubtasks: z.number().int().nonnegative(),
	expansionPrompt: z.string(),
	reasoning: z.string()
});

export const ComplexityAnalysisResponseSchema = z.object({
	complexityAnalysis: z.array(ComplexityAnalysisItemSchema)
});
