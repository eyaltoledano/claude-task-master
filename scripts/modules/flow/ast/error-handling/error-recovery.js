/**
 * Error Recovery - Phase 4.3
 *
 * Fast, simple error recovery mechanisms for AST parsing failures.
 * Prioritizes speed and development workflow over production robustness.
 *
 * Key Features:
 * - Quick error diagnosis and recovery suggestions
 * - Automatic syntax error repair for common issues
 * - Development-friendly error reporting
 * - Fast partial parsing recovery
 *
 * @author Task Master Flow
 * @version 4.3.0
 */

import { EventEmitter } from 'events';

/**
 * Error Recovery System
 *
 * Provides intelligent error recovery when AST parsing encounters errors.
 * Optimized for speed and development workflow.
 */
export class ErrorRecovery extends EventEmitter {
	constructor(options = {}) {
		super();

		this.config = {
			enableAutoFix: true,
			enablePartialParsing: true,
			enableSyntaxRepair: true,
			maxRecoveryTime: 50, // 50ms max for recovery attempts
			maxAutoFixAttempts: 3,
			...options
		};

		// Recovery statistics
		this.stats = {
			totalErrors: 0,
			recoveredErrors: 0,
			autoFixedErrors: 0,
			partiallyParsed: 0,
			fastestRecovery: Infinity,
			slowestRecovery: 0
		};

		// Common error patterns and fixes
		this.errorPatterns = this.initializeErrorPatterns();

		console.log(
			'ErrorRecovery initialized for fast development error handling'
		);
	}

	/**
	 * Attempt to recover from parsing error
	 */
	async recoverFromError(error, filePath, content, language) {
		const startTime = Date.now();
		this.stats.totalErrors++;

		try {
			// Quick error classification
			const errorType = this.classifyError(error, content);

			// Try recovery strategies based on error type
			const recovery = await this.attemptRecovery(
				errorType,
				error,
				filePath,
				content,
				language
			);

			if (recovery.success) {
				this.stats.recoveredErrors++;
				const duration = Date.now() - startTime;
				this.stats.fastestRecovery = Math.min(
					this.stats.fastestRecovery,
					duration
				);
				this.stats.slowestRecovery = Math.max(
					this.stats.slowestRecovery,
					duration
				);

				this.emit('recovery', {
					filePath,
					errorType,
					strategy: recovery.strategy,
					duration
				});
			}

			return recovery;
		} catch (recoveryError) {
			return {
				success: false,
				error: recoveryError.message,
				strategy: 'failed',
				suggestions: [
					'Check file syntax manually',
					'Try basic text analysis instead'
				]
			};
		}
	}

	/**
	 * Classify error type for targeted recovery
	 */
	classifyError(error, content) {
		const errorMessage = error.message.toLowerCase();

		// Syntax errors
		if (
			errorMessage.includes('unexpected') ||
			errorMessage.includes('syntax')
		) {
			return this.classifySyntaxError(errorMessage, content);
		}

		// Parse errors
		if (errorMessage.includes('parse') || errorMessage.includes('parsing')) {
			return 'parse_error';
		}

		// Encoding errors
		if (
			errorMessage.includes('encoding') ||
			errorMessage.includes('character')
		) {
			return 'encoding_error';
		}

		// Memory/size errors
		if (
			errorMessage.includes('memory') ||
			errorMessage.includes('size') ||
			errorMessage.includes('limit')
		) {
			return 'resource_error';
		}

		// Timeout errors
		if (errorMessage.includes('timeout') || errorMessage.includes('time')) {
			return 'timeout_error';
		}

		return 'unknown_error';
	}

	/**
	 * Classify specific syntax error types
	 */
	classifySyntaxError(errorMessage, content) {
		if (errorMessage.includes('bracket') || errorMessage.includes('brace')) {
			return 'bracket_mismatch';
		}

		if (errorMessage.includes('semicolon') || errorMessage.includes(';')) {
			return 'missing_semicolon';
		}

		if (
			errorMessage.includes('quote') ||
			errorMessage.includes('"') ||
			errorMessage.includes("'")
		) {
			return 'quote_mismatch';
		}

		if (errorMessage.includes('paren')) {
			return 'paren_mismatch';
		}

		if (errorMessage.includes('token')) {
			return 'unexpected_token';
		}

		return 'general_syntax';
	}

