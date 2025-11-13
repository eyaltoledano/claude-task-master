/**
 * Logger and timing utilities for Cortex Code provider
 * Uses Pino for logging with custom performance tracking
 */

import pino from 'pino';

export enum LogLevel {
	SILENT = 0,
	ERROR = 1,
	WARN = 2,
	INFO = 3,
	DEBUG = 4,
	TRACE = 5
}

export interface TimingMetrics {
	modelId: string;
	operation: string;
	startTime: number;
	endTime?: number;
	duration?: number;
	status?: 'success' | 'error';
	metadata?: Record<string, any>;
}

export interface LoggerConfig {
	level?: LogLevel;
	prefix?: string;
	trackTiming?: boolean;
}

// Simple ANSI color helpers for report output
const colors = {
	red: (text: string) => `\x1b[31m${text}\x1b[0m`,
	yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
	cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
	green: (text: string) => `\x1b[32m${text}\x1b[0m`,
	bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

export class CortexLogger {
	private pino: pino.Logger;
	private config: Required<LoggerConfig>;
	private timingMetrics: TimingMetrics[] = [];
	private static instance: CortexLogger;

	private static readonly DEFAULT_CONFIG: Required<LoggerConfig> = {
		level: LogLevel.INFO,
		prefix: 'CortexCode',
		trackTiming: true,
	};

	private constructor(config: LoggerConfig = {}) {
		this.config = { ...CortexLogger.DEFAULT_CONFIG, ...config };

		// Map our LogLevel to Pino level
		const pinoLevel = this.mapLogLevel(this.config.level);

		// Create Pino logger
		this.pino = pino({
			level: pinoLevel,
			base: { prefix: this.config.prefix },
			transport: process.env.NODE_ENV !== 'test' && process.env.CORTEX_LOG_LEVEL ? {
				target: 'pino-pretty',
				options: {
					colorize: true,
					translateTime: 'SYS:standard',
					ignore: 'pid,hostname',
				}
			} : undefined,
		});
	}

	public static getInstance(config?: LoggerConfig): CortexLogger {
		if (!CortexLogger.instance) {
			CortexLogger.instance = new CortexLogger(config);
		} else if (config) {
			CortexLogger.instance.setConfig(config);
		}
		return CortexLogger.instance;
	}

	private mapLogLevel(level: LogLevel): pino.LevelWithSilent {
		switch (level) {
			case LogLevel.SILENT: return 'silent';
			case LogLevel.ERROR: return 'error';
			case LogLevel.WARN: return 'warn';
			case LogLevel.INFO: return 'info';
			case LogLevel.DEBUG: return 'debug';
			case LogLevel.TRACE: return 'trace';
			default: return 'info';
		}
	}

	setConfig(config: Partial<LoggerConfig>): void {
		this.config = { ...this.config, ...config };
		if (config.level !== undefined) {
			this.pino.level = this.mapLogLevel(config.level);
		}
	}

	getConfig(): Readonly<Required<LoggerConfig>> {
		return { ...this.config };
	}

	child(prefix: string, config?: Partial<LoggerConfig>): CortexLogger {
		const childPrefix = this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix;
		return new CortexLogger({ ...this.config, ...config, prefix: childPrefix });
	}

	// Logging methods
	error(message: string, metadata?: Record<string, any>): void {
		this.pino.error(metadata, message);
	}

	warn(message: string, metadata?: Record<string, any>): void {
		this.pino.warn(metadata, message);
	}

	info(message: string, metadata?: Record<string, any>): void {
		this.pino.info(metadata, message);
	}

	debug(message: string, metadata?: Record<string, any>): void {
		this.pino.debug(metadata, message);
	}

	trace(message: string, metadata?: Record<string, any>): void {
		this.pino.trace(metadata, message);
	}

	// Timing methods
	startTiming(modelId: string, operation: string): TimingMetrics {
		if (!this.config.trackTiming) {
			return { modelId, operation, startTime: 0 };
		}

		const metric: TimingMetrics = {
			modelId,
			operation,
			startTime: performance.now()
		};
		this.timingMetrics.push(metric);
		this.trace(`Starting ${operation}`, { modelId });
		return metric;
	}

	endTiming(
		metric: TimingMetrics,
		modelId: string,
		operation: string,
		status: 'success' | 'error',
		metadata?: Record<string, any>
	): void {
		if (!this.config.trackTiming) return;

		metric.endTime = performance.now();
		metric.duration = metric.endTime - metric.startTime;
		metric.status = status;
		metric.metadata = { ...metric.metadata, ...metadata };

		const durationStr = this.formatDuration(metric.duration);
		const statusSymbol = status === 'success' ? '✓' : '✗';

		if (status === 'success') {
			this.debug(`${statusSymbol} ${operation} completed`, {
				modelId,
				duration: durationStr,
				durationMs: metric.duration,
				...metadata
			});
		} else {
			this.warn(`${statusSymbol} ${operation} failed`, {
				modelId,
				duration: durationStr,
				durationMs: metric.duration,
				...metadata
			});
		}
	}

	getTimingMetrics(): TimingMetrics[] {
		return [...this.timingMetrics];
	}

	clearTimingMetrics(): void {
		this.timingMetrics = [];
	}

	getSlowestModels(limit: number = 10): Array<{ model: string; avgMs: number; count: number }> {
		const stats = this.getTimingStats();
		return Array.from(stats.byModel.entries())
			.map(([model, modelStats]) => ({
				model,
				avgMs: modelStats.avgMs,
				count: modelStats.count
			}))
			.sort((a, b) => b.avgMs - a.avgMs)
			.slice(0, limit);
	}

	exportMetrics(): string {
		const stats = this.getTimingStats();
		return JSON.stringify({
			timestamp: new Date().toISOString(),
			summary: {
				totalCalls: stats.totalCalls,
				totalErrors: stats.totalErrors,
				totalDurationMs: stats.totalDurationMs,
				avgDurationMs: stats.avgDurationMs
			},
			byModel: Object.fromEntries(stats.byModel),
			byOperation: Object.fromEntries(stats.byOperation),
			rawMetrics: this.timingMetrics
		}, null, 2);
	}

	getTimingStats(): {
		totalCalls: number;
		totalErrors: number;
		totalDurationMs: number;
		avgDurationMs: number;
		byModel: Map<string, {
			count: number;
			totalMs: number;
			avgMs: number;
			errors: number;
		}>;
		byOperation: Map<string, {
			count: number;
			totalMs: number;
			avgMs: number;
			errors: number;
		}>;
	} {
		const stats = {
			totalCalls: 0,
			totalErrors: 0,
			totalDurationMs: 0,
			avgDurationMs: 0,
			byModel: new Map<string, { count: number; totalMs: number; avgMs: number; errors: number }>(),
			byOperation: new Map<string, { count: number; totalMs: number; avgMs: number; errors: number }>(),
		};

		for (const metric of this.timingMetrics) {
			if (metric.duration === undefined) continue;

			stats.totalCalls++;
			stats.totalDurationMs += metric.duration;
			if (metric.status === 'error') {
				stats.totalErrors++;
			}

			// By model
			let modelStats = stats.byModel.get(metric.modelId);
			if (!modelStats) {
				modelStats = { count: 0, totalMs: 0, avgMs: 0, errors: 0 };
				stats.byModel.set(metric.modelId, modelStats);
			}
			modelStats.count++;
			modelStats.totalMs += metric.duration;
			modelStats.errors += metric.status === 'error' ? 1 : 0;

			// By operation
			let opStats = stats.byOperation.get(metric.operation);
			if (!opStats) {
				opStats = { count: 0, totalMs: 0, avgMs: 0, errors: 0 };
				stats.byOperation.set(metric.operation, opStats);
			}
			opStats.count++;
			opStats.totalMs += metric.duration;
			opStats.errors += metric.status === 'error' ? 1 : 0;
		}

		stats.avgDurationMs = stats.totalCalls > 0 ? stats.totalDurationMs / stats.totalCalls : 0;

		stats.byModel.forEach((modelStats) => {
			modelStats.avgMs = modelStats.count > 0 ? modelStats.totalMs / modelStats.count : 0;
		});
		stats.byOperation.forEach((opStats) => {
			opStats.avgMs = opStats.count > 0 ? opStats.totalMs / opStats.count : 0;
		});

		return stats;
	}

	printTimingReport(): void {
		const stats = this.getTimingStats();
		if (stats.totalCalls === 0) {
			console.log('No timing metrics collected.');
			return;
		}

		console.log(colors.bold('\n' + colors.cyan('═'.repeat(80))));
		console.log(colors.bold(colors.cyan('  CORTEX CODE PERFORMANCE REPORT')));
		console.log(colors.bold(colors.cyan('═'.repeat(80))));

		console.log(
			colors.bold('\n📊 Overall Statistics:') +
			`\n  Total Calls: ${stats.totalCalls}` +
			`\n  Total Errors: ${stats.totalErrors} (${((stats.totalErrors / stats.totalCalls) * 100).toFixed(1)}%)` +
			`\n  Total Duration: ${this.formatDuration(stats.totalDurationMs)}` +
			`\n  Average Duration: ${this.formatDuration(stats.avgDurationMs)}`
		);

		// By model
		console.log(colors.bold('\n🤖 Performance by Model:'));
		const modelEntries = Array.from(stats.byModel.entries()).sort(
			(a, b) => b[1].avgMs - a[1].avgMs
		);

		for (const [modelId, modelStats] of modelEntries) {
			const successRate = ((modelStats.count - modelStats.errors) / modelStats.count) * 100;
			const colorFn = modelStats.avgMs > 10000 ? colors.red : colors.green;

			console.log(
				`  ${colorFn(modelId.padEnd(30))} ` +
				`Avg: ${colorFn(this.formatDuration(modelStats.avgMs).padEnd(8))} ` +
				`Calls: ${modelStats.count.toString().padEnd(4)} ` +
				`Success: ${successRate.toFixed(0)}%`
			);
		}

		// By operation
		console.log(colors.bold('\n⚙️  Performance by Operation:'));
		const opEntries = Array.from(stats.byOperation.entries()).sort(
			(a, b) => b[1].avgMs - a[1].avgMs
		);

		for (const [operation, opStats] of opEntries) {
			const successRate = ((opStats.count - opStats.errors) / opStats.count) * 100;
			const colorFn = opStats.avgMs > 10000 ? colors.red : colors.green;

			console.log(
				`  ${colorFn(operation.padEnd(30))} ` +
				`Avg: ${colorFn(this.formatDuration(opStats.avgMs).padEnd(8))} ` +
				`Calls: ${opStats.count.toString().padEnd(4)} ` +
				`Success: ${successRate.toFixed(0)}%`
			);
		}
		console.log(colors.bold(colors.cyan('═'.repeat(80))) + '\n');
	}

	private formatDuration(ms: number): string {
		if (ms < 1000) return `${ms.toFixed(0)}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
		const minutes = Math.floor(ms / 60000);
		const seconds = ((ms % 60000) / 1000).toFixed(0);
		return `${minutes}m ${seconds}s`;
	}
}

export function getLogger(config?: LoggerConfig): CortexLogger {
	return CortexLogger.getInstance(config);
}

// Decorator for method timing
export function timed(operation: string) {
	return function (
		_target: any,
		_propertyKey: string,
		descriptor: PropertyDescriptor
	) {
		const originalMethod = descriptor.value;

		descriptor.value = async function (...args: any[]) {
			const logger = getLogger();
			const modelId = (this as any).modelId || 'unknown';
			const startTime = logger.startTiming(modelId, operation);

			try {
				const result = await originalMethod.apply(this, args);
				logger.endTiming(startTime, modelId, operation, 'success');
				return result;
			} catch (error) {
				logger.endTiming(startTime, modelId, operation, 'error', {
					error: error instanceof Error ? error.message : String(error)
				});
				throw error;
			}
		};

		return descriptor;
	};
}
