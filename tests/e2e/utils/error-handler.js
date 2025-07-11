import { writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

export class ErrorHandler {
	constructor(logger) {
		this.logger = logger;
		this.errors = [];
		this.warnings = [];
	}

	/**
	 * Handle and categorize errors
	 */
	handleError(error, context = {}) {
		const errorInfo = {
			timestamp: new Date().toISOString(),
			message: error.message || 'Unknown error',
			stack: error.stack,
			context,
			type: this.categorizeError(error)
		};

		this.errors.push(errorInfo);
		this.logger.error(`[${errorInfo.type}] ${errorInfo.message}`);

		if (context.critical) {
			throw error;
		}

		return errorInfo;
	}

	/**
	 * Add a warning
	 */
	addWarning(message, context = {}) {
		const warning = {
			timestamp: new Date().toISOString(),
			message,
			context
		};

		this.warnings.push(warning);
		this.logger.warning(message);
	}

	/**
	 * Categorize error types
	 */
	categorizeError(error) {
		const message = error.message.toLowerCase();

		if (
			message.includes('command not found') ||
			message.includes('not found')
		) {
			return 'DEPENDENCY_ERROR';
		}
		if (message.includes('permission') || message.includes('access denied')) {
			return 'PERMISSION_ERROR';
		}
		if (message.includes('timeout')) {
			return 'TIMEOUT_ERROR';
		}
		if (message.includes('api') || message.includes('rate limit')) {
			return 'API_ERROR';
		}
		if (message.includes('json') || message.includes('parse')) {
			return 'PARSE_ERROR';
		}
		if (message.includes('file') || message.includes('directory')) {
			return 'FILE_ERROR';
		}

		return 'GENERAL_ERROR';
	}

	/**
	 * Get error summary
	 */
	getSummary() {
		const errorsByType = {};

		this.errors.forEach((error) => {
			if (!errorsByType[error.type]) {
				errorsByType[error.type] = [];
			}
			errorsByType[error.type].push(error);
		});

		return {
			totalErrors: this.errors.length,
			totalWarnings: this.warnings.length,
			errorsByType,
			criticalErrors: this.errors.filter((e) => e.context.critical),
			recentErrors: this.errors.slice(-5)
		};
	}

	/**
	 * Generate error report
	 */
	generateReport(outputPath) {
		const summary = this.getSummary();
		const report = {
			generatedAt: new Date().toISOString(),
			summary: {
				totalErrors: summary.totalErrors,
				totalWarnings: summary.totalWarnings,
				errorTypes: Object.keys(summary.errorsByType)
			},
			errors: this.errors,
			warnings: this.warnings,
			recommendations: this.generateRecommendations(summary)
		};

		writeFileSync(outputPath, JSON.stringify(report, null, 2));
		return report;
	}

	/**
	 * Generate recommendations based on errors
	 */
	generateRecommendations(summary) {
		const recommendations = [];

		if (summary.errorsByType.DEPENDENCY_ERROR) {
			recommendations.push({
				type: 'DEPENDENCY',
				message: 'Install missing dependencies using npm install or check PATH',
				errors: summary.errorsByType.DEPENDENCY_ERROR.length
			});
		}

		if (summary.errorsByType.PERMISSION_ERROR) {
			recommendations.push({
				type: 'PERMISSION',
				message: 'Check file permissions or run with appropriate privileges',
				errors: summary.errorsByType.PERMISSION_ERROR.length
			});
		}

		if (summary.errorsByType.API_ERROR) {
			recommendations.push({
				type: 'API',
				message: 'Check API keys, rate limits, or network connectivity',
				errors: summary.errorsByType.API_ERROR.length
			});
		}

		if (summary.errorsByType.TIMEOUT_ERROR) {
			recommendations.push({
				type: 'TIMEOUT',
				message:
					'Consider increasing timeout values or optimizing slow operations',
				errors: summary.errorsByType.TIMEOUT_ERROR.length
			});
		}

		return recommendations;
	}

	/**
	 * Display error summary in console
	 */
	displaySummary() {
		const summary = this.getSummary();

		if (summary.totalErrors === 0 && summary.totalWarnings === 0) {
			console.log(chalk.green('✅ No errors or warnings detected'));
			return;
		}

		console.log(chalk.red.bold(`\n🚨 Error Summary:`));
		console.log(chalk.red(`   Total Errors: ${summary.totalErrors}`));
		console.log(chalk.yellow(`   Total Warnings: ${summary.totalWarnings}`));

		if (summary.totalErrors > 0) {
			console.log(chalk.red.bold('\n   Error Types:'));
			Object.entries(summary.errorsByType).forEach(([type, errors]) => {
				console.log(chalk.red(`     - ${type}: ${errors.length}`));
			});

			if (summary.criticalErrors.length > 0) {
				console.log(
					chalk.red.bold(
						`\n   ⚠️  Critical Errors: ${summary.criticalErrors.length}`
					)
				);
				summary.criticalErrors.forEach((error) => {
					console.log(chalk.red(`     - ${error.message}`));
				});
			}
		}

		const recommendations = this.generateRecommendations(summary);
		if (recommendations.length > 0) {
			console.log(chalk.yellow.bold('\n💡 Recommendations:'));
			recommendations.forEach((rec) => {
				console.log(chalk.yellow(`   - ${rec.message}`));
			});
		}
	}

	/**
	 * Clear all errors and warnings
	 */
	clear() {
		this.errors = [];
		this.warnings = [];
	}
}

/**
 * Global error handler for uncaught exceptions
 */
export function setupGlobalErrorHandlers(errorHandler, logger) {
	process.on('uncaughtException', (error) => {
		logger.error(`Uncaught Exception: ${error.message}`);
		errorHandler.handleError(error, {
			critical: true,
			source: 'uncaughtException'
		});
		process.exit(1);
	});

	process.on('unhandledRejection', (reason, promise) => {
		logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
		errorHandler.handleError(new Error(String(reason)), {
			critical: false,
			source: 'unhandledRejection'
		});
	});

	process.on('SIGINT', () => {
		logger.info('\nReceived SIGINT, shutting down gracefully...');
		errorHandler.displaySummary();
		process.exit(130);
	});

	process.on('SIGTERM', () => {
		logger.info('\nReceived SIGTERM, shutting down...');
		errorHandler.displaySummary();
		process.exit(143);
	});
}
