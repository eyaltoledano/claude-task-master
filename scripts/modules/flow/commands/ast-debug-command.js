/**
 * AST Debug CLI Commands - Phase 4.3
 *
 * CLI commands for debugging AST parsing issues.
 * Self-contained under @/flow architecture.
 *
 * Commands:
 * - ast:debug <file> - Debug specific file parsing
 * - ast:validate <file> - Validate AST output
 * - ast:diagnose [dir] - Run diagnostics on directory
 * - ast:stats - Show debug statistics
 *
 * @author Task Master Flow
 * @version 4.3.0
 */

import { createASTDebugTools } from '../ast/error-handling/debug-tools.js';
import { createASTValidator } from '../ast/error-handling/validation.js';
import { createErrorRecovery } from '../ast/error-handling/error-recovery.js';
import { createParserFallbacks } from '../ast/error-handling/parser-fallbacks.js';
import { JavaScriptParser } from '../ast/parsers/javascript-parser.js';
import { PythonParser } from '../ast/parsers/python-parser.js';
import { GoParser } from '../ast/parsers/go-parser.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * AST Debug Command Manager
 */
export class ASTDebugCommand {
	constructor() {
		this.debugTools = createASTDebugTools({
			enableConsoleOutput: true,
			enableFileOutput: true,
			verboseMode: false
		});

		this.validator = createASTValidator({
			enableStructureValidation: true,
			enableContentValidation: true,
			enableConsistencyChecks: true
		});

		this.errorRecovery = createErrorRecovery({
			enableAutoFix: true,
			enablePartialParsing: true,
			enableSyntaxRepair: true
		});

		this.parserFallbacks = createParserFallbacks({
			enableRegexFallback: true,
			enableContentAnalysis: true,
			enableStructureGuessing: true
		});

		// Initialize parsers
		this.parsers = {
			javascript: new JavaScriptParser(),
			typescript: new JavaScriptParser(), // Same parser for TS
			python: new PythonParser(),
			go: new GoParser()
		};
	}

