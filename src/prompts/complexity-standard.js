/**
 * Standard (ultra-compressed) complexity analysis prompt
 * Optimized for cost efficiency with minimal token usage (783 chars)
 * Uses NAACL 2025 compression techniques: token elimination, abbreviation, mathematical notation
 */

/**
 * Generates the standard (ultra-compressed) prompt for complexity analysis.
 * @param {Object} tasksData - The tasks data object.
 * @returns {string} The generated prompt.
 */
export function generateStandardPrompt(tasksData) {
	const tasksString = JSON.stringify(tasksData.tasks, null, 2);

	return `5D complexity scoring (1-10):
T25%:algorithms/arch/perf|I20%:APIs/compat/3rd|D20%:logic/UX/compliance|R20%:uncertainty/rework/deps|M15%:support/docs/test

Process:
1.Requirements→2.Avoid over/false complexity→3.Score T,I,D,R,M→4.Calc T×0.25+I×0.2+D×0.2+R×0.2+M×0.15→5.Subtasks 1-3→2-3,4-6→3-5,7-8→5-7,9-10→7-10→6.Expansion

Examples:
FormValidation T:2,I:1,D:3,R:2,M:3=2.25→3(2-3sub)
RealtimeCollab T:9,I:8,D:7,R:9,M:8=8.25→8(6-8sub)

Samples:
Auth T:7,I:6,D:5,R:6,M:5=6.0,4sub,"1)Reg+valid 2)Login/out 3)JWT 4)PwdReset"
Button T:1,I:1,D:2,R:1,M:2=1.4→2,2sub,"1)CSS 2)Test"

Tasks:
${tasksString}

JSON output:
[{"taskId":n,"taskTitle":"s","complexityScore":n,"recommendedSubtasks":n,"reasoning":"T:n,I:n,D:n,R:n,M:n=score","expansionPrompt":"1)task 2)task..."}]`;
}