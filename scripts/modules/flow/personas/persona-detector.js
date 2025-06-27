/**
 * Persona Detection for Task Master
 * Analyzes tasks and context to suggest appropriate personas
 */

import { personaDefinitions } from './persona-definitions.js';

// Activation patterns based on SuperClaude
const activationPatterns = {
	// File type detection patterns
	fileTypeDetection: {
		'tsx|jsx|css|scss|styled': 'frontend',
		'test|spec|cypress|jest|vitest': 'qa',
		'refactor|cleanup|tech-debt': 'refactorer',
		'api|server|controller|service|repository': 'backend',
		'auth|security|crypto|jwt|oauth': 'security',
		'perf|benchmark|optimization|performance': 'performance',
		'architecture|design|system|diagram': 'architect',
		'docs|readme|tutorial|guide': 'mentor'
	},

	// Keywords in task content
	contextKeywords: {
		'bug|error|issue|broken|fix|debug|investigate': 'analyzer',
		'teach|learn|explain|document|tutorial|guide': 'mentor',
		'design|architecture|system|structure|pattern': 'architect',
		'slow|performance|bottleneck|optimize|speed': 'performance',
		'test|quality|coverage|edge case|validation': 'qa',
		'security|vulnerability|auth|permission|access': 'security',
		'ui|ux|user interface|component|style|responsive': 'frontend',
		'api|endpoint|database|server|backend|scalability': 'backend',
		'refactor|clean|improve|technical debt|maintainability': 'refactorer'
	},

	// Task type patterns
	taskTypePatterns: {
		'implement.*api|create.*endpoint|build.*service': 'backend',
		'implement.*ui|create.*component|build.*interface': 'frontend',
		'fix.*bug|debug|investigate.*issue': 'analyzer',
		'refactor|improve.*code|clean.*up': 'refactorer',
		'add.*test|test.*coverage|write.*tests': 'qa',
		'implement.*auth|secure|add.*security': 'security',
		'optimize|improve.*performance|speed.*up': 'performance',
		'document|write.*guide|create.*tutorial': 'mentor',
		'design.*system|architect|plan.*structure': 'architect'
	}
};

/**
 * Detect persona based on task content and context
 * @param {Object} task - The task object
 * @param {Object} worktree - The worktree context
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Array of persona suggestions with confidence
 */
export async function detectPersona(task, worktree, options = {}) {
	const scores = {};

	// 1. Analyze task content
	const taskText =
		`${task.title} ${task.description || ''} ${task.details || ''} ${task.testStrategy || ''}`.toLowerCase();

	// Check task type patterns (weight: 3)
	for (const [pattern, persona] of Object.entries(
		activationPatterns.taskTypePatterns
	)) {
		const regex = new RegExp(pattern, 'i');
		if (regex.test(taskText)) {
			scores[persona] = (scores[persona] || 0) + 3;
		}
	}

	// Check context keywords (weight: 2)
	for (const [keywords, persona] of Object.entries(
		activationPatterns.contextKeywords
	)) {
		const keywordList = keywords.split('|');
		const matches = keywordList.filter((k) =>
			taskText.includes(k.trim())
		).length;
		if (matches > 0) {
			scores[persona] = (scores[persona] || 0) + matches * 2;
		}
	}

	// 2. Analyze files if worktree provided (weight: 1 per file)
	if (worktree && options.analyzeFiles !== false) {
		try {
			const filePaths = await extractFilePaths(taskText);
			for (const filePath of filePaths) {
				for (const [extensions, persona] of Object.entries(
					activationPatterns.fileTypeDetection
				)) {
					const extRegex = new RegExp(`\\.(${extensions})$`, 'i');
					if (extRegex.test(filePath)) {
						scores[persona] = (scores[persona] || 0) + 1;
					}
				}
			}
		} catch (err) {
			console.error('Error analyzing files:', err);
		}
	}

	// 3. Analyze dependencies and subtasks
	if (task.dependencies?.length > 0) {
		scores.architect = (scores.architect || 0) + 1; // Dependencies suggest architectural thinking
	}

	if (task.subtasks?.length > 5) {
		scores.architect = (scores.architect || 0) + 2; // Complex tasks need architectural approach
	}

	// 4. Calculate confidence and create results
	const maxScore = Math.max(...Object.values(scores), 1);
	const results = [];

	for (const [persona, score] of Object.entries(scores)) {
		if (score > 0) {
			results.push({
				persona,
				score,
				confidence: Math.round((score / maxScore) * 100),
				reasons: generateReasons(persona, task, score)
			});
		}
	}

	// Sort by confidence
	results.sort((a, b) => b.confidence - a.confidence);

	// If no clear winner, suggest based on task characteristics
	if (results.length === 0 || results[0].confidence < 50) {
		const defaultPersona = suggestDefaultPersona(task);
		results.unshift({
			persona: defaultPersona,
			score: 1,
			confidence: 40,
			reasons: [`Default suggestion based on task type`]
		});
	}

	return results;
}

