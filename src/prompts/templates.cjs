// Static requires keep templates bundleable without version-specific JSON syntax.
module.exports = {
	addTaskPrompt: require('./add-task.json'),
	analyzeComplexityPrompt: require('./analyze-complexity.json'),
	expandTaskPrompt: require('./expand-task.json'),
	parsePrdPrompt: require('./parse-prd.json'),
	researchPrompt: require('./research.json'),
	updateSubtaskPrompt: require('./update-subtask.json'),
	updateTaskPrompt: require('./update-task.json'),
	updateTasksPrompt: require('./update-tasks.json'),
	promptTemplateSchema: require('./schemas/prompt-template.schema.json')
};
