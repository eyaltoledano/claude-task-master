// Simple console colors fallback if chalk is not available
const colors = {
	green: (text) => `\x1b[32m${text}\x1b[0m`,
	red: (text) => `\x1b[31m${text}\x1b[0m`,
	yellow: (text) => `\x1b[33m${text}\x1b[0m`,
	blue: (text) => `\x1b[34m${text}\x1b[0m`,
	cyan: (text) => `\x1b[36m${text}\x1b[0m`,
	gray: (text) => `\x1b[90m${text}\x1b[0m`
};

class TestLogger {
	constructor(testName = 'test') {
		this.testName = testName;
		this.startTime = Date.now();
		this.stepCount = 0;
		this.logBuffer = [];
		this.totalCost = 0;
	}

	_formatMessage(level, message, options = {}) {
		const timestamp = new Date().toISOString();
		const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
		const formattedMessage = `[${timestamp}] [${elapsed}s] [${level}] ${message}`;

		// Add to buffer for later saving if needed
		this.logBuffer.push(formattedMessage);

		return formattedMessage;
	}

	_log(level, message, color) {
		const formatted = this._formatMessage(level, message);

		if (process.env.E2E_VERBOSE !== 'false') {
			console.log(color ? color(formatted) : formatted);
		}
	}

	info(message) {
		this._log('INFO', message, colors.blue);
	}

	success(message) {
		this._log('SUCCESS', message, colors.green);
	}

	error(message) {
		this._log('ERROR', message, colors.red);
	}

	warning(message) {
		this._log('WARNING', message, colors.yellow);
	}

	step(message) {
		this.stepCount++;
		this._log('STEP', `Step ${this.stepCount}: ${message}`, colors.cyan);
	}

	debug(message) {
		if (process.env.DEBUG) {
			this._log('DEBUG', message, colors.gray);
		}
	}

	flush() {
		// In CommonJS version, we'll just clear the buffer
		// Real implementation would write to file if needed
		this.logBuffer = [];
	}

	summary() {
		const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
		const summary = `Test completed in ${duration}s`;
		this.info(summary);
		return {
			duration: parseFloat(duration),
			steps: this.stepCount,
			totalCost: this.totalCost
		};
	}

	extractAndAddCost(output) {
		// Extract cost information from LLM output
		const costPatterns = [
			/Total Cost: \$?([\d.]+)/i,
			/Cost: \$?([\d.]+)/i,
			/Estimated cost: \$?([\d.]+)/i
		];

		for (const pattern of costPatterns) {
			const match = output.match(pattern);
			if (match) {
				const cost = parseFloat(match[1]);
				this.totalCost += cost;
				this.debug(
					`Added cost: $${cost} (Total: $${this.totalCost.toFixed(4)})`
				);
				break;
			}
		}
	}

	getTotalCost() {
		return this.totalCost;
	}
}

module.exports = { TestLogger };