/**
 * Extract file paths mentioned in task text
 */
function extractFilePaths(text) {
	const filePathRegex = /(?:[\w-]+\/)*[\w-]+\.\w+/g;
	const matches = text.match(filePathRegex) || [];
	return [...new Set(matches)];
}

/**
 * Generate human-readable reasons for persona selection
 */
function generateReasons(persona, task, score) {
	const reasons = [];
	const taskText = `${task.title} ${task.description || ''}`.toLowerCase();

	// Check what matched
	const personaKeywords = Object.entries(
		activationPatterns.contextKeywords
	).find(([keywords, p]) => p === persona)?.[0];

	if (personaKeywords) {
		const matched = personaKeywords
			.split('|')
			.filter((k) => taskText.includes(k.trim()));
		if (matched.length > 0) {
			reasons.push(`Contains keywords: ${matched.join(', ')}`);
		}
	}

	// Check task patterns
	const taskPattern = Object.entries(activationPatterns.taskTypePatterns).find(
		([pattern, p]) => p === persona && new RegExp(pattern, 'i').test(taskText)
	)?.[0];

	if (taskPattern) {
		reasons.push(`Matches pattern: ${taskPattern.replace(/\\/g, '')}`);
	}

	// Add persona-specific reasons
	const personaSpecific = {
		architect: task.dependencies?.length > 0 ? 'Has dependencies' : null,
		qa: task.testStrategy ? 'Has test strategy defined' : null,
		security: taskText.includes('auth') ? 'Authentication task' : null
	};

	if (personaSpecific[persona]) {
		reasons.push(personaSpecific[persona]);
	}

	return reasons.filter(Boolean);
}

/**
 * Suggest a default persona based on task characteristics
 */
function suggestDefaultPersona(task) {
	if (task.testStrategy) return 'qa';
	if (task.dependencies?.length > 2) return 'architect';
	if (task.title.toLowerCase().includes('fix')) return 'analyzer';
	if (task.title.toLowerCase().includes('implement')) return 'backend';
	return 'architect'; // Default to architect for general tasks
}

/**
 * Detect multiple personas for complex workflows
 */
export function detectMultiPersonaWorkflow(tasks) {
	const taskTypes = new Set();

	for (const task of tasks) {
		const taskText = task.title.toLowerCase();

		if (taskText.includes('ui') || taskText.includes('component')) {
			taskTypes.add('frontend');
		}
		if (taskText.includes('api') || taskText.includes('backend')) {
			taskTypes.add('backend');
		}
		if (taskText.includes('test')) {
			taskTypes.add('qa');
		}
		if (taskText.includes('security') || taskText.includes('auth')) {
			taskTypes.add('security');
		}
	}

	// Suggest workflows based on task diversity
	if (taskTypes.has('frontend') && taskTypes.has('backend')) {
		return {
			workflow: 'fullstack',
			personas: ['architect', 'backend', 'frontend', 'qa'],
			reason: 'Full-stack implementation detected'
		};
	}

	if (taskTypes.has('security')) {
		return {
			workflow: 'secure-development',
			personas: ['architect', 'security', 'qa'],
			reason: 'Security-critical implementation'
		};
	}

	if (taskTypes.size > 2) {
		return {
			workflow: 'comprehensive',
			personas: ['architect', 'backend', 'frontend', 'security', 'qa'],
			reason: 'Complex multi-faceted implementation'
		};
	}

	return null;
}