	/**
	 * Debug specific file parsing
	 */
	async debugFile(filePath, options = {}) {
		try {
			console.log(`🔍 Debugging AST parsing for: ${filePath}`);

			// Check if file exists
			if (!fs.existsSync(filePath)) {
				throw new Error(`File not found: ${filePath}`);
			}

			// Read file content
			const content = await fs.promises.readFile(filePath, 'utf8');
			const language = this.detectLanguage(filePath);
			const parser = this.parsers[language];

			console.log(`📝 Language detected: ${language}`);
			console.log(
				`📊 File size: ${content.length} bytes, ${content.split('\n').length} lines`
			);

			if (!parser) {
				console.log(
					`⚠️  No parser available for ${language}, using fallback analysis`
				);
				return await this.runFallbackAnalysis(filePath, content, language);
			}

			// Attempt parsing with error handling
			try {
				const result = await parser.parse(filePath, content);
				console.log(`✅ Parsing successful!`);

				// Validate the result
				const validation = await this.validator.validateAST(
					result,
					filePath,
					content,
					language
				);
				this.displayValidationResults(validation);

				return {
					success: true,
					result,
					validation
				};
			} catch (parseError) {
				console.log(`❌ Parsing failed: ${parseError.message}`);

				// Run comprehensive debugging
				const debugResult = await this.debugTools.debugParsingFailure(
					parseError,
					filePath,
					content,
					language,
					options
				);

				// Attempt error recovery
				const recoveryResult = await this.errorRecovery.recoverFromError(
					parseError,
					filePath,
					content,
					language
				);

				console.log(
					`\n🔧 Recovery attempt: ${recoveryResult.success ? 'Success' : 'Failed'}`
				);
				if (recoveryResult.success && recoveryResult.strategy) {
					console.log(`📋 Recovery strategy: ${recoveryResult.strategy}`);
				}

				// Try fallback parsing
				const fallbackResult = await this.parserFallbacks.parseWithFallbacks(
					filePath,
					content,
					language,
					parser
				);

				console.log(
					`\n🔄 Fallback parsing: ${fallbackResult.success ? 'Success' : 'Failed'}`
				);
				if (fallbackResult.fromFallback) {
					console.log(`📋 Fallback strategy: ${fallbackResult.strategy}`);
				}

				return {
					success: false,
					error: parseError,
					debug: debugResult,
					recovery: recoveryResult,
					fallback: fallbackResult
				};
			}
		} catch (error) {
			console.error(`💥 Debug operation failed: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Validate AST output from file
	 */
	async validateFile(filePath, options = {}) {
		try {
			console.log(`✅ Validating AST output for: ${filePath}`);

			const content = await fs.promises.readFile(filePath, 'utf8');
			const language = this.detectLanguage(filePath);
			const parser = this.parsers[language];

			if (!parser) {
				console.log(`⚠️  No parser available for ${language}`);
				return { success: false, error: 'No parser available' };
			}

			// Parse the file
			const result = await parser.parse(filePath, content);

			// Validate the result
			const validation = await this.validator.validateAST(
				result,
				filePath,
				content,
				language
			);

			this.displayValidationResults(validation, true);

			return {
				success: true,
				result,
				validation
			};
		} catch (error) {
			console.log(`❌ Validation failed: ${error.message}`);

			// Run quick validation on error
			const quickValidation = await this.validator.quickValidate({});
			this.displayValidationResults(quickValidation, true);

			return {
				success: false,
				error: error.message,
				validation: quickValidation
			};
		}
	}

	/**
	 * Run diagnostics on directory
	 */
	async diagnoseDirectory(dirPath = '.', options = {}) {
		try {
			console.log(`🔍 Running AST diagnostics on: ${dirPath}`);

			const files = await this.findCodeFiles(
				dirPath,
				options.recursive !== false
			);
			console.log(`📁 Found ${files.length} code files`);

			const results = {
				totalFiles: files.length,
				successful: 0,
				failed: 0,
				warnings: 0,
				errors: [],
				summary: {}
			};

			for (const file of files.slice(0, options.maxFiles || 50)) {
				try {
					console.log(`\n📄 Analyzing: ${file}`);

					const debugResult = await this.debugTools.runDiagnostic(file);

					if (debugResult.success) {
						results.successful++;

						if (debugResult.issues.length > 0) {
							results.warnings++;
							console.log(`  ⚠️  ${debugResult.issues.length} issues found`);
						} else {
							console.log(`  ✅ No issues`);
						}
					} else {
						results.failed++;
						results.errors.push({
							file,
							error: debugResult.error
						});
						console.log(`  ❌ Failed to analyze`);
					}
				} catch (error) {
					results.failed++;
					results.errors.push({
						file,
						error: error.message
					});
					console.log(`  💥 Error: ${error.message}`);
				}
			}

			// Display summary
			this.displayDiagnosticSummary(results);

			return results;
		} catch (error) {
			console.error(`💥 Diagnostic operation failed: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Show debug statistics
	 */
	async showStats() {
		console.log(`📊 AST Debug Statistics\n`);

		// Debug tools stats
		const debugStats = this.debugTools.getStatistics();
		console.log(`🔍 Debug Tools:`);
		console.log(`  Total debugs: ${debugStats.totalDebugs}`);
		console.log(`  Issues found: ${debugStats.issuesFound}`);
		console.log(`  Files analyzed: ${debugStats.filesAnalyzed}`);
		console.log(
			`  Avg issues per file: ${debugStats.averageIssuesPerFile.toFixed(2)}`
		);

		if (Object.keys(debugStats.errorPatterns).length > 0) {
			console.log(`  Error patterns:`);
			for (const [type, count] of Object.entries(debugStats.errorPatterns)) {
				console.log(`    ${type}: ${count}`);
			}
		}

		// Validator stats
		const validatorStats = this.validator.getStatistics();
		console.log(`\n✅ Validator:`);
		console.log(`  Total validations: ${validatorStats.totalValidations}`);
		console.log(`  Success rate: ${validatorStats.successRate.toFixed(1)}%`);
		console.log(
			`  Average confidence: ${validatorStats.averageConfidence.toFixed(2)}`
		);
		console.log(
			`  Avg validation time: ${validatorStats.averageValidationTime.toFixed(1)}ms`
		);

		// Error recovery stats
		const recoveryStats = this.errorRecovery.getStatistics();
		console.log(`\n🔧 Error Recovery:`);
		console.log(`  Total errors: ${recoveryStats.totalErrors}`);
		console.log(`  Recovery rate: ${recoveryStats.recoveryRate.toFixed(1)}%`);
		console.log(`  Auto-fix rate: ${recoveryStats.autoFixRate.toFixed(1)}%`);
		console.log(
			`  Avg recovery time: ${recoveryStats.averageRecoveryTime.toFixed(1)}ms`
		);

		// Parser fallbacks stats
		const fallbackStats = this.parserFallbacks.getStatistics();
		console.log(`\n🔄 Parser Fallbacks:`);
		console.log(`  Fallback attempts: ${fallbackStats.fallbackAttempts}`);
		console.log(`  Successful fallbacks: ${fallbackStats.successfulFallbacks}`);
		console.log(`  Cache size: ${fallbackStats.cacheSize}`);
		console.log(
			`  Avg fallback time: ${fallbackStats.averageFallbackTime.toFixed(1)}ms`
		);

		return {
			debugTools: debugStats,
			validator: validatorStats,
			errorRecovery: recoveryStats,
			parserFallbacks: fallbackStats
		};
	}

	/**
	 * Reset all statistics
	 */
	resetStats() {
		this.debugTools.resetSession();
		this.validator.resetStatistics();
		this.errorRecovery.resetStatistics();
		this.parserFallbacks.clearCache();

		console.log(`🔄 All statistics have been reset`);
	}

	/**
	 * Helper methods
	 */
	detectLanguage(filePath) {
		const ext = path.extname(filePath).toLowerCase();

		switch (ext) {
			case '.js':
			case '.jsx':
				return 'javascript';
			case '.ts':
			case '.tsx':
				return 'typescript';
			case '.py':
				return 'python';
			case '.go':
				return 'go';
			default:
				return 'unknown';
		}
	}

	async findCodeFiles(dirPath, recursive = true) {
		const files = [];
		const supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.go'];

		const processDirectory = async (currentDir) => {
			try {
				const entries = await fs.promises.readdir(currentDir, {
					withFileTypes: true
				});

				for (const entry of entries) {
					const fullPath = path.join(currentDir, entry.name);

					if (entry.isDirectory()) {
						// Skip common directories to ignore
						if (
							![
								'node_modules',
								'.git',
								'dist',
								'build',
								'__pycache__'
							].includes(entry.name) &&
							recursive
						) {
							await processDirectory(fullPath);
						}
					} else if (entry.isFile()) {
						const ext = path.extname(entry.name).toLowerCase();
						if (supportedExtensions.includes(ext)) {
							files.push(fullPath);
						}
					}
				}
			} catch (error) {
				console.warn(
					`⚠️  Cannot read directory ${currentDir}: ${error.message}`
				);
			}
		};

		await processDirectory(dirPath);
		return files;
	}

	async runFallbackAnalysis(filePath, content, language) {
		console.log(`🔄 Running fallback analysis...`);

		// Simulate a parsing error for fallback testing
		const simulatedError = new Error('No parser available');

		const fallbackResult = await this.parserFallbacks.parseWithFallbacks(
			filePath,
			content,
			language,
			null
		);

		if (fallbackResult.success) {
			console.log(`✅ Fallback analysis successful`);
			console.log(`📋 Strategy: ${fallbackResult.strategy}`);
			console.log(
				`🔍 Found ${fallbackResult.functions.length} functions, ${fallbackResult.classes.length} classes`
			);
		} else {
			console.log(`❌ Fallback analysis failed`);
		}

		return {
			success: fallbackResult.success,
			fallback: fallbackResult
		};
	}

	displayValidationResults(validation, detailed = false) {
		console.log(`\n📋 Validation Results:`);
		console.log(`  Valid: ${validation.isValid ? '✅' : '❌'}`);
		console.log(`  Confidence: ${(validation.confidence * 100).toFixed(1)}%`);

		if (validation.errors && validation.errors.length > 0) {
			console.log(`  ❌ Errors (${validation.errors.length}):`);
			validation.errors.forEach((error, i) => {
				console.log(`    ${i + 1}. ${error}`);
			});
		}

		if (validation.warnings && validation.warnings.length > 0) {
			console.log(`  ⚠️  Warnings (${validation.warnings.length}):`);
			validation.warnings.forEach((warning, i) => {
				console.log(`    ${i + 1}. ${warning}`);
			});
		}

		if (detailed && validation.checks) {
			console.log(`\n🔍 Detailed Checks:`);
			for (const [checkName, checkResult] of Object.entries(
				validation.checks
			)) {
				console.log(
					`  ${checkName}: ${checkResult.isValid ? '✅' : '❌'} (${(checkResult.confidence * 100).toFixed(1)}%)`
				);
			}
		}
	}

	displayDiagnosticSummary(results) {
		console.log(`\n📊 Diagnostic Summary:`);
		console.log(`  📁 Total files: ${results.totalFiles}`);
		console.log(`  ✅ Successful: ${results.successful}`);
		console.log(`  ❌ Failed: ${results.failed}`);
		console.log(`  ⚠️  With warnings: ${results.warnings}`);

		if (results.errors.length > 0) {
			console.log(`\n💥 Errors:`);
			results.errors.slice(0, 5).forEach((error, i) => {
				console.log(`  ${i + 1}. ${path.basename(error.file)}: ${error.error}`);
			});

			if (results.errors.length > 5) {
				console.log(`  ... and ${results.errors.length - 5} more errors`);
			}
		}

		// Success rate
		const successRate =
			results.totalFiles > 0
				? (results.successful / results.totalFiles) * 100
				: 0;
		console.log(`\n📈 Success rate: ${successRate.toFixed(1)}%`);
	}
}

/**
 * Factory function for creating AST debug command
 */
export function createASTDebugCommand() {
	return new ASTDebugCommand();
}

export default ASTDebugCommand;