	/**
	 * Attempt recovery based on error type
	 */
	async attemptRecovery(errorType, error, filePath, content, language) {
		const strategies = this.getRecoveryStrategies(errorType);

		for (const strategy of strategies) {
			try {
				const result = await Promise.race([
					strategy.fn(error, filePath, content, language),
					this.timeout(this.config.maxRecoveryTime)
				]);

				if (result.success) {
					return {
						...result,
						strategy: strategy.name
					};
				}
			} catch (strategyError) {
				console.warn(
					`Recovery strategy '${strategy.name}' failed:`,
					strategyError.message
				);
			}
		}

		// All strategies failed
		return {
			success: false,
			error: error.message,
			strategy: 'none',
			suggestions: this.getManualSuggestions(errorType, error)
		};
	}

	/**
	 * Get recovery strategies for error type
	 */
	getRecoveryStrategies(errorType) {
		const strategies = [];

		switch (errorType) {
			case 'bracket_mismatch':
				strategies.push(
					{ name: 'auto_fix_brackets', fn: this.autoFixBrackets.bind(this) },
					{
						name: 'partial_parse_sections',
						fn: this.partialParseSections.bind(this)
					}
				);
				break;

			case 'quote_mismatch':
				strategies.push(
					{ name: 'auto_fix_quotes', fn: this.autoFixQuotes.bind(this) },
					{ name: 'escape_quotes', fn: this.escapeQuotes.bind(this) }
				);
				break;

			case 'missing_semicolon':
				strategies.push({
					name: 'add_semicolons',
					fn: this.addSemicolons.bind(this)
				});
				break;

			case 'encoding_error':
				strategies.push({
					name: 'fix_encoding',
					fn: this.fixEncoding.bind(this)
				});
				break;

			case 'resource_error':
				strategies.push(
					{ name: 'reduce_content', fn: this.reduceContent.bind(this) },
					{ name: 'chunked_parsing', fn: this.chunkedParsing.bind(this) }
				);
				break;

			case 'timeout_error':
				strategies.push({
					name: 'fast_minimal_parse',
					fn: this.fastMinimalParse.bind(this)
				});
				break;

			default:
				strategies.push(
					{
						name: 'partial_parse_lines',
						fn: this.partialParseLines.bind(this)
					},
					{ name: 'structural_guess', fn: this.structuralGuess.bind(this) }
				);
		}

		return strategies;
	}

	/**
	 * Auto-fix bracket mismatches
	 */
	async autoFixBrackets(error, filePath, content, language) {
		if (!this.config.enableAutoFix) {
			return { success: false, reason: 'auto-fix disabled' };
		}

		let fixedContent = content;
		let attempts = 0;

		// Count brackets
		const openBrackets = (content.match(/\{/g) || []).length;
		const closeBrackets = (content.match(/\}/g) || []).length;

		if (openBrackets > closeBrackets) {
			// Add missing closing brackets
			const missing = openBrackets - closeBrackets;
			fixedContent += '\n' + '}'.repeat(missing);
			attempts++;
		} else if (closeBrackets > openBrackets) {
			// Remove extra closing brackets (simple approach)
			const extra = closeBrackets - openBrackets;
			for (let i = 0; i < extra; i++) {
				const lastBrace = fixedContent.lastIndexOf('}');
				if (lastBrace !== -1) {
					fixedContent =
						fixedContent.slice(0, lastBrace) +
						fixedContent.slice(lastBrace + 1);
				}
			}
			attempts++;
		}

		if (attempts > 0) {
			this.stats.autoFixedErrors++;
			return {
				success: true,
				fixedContent,
				changes: [`Fixed ${attempts} bracket mismatch(es)`],
				confidence: 0.7
			};
		}

		return { success: false, reason: 'no bracket issues detected' };
	}

