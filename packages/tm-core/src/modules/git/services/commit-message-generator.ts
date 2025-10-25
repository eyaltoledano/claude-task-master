/**
 * CommitMessageGenerator - Generate conventional commit messages with metadata
 *
 * Combines TemplateEngine and ScopeDetector to create structured commit messages
 * that follow conventional commits specification and include task metadata.
 */

import { TemplateEngine } from './template-engine.js';
import { ScopeDetector } from './scope-detector.js';

export interface CommitMessageOptions {
	type: string;
	description: string;
	changedFiles: string[];
	scope?: string;
	body?: string;
	breaking?: boolean;
	taskId?: string;
	phase?: string;
	tag?: string;
	testsPassing?: number;
	testsFailing?: number;
	coveragePercent?: number;
}

export interface ValidationResult {
	isValid: boolean;
	errors: string[];
}

export interface ParsedCommitMessage {
	type: string;
	scope?: string;
	breaking: boolean;
	description: string;
	body?: string;
}

const CONVENTIONAL_COMMIT_TYPES = [
	'feat',
	'fix',
	'docs',
	'style',
	'refactor',
	'perf',
	'test',
	'build',
	'ci',
	'chore',
	'revert'
];

export class CommitMessageGenerator {
	private templateEngine: TemplateEngine;
	private scopeDetector: ScopeDetector;

	constructor(
		customTemplates?: Record<string, string>,
		customScopeMappings?: Record<string, string>,
		customScopePriorities?: Record<string, number>
	) {
		this.templateEngine = new TemplateEngine(customTemplates);
		this.scopeDetector = new ScopeDetector(
			customScopeMappings,
			customScopePriorities
		);
	}

	/**
	 * Generate a conventional commit message with metadata
	 */
	generateMessage(options: CommitMessageOptions): string {
		const {
			type,
			description,
			changedFiles,
			scope: manualScope,
			body,
			breaking = false,
			taskId,
			phase,
			tag,
			testsPassing,
			testsFailing,
			coveragePercent
		} = options;

		// Determine scope (manual override or auto-detect)
		const scope = manualScope ?? this.scopeDetector.detectScope(changedFiles);

		// Build template variables
		const variables = {
			type,
			scope,
			breaking: breaking ? '!' : '',
			description,
			body,
			taskId,
			phase,
			tag,
			testsPassing,
			testsFailing,
			coveragePercent
		};

		// Generate message from template
		return this.templateEngine.render('commitMessage', variables);
	}

	/**
	 * Validate that a commit message follows conventional commits format
	 */
	validateConventionalCommit(message: string): ValidationResult {
		const errors: string[] = [];

		// Parse first line (header)
		const lines = message.split('\n');
		const header = lines[0];

		if (!header) {
			errors.push('Missing commit message');
			return { isValid: false, errors };
		}

		// Check format: type(scope)?: description
		const headerRegex = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;
		const match = header.match(headerRegex);

		if (!match) {
			errors.push(
				'Invalid conventional commit format. Expected: type(scope): description'
			);
			return { isValid: false, errors };
		}

		const [, type, , , description] = match;

		// Validate type
		if (!CONVENTIONAL_COMMIT_TYPES.includes(type)) {
			errors.push(
				`Invalid commit type "${type}". Must be one of: ${CONVENTIONAL_COMMIT_TYPES.join(', ')}`
			);
		}

		// Validate description
		if (!description || description.trim().length === 0) {
			errors.push('Missing description');
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	/**
	 * Parse a conventional commit message into its components
	 */
	parseCommitMessage(message: string): ParsedCommitMessage {
		const lines = message.split('\n');
		const header = lines[0];

		// Parse header: type(scope)!: description
		const headerRegex = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;
		const match = header.match(headerRegex);

		if (!match) {
			throw new Error('Invalid conventional commit format');
		}

		const [, type, scope, breaking, description] = match;

		// Body is everything after the first blank line
		const bodyStartIndex = lines.findIndex((line, i) => i > 0 && line === '');
		const body =
			bodyStartIndex !== -1
				? lines
						.slice(bodyStartIndex + 1)
						.join('\n')
						.trim()
				: undefined;

		return {
			type,
			scope,
			breaking: breaking === '!',
			description,
			body
		};
	}

	/**
	 * Get the scope detector instance (for testing/customization)
	 */
	getScopeDetector(): ScopeDetector {
		return this.scopeDetector;
	}

	/**
	 * Get the template engine instance (for testing/customization)
	 */
	getTemplateEngine(): TemplateEngine {
		return this.templateEngine;
	}
}
