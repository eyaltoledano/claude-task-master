/**
 * Pure utility functions for TaskManagementScreen
 * These functions don't depend on component state and can be safely extracted
 */

/**
 * Get the visual symbol for a task status
 */
export const getStatusSymbol = (status) => {
	switch (status) {
		case 'done':
			return '✓';
		case 'in-progress':
			return '●';
		case 'pending':
			return '○';
		case 'review':
			return '◉';
		case 'blocked':
			return '⊗';
		case 'deferred':
			return '⊙';
		case 'cancelled':
			return '✗';
		default:
			return '?';
	}
};

/**
 * Get theme color for a task status
 */
export const getStatusColor = (status, theme) => {
	switch (status) {
		case 'done':
			return theme.statusDone;
		case 'in-progress':
			return theme.statusInProgress;
		case 'pending':
			return theme.statusPending;
		case 'review':
			return theme.priorityMedium;
		case 'blocked':
			return theme.statusBlocked;
		case 'deferred':
			return theme.statusDeferred;
		case 'cancelled':
			return theme.statusBlocked;
		default:
			return theme.text;
	}
};

/**
 * Get theme color for a task priority
 */
export const getPriorityColor = (priority, theme) => {
	switch (priority) {
		case 'high':
			return theme.priorityHigh;
		case 'medium':
			return theme.priorityMedium;
		case 'low':
			return theme.priorityLow;
		default:
			return theme.text;
	}
};

/**
 * Format task dependencies for display
 */
export const formatDependencies = (dependencies) => {
	if (!dependencies || dependencies.length === 0) return '-';
	return dependencies.join(', ');
};

/**
 * Extract key implementation decisions from task details
 */
export const extractKeyDecisions = (details) => {
	if (!details) return '';

	const patterns = [
		/decided to use/i,
		/implementation approach/i,
		/chosen.*because/i,
		/architecture decision/i,
		/key insight/i,
		/important:/i
	];

	return details
		.split('\n')
		.filter((line) => patterns.some((p) => p.test(line)))
		.slice(0, 5)
		.join('\n');
};

/**
 * Extract technology stack from text description
 */
export const extractTechStack = (text) => {
	// Common technology patterns
	const techPatterns = [
		/\b(React|Vue|Angular|Svelte)\b/gi,
		/\b(Node\.?js|Express|Fastify|Koa)\b/gi,
		/\b(TypeScript|JavaScript|Python|Go|Rust)\b/gi,
		/\b(PostgreSQL|MySQL|MongoDB|Redis)\b/gi,
		/\b(AWS|Azure|GCP|Docker|Kubernetes)\b/gi,
		/\b(GraphQL|REST|gRPC|WebSocket)\b/gi
	];

	const matches = new Set();
	techPatterns.forEach((pattern) => {
		const found = text.match(pattern);
		if (found) {
			found.forEach((tech) => matches.add(tech));
		}
	});

	return Array.from(matches).join(', ');
};

/**
 * Extract Claude session IDs from task details
 */
export const extractClaudeSessionIds = (details) => {
	if (!details) return [];

	const sessionIds = [];
	// Look for session IDs in multiple formats
	const patterns = [
		/<claude-session[^>]+sessionId="([^"]+)"[^>]*>/gi,
		/\*\*Session ID:\*\* ([a-f0-9-]+)/gi,
		/Session ID: ([a-f0-9-]+)/gi
	];

	patterns.forEach((pattern) => {
		let match;
		match = pattern.exec(details);
		while (match !== null) {
			if (match[1] && !sessionIds.includes(match[1])) {
				sessionIds.push(match[1]);
			}
			match = pattern.exec(details);
		}
	});

	return sessionIds;
};

/**
 * Build research query for a subtask
 */
export const buildResearchQuery = (selectedSubtask, selectedTask) => {
	const techStack = extractTechStack(
		`${selectedSubtask.description || ''} ${selectedTask.description || ''}`
	);

	return `
Best practices and implementation guidance for: ${selectedSubtask.title}
Context: ${selectedTask.title}
${techStack ? `Technologies: ${techStack}` : ''}
Focus on: current industry standards, common pitfalls, security considerations
	`.trim();
};

/**
 * Constants for the TaskManagement component
 */
export const TASK_MANAGEMENT_CONSTANTS = {
	VISIBLE_ROWS: 15,
	DETAIL_VISIBLE_ROWS: 20,
	STATUS_CYCLE: ['pending', 'in-progress', 'review', 'done'],
	PRIORITY_CYCLE: ['low', 'medium', 'high'],
	FILTER_MODES: {
		STATUS: 'status',
		PRIORITY: 'priority'
	},
	VIEW_MODES: {
		LIST: 'list',
		DETAIL: 'detail', 
		SUBTASKS: 'subtasks',
		SUBTASK_DETAIL: 'subtask-detail'
	}
}; 