	/**
	 * Auto-fix quote mismatches
	 */
	async autoFixQuotes(error, filePath, content, language) {
		if (!this.config.enableAutoFix) {
			return { success: false, reason: 'auto-fix disabled' };
		}

		let fixedContent = content;
		const changes = [];

		// Find and fix unmatched quotes (simple heuristic)
		const lines = content.split('\n');
		const fixedLines = lines.map((line, index) => {
			const singleQuotes = (line.match(/'/g) || []).length;
			const doubleQuotes = (line.match(/"/g) || []).length;

			// If odd number of quotes, try to close them
			if (singleQuotes % 2 === 1) {
				line += "'";
				changes.push(`Line ${index + 1}: Added closing single quote`);
			}

			if (doubleQuotes % 2 === 1) {
				line += '"';
				changes.push(`Line ${index + 1}: Added closing double quote`);
			}

			return line;
		});

		if (changes.length > 0) {
			this.stats.autoFixedErrors++;
			return {
				success: true,
				fixedContent: fixedLines.join('\n'),
				changes,
				confidence: 0.6
			};
		}

		return { success: false, reason: 'no quote issues detected' };
	}

	/**
	 * Add missing semicolons
	 */
	async addSemicolons(error, filePath, content, language) {
		if (!this.config.enableAutoFix || language.toLowerCase() !== 'javascript') {
			return { success: false, reason: 'not applicable for this language' };
		}

		const lines = content.split('\n');
		const changes = [];

		const fixedLines = lines.map((line, index) => {
			const trimmed = line.trim();

			// Add semicolons to common statement patterns
			if (
				trimmed &&
				!trimmed.endsWith(';') &&
				!trimmed.endsWith('{') &&
				!trimmed.endsWith('}') &&
				!trimmed.startsWith('//') &&
				!trimmed.startsWith('/*') &&
				(trimmed.match(/^(const|let|var|return|throw|break|continue)/) ||
					trimmed.match(/\w+\([^)]*\)$/) ||
					trimmed.match(/\w+\.\w+/))
			) {
				changes.push(`Line ${index + 1}: Added semicolon`);
				return line + ';';
			}

			return line;
		});

		if (changes.length > 0) {
			this.stats.autoFixedErrors++;
			return {
				success: true,
				fixedContent: fixedLines.join('\n'),
				changes,
				confidence: 0.8
			};
		}

		return { success: false, reason: 'no semicolon issues detected' };
	}

	/**
	 * Fix encoding issues
	 */
	async fixEncoding(error, filePath, content, language) {
		try {
			// Remove non-ASCII characters
			const fixedContent = content.replace(/[^\x00-\x7F]/g, '?');

			if (fixedContent !== content) {
				return {
					success: true,
					fixedContent,
					changes: ['Replaced non-ASCII characters with ?'],
					confidence: 0.5
				};
			}

			return { success: false, reason: 'no encoding issues detected' };
		} catch (fixError) {
			return { success: false, reason: fixError.message };
		}
	}

	/**
	 * Reduce content size for large files
	 */
	async reduceContent(error, filePath, content, language) {
		if (content.length < 100000) {
			return { success: false, reason: 'file not too large' };
		}

		// Take first 50% of content
		const reducedContent = content.slice(0, Math.floor(content.length / 2));

		return {
			success: true,
			reducedContent,
			changes: [
				`Reduced content size from ${content.length} to ${reducedContent.length} characters`
			],
			confidence: 0.3
		};
	}

	/**
	 * Parse content in chunks
	 */
	async chunkedParsing(error, filePath, content, language) {
		const chunkSize = 10000;
		const chunks = [];

		for (let i = 0; i < content.length; i += chunkSize) {
			chunks.push(content.slice(i, i + chunkSize));
		}

		return {
			success: true,
			chunks,
			changes: [`Split content into ${chunks.length} chunks`],
			confidence: 0.4
		};
	}

	/**
	 * Fast minimal parsing
	 */
	async fastMinimalParse(error, filePath, content, language) {
		// Very basic structure detection
		const lines = content.split('\n');
		const structure = {
			totalLines: lines.length,
			codeLines: lines.filter((line) => line.trim()).length,
			commentLines: lines.filter((line) => line.trim().startsWith('//')).length
		};

		return {
			success: true,
			structure,
			changes: ['Performed minimal structure analysis'],
			confidence: 0.2
		};
	}

	/**
	 * Parse sections separately
	 */
	async partialParseSections(error, filePath, content, language) {
		if (!this.config.enablePartialParsing) {
			return { success: false, reason: 'partial parsing disabled' };
		}

		const sections = this.splitIntoSections(content, language);
		const validSections = [];

		for (const section of sections) {
			if (section.trim().length > 10) {
				validSections.push({
					content: section,
					lineStart: this.getLineNumber(content, content.indexOf(section))
				});
			}
		}

		if (validSections.length > 0) {
			this.stats.partiallyParsed++;
			return {
				success: true,
				sections: validSections,
				changes: [`Split into ${validSections.length} parseable sections`],
				confidence: 0.6
			};
		}

		return { success: false, reason: 'no valid sections found' };
	}

	/**
	 * Parse lines individually
	 */
	async partialParseLines(error, filePath, content, language) {
		const lines = content.split('\n');
		const validLines = lines
			.map((line, index) => ({ content: line.trim(), lineNumber: index + 1 }))
			.filter(
				(item) => item.content.length > 0 && !item.content.startsWith('//')
			);

		return {
			success: true,
			lines: validLines,
			changes: [`Extracted ${validLines.length} valid lines`],
			confidence: 0.3
		};
	}

	/**
	 * Structural guessing
	 */
	async structuralGuess(error, filePath, content, language) {
		const guess = {
			hasClasses: /class\s+\w+/.test(content),
			hasFunctions: /(function|def|func)\s+\w+/.test(content),
			hasImports: /(import|from|#include)/.test(content),
			estimatedComplexity: Math.min(
				10,
				Math.max(1, content.split('\n').length / 100)
			)
		};

		return {
			success: true,
			guess,
			changes: ['Generated structural guess'],
			confidence: 0.2
		};
	}

	/**
	 * Split content into logical sections
	 */
	splitIntoSections(content, language) {
		switch (language.toLowerCase()) {
			case 'javascript':
			case 'typescript':
				return content.split(
					/(?=(?:class|function|const\s+\w+\s*=\s*(?:function|\([^)]*\)\s*=>)))/
				);

			case 'python':
				return content.split(/(?=(?:class|def)\s+\w+)/);

			case 'go':
				return content.split(/(?=(?:func|type)\s+\w+)/);

			default:
				// Split by double newlines
				return content.split(/\n\s*\n/);
		}
	}

	/**
	 * Get manual suggestions for error type
	 */
	getManualSuggestions(errorType, error) {
		const suggestions = {
			bracket_mismatch: [
				'Check for missing or extra braces {}',
				'Verify function and class closures',
				'Use an IDE with bracket matching'
			],
			quote_mismatch: [
				'Check for unmatched quotes',
				'Escape quotes in strings',
				'Use consistent quote style'
			],
			missing_semicolon: [
				'Add semicolons at line ends',
				'Enable automatic semicolon insertion',
				'Use a linter like ESLint'
			],
			encoding_error: [
				'Check file encoding (should be UTF-8)',
				'Remove special characters',
				'Re-save file with correct encoding'
			],
			resource_error: [
				'File may be too large',
				'Try parsing smaller sections',
				'Increase memory limits'
			],
			timeout_error: [
				'File complexity is too high',
				'Simplify code structure',
				'Use partial parsing'
			],
			unknown_error: [
				'Check file syntax manually',
				'Try a different parser',
				'Verify file is valid code'
			]
		};

		return suggestions[errorType] || suggestions.unknown_error;
	}

	/**
	 * Initialize common error patterns
	 */
	initializeErrorPatterns() {
		return {
			bracketMismatch: /(?:unexpected|missing).*(?:bracket|brace|\}|\{)/i,
			quoteMismatch: /(?:unexpected|unterminated).*(?:string|quote)/i,
			semicolonMissing: /missing.*semicolon/i,
			syntaxError: /syntax.*error/i,
			parseError: /parse.*error/i
		};
	}

	/**
	 * Helper methods
	 */
	getLineNumber(content, index) {
		return content.substring(0, index).split('\n').length;
	}

	timeout(ms) {
		return new Promise((_, reject) =>
			setTimeout(() => reject(new Error('Recovery timeout')), ms)
		);
	}

	/**
	 * Get recovery statistics
	 */
	getStatistics() {
		return {
			...this.stats,
			recoveryRate:
				this.stats.totalErrors > 0
					? (this.stats.recoveredErrors / this.stats.totalErrors) * 100
					: 0,
			autoFixRate:
				this.stats.totalErrors > 0
					? (this.stats.autoFixedErrors / this.stats.totalErrors) * 100
					: 0,
			averageRecoveryTime:
				this.stats.recoveredErrors > 0
					? (this.stats.slowestRecovery + this.stats.fastestRecovery) / 2
					: 0
		};
	}

	/**
	 * Reset statistics
	 */
	resetStatistics() {
		this.stats = {
			totalErrors: 0,
			recoveredErrors: 0,
			autoFixedErrors: 0,
			partiallyParsed: 0,
			fastestRecovery: Infinity,
			slowestRecovery: 0
		};
	}
}

/**
 * Factory function for creating error recovery
 */
export function createErrorRecovery(options = {}) {
	return new ErrorRecovery(options);
}

export default ErrorRecovery;
