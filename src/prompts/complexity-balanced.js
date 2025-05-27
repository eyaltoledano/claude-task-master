/**
 * Balanced complexity analysis prompt
 * Balances cost and detail for practical use (2,100 chars)
 * Default mode providing good balance between cost efficiency and analysis depth
 */

/**
 * Generates the balanced (middle-ground) prompt for complexity analysis.
 * @param {Object} tasksData - The tasks data object.
 * @returns {string} The generated prompt.
 */
export function generateBalancedPrompt(tasksData) {
	const tasksString = JSON.stringify(tasksData.tasks, null, 2);

	return `Analyze tasks using 5-dimensional complexity scoring (1-10 each):

## Dimensions & Weights
**Technical (T) 25%**: Algorithm complexity, architecture design, performance needs, system integration
**Integration (I) 20%**: External APIs, cross-system compatibility, data transformations, 3rd-party services  
**Domain (D) 20%**: Business logic, specialized knowledge, compliance requirements, UX complexity
**Risk (R) 20%**: Requirement uncertainty, rework potential, external dependencies, failure impact
**Maintenance (M) 15%**: Long-term support, documentation needs, extensibility, testing complexity

## Scoring Process
1. Analyze requirements thoroughly
2. Score each dimension T, I, D, R, M (1-10)
3. Calculate: T×0.25 + I×0.20 + D×0.20 + R×0.20 + M×0.15
4. Recommend subtasks: 1-3→2-3, 4-6→3-5, 7-8→5-7, 9-10→7-10
5. Generate specific, actionable expansion prompts

## Examples
- Simple form: T:2, I:1, D:3, R:2, M:3 = 2.25 → 3 subtasks
- Complex API: T:8, I:9, D:7, R:8, M:7 = 7.85 → 6 subtasks

Tasks:
${tasksString}

Return JSON array with reasoning showing dimension scores and actionable expansion prompts:
[{"taskId": n, "taskTitle": "string", "complexityScore": n, "recommendedSubtasks": n, "reasoning": "T:n, I:n, D:n, R:n, M:n = final score", "expansionPrompt": "1) Specific subtask... 2) Another subtask..."}]`;
}