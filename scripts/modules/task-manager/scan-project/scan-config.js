/**
 * Configuration classes for project scanning functionality
 */

/**
 * Configuration object for scan operations
 */
export class ScanConfig {
	constructor({
		projectRoot,
		outputPath = null,
		includeFiles = [],
		excludeFiles = ['node_modules', '.git', 'dist', 'build', '*.log'],
		scanDepth = 5,
		mcpLog = false,
		reportProgress = false,
		debug = false
	} = {}) {
		this.projectRoot = projectRoot;
		this.outputPath = outputPath;
		this.includeFiles = includeFiles;
		this.excludeFiles = excludeFiles;
		this.scanDepth = scanDepth;
		this.mcpLog = mcpLog;
		this.reportProgress = reportProgress;
		this.debug = debug;
	}
}

/**
 * Logging configuration for scan operations
 */
export class ScanLoggingConfig {
	constructor(mcpLog = false, reportProgress = false) {
		this.mcpLog = mcpLog;
		this.reportProgress = reportProgress;
	}

	report(message, level = 'info') {
		if (this.reportProgress || this.mcpLog) {
			const prefix = this.mcpLog ? '[MCP]' : '[SCAN]';
			console.log(`${prefix} ${level.toUpperCase()}: ${message}`);
		}
	}

	debug(message) {
		this.report(message, 'debug');
	}

	info(message) {
		this.report(message, 'info');
	}

	warn(message) {
		this.report(message, 'warn');
	}

	error(message) {
		this.report(message, 'error');
	}
}