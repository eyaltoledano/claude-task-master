/**
 * @fileoverview ComplexityReportManager - Handles loading and managing complexity analysis reports
 * Follows the same pattern as ConfigManager and AuthManager
 */

import fs from 'node:fs/promises';
import path from 'path';
import type {
	ComplexityReport,
	ComplexityAnalysis,
	TaskComplexityData
} from '../types.js';
import { getLogger } from '../../../common/logger/index.js';

const logger = getLogger('ComplexityReportManager');

/**
 * Manages complexity analysis reports
 * Handles loading, caching, and providing complexity data for tasks
 */
export class ComplexityReportManager {
	private projectRoot: string;
	private reportCache: Map<string, ComplexityReport> = new Map();

	constructor(projectRoot: string) {
		this.projectRoot = projectRoot;
	}

	/**
	 * Get the path to the complexity report file for a given tag
	 */
	private getReportPath(tag?: string): string {
		const reportsDir = path.join(this.projectRoot, '.taskmaster', 'reports');
		const tagSuffix = tag && tag !== 'master' ? `_${tag}` : '';
		return path.join(reportsDir, `task-complexity-report${tagSuffix}.json`);
	}

	/**
	 * Load complexity report for a given tag
	 * Results are cached to avoid repeated file reads
	 */
	async loadReport(tag?: string): Promise<ComplexityReport | null> {
		const resolvedTag = tag || 'master';
		const cacheKey = resolvedTag;

		// Check cache first
		if (this.reportCache.has(cacheKey)) {
			return this.reportCache.get(cacheKey)!;
		}

		const reportPath = this.getReportPath(tag);

		try {
			// Check if file exists
			await fs.access(reportPath);

			// Read and parse the report
			const content = await fs.readFile(reportPath, 'utf-8');
			const report = JSON.parse(content) as ComplexityReport;

			// Validate basic structure
			if (!report.meta || !Array.isArray(report.complexityAnalysis)) {
				logger.warn(
					`Invalid complexity report structure at ${reportPath}, ignoring`
				);
				return null;
			}

			// Cache the report
			this.reportCache.set(cacheKey, report);

			logger.debug(
				`Loaded complexity report for tag '${resolvedTag}' with ${report.complexityAnalysis.length} analyses`
			);

			return report;
		} catch (error: any) {
			if (error.code === 'ENOENT') {
				// File doesn't exist - this is normal, not all projects have complexity reports
				logger.debug(`No complexity report found for tag '${resolvedTag}'`);
				return null;
			}

			// Other errors (parsing, permissions, etc.)
			logger.warn(
				`Failed to load complexity report for tag '${resolvedTag}': ${error.message}`
			);
			return null;
		}
	}

	/**
	 * Get complexity data for a specific task ID
	 */
	async getComplexityForTask(
		taskId: string | number,
		tag?: string
	): Promise<TaskComplexityData | null> {
		const report = await this.loadReport(tag);
		if (!report) {
			return null;
		}

		// Find the analysis for this task
		const analysis = report.complexityAnalysis.find(
			(a) => String(a.taskId) === String(taskId)
		);

		if (!analysis) {
			return null;
		}

		// Convert to TaskComplexityData format
		return {
			complexityScore: analysis.complexityScore,
			recommendedSubtasks: analysis.recommendedSubtasks,
			expansionPrompt: analysis.expansionPrompt,
			complexityReasoning: analysis.complexityReasoning
		};
	}

	/**
	 * Get complexity data for multiple tasks at once
	 * More efficient than calling getComplexityForTask multiple times
	 */
	async getComplexityForTasks(
		taskIds: (string | number)[],
		tag?: string
	): Promise<Map<string, TaskComplexityData>> {
		const result = new Map<string, TaskComplexityData>();
		const report = await this.loadReport(tag);

		if (!report) {
			return result;
		}

		// Create a map for fast lookups
		const analysisMap = new Map<string, ComplexityAnalysis>();
		report.complexityAnalysis.forEach((analysis) => {
			analysisMap.set(String(analysis.taskId), analysis);
		});

		// Map each task ID to its complexity data
		taskIds.forEach((taskId) => {
			const analysis = analysisMap.get(String(taskId));
			if (analysis) {
				result.set(String(taskId), {
					complexityScore: analysis.complexityScore,
					recommendedSubtasks: analysis.recommendedSubtasks,
					expansionPrompt: analysis.expansionPrompt,
					complexityReasoning: analysis.complexityReasoning
				});
			}
		});

		return result;
	}

	/**
	 * Clear the report cache
	 * @param tag - Specific tag to clear, or undefined to clear all cached reports
	 * Useful when reports are regenerated or modified externally
	 */
	clearCache(tag?: string): void {
		if (tag) {
			this.reportCache.delete(tag);
		} else {
			// Clear all cached reports
			this.reportCache.clear();
		}
	}

	/**
	 * Check if a complexity report exists for a tag
	 */
	async hasReport(tag?: string): Promise<boolean> {
		const reportPath = this.getReportPath(tag);
		try {
			await fs.access(reportPath);
			return true;
		} catch {
			return false;
		}
	}
}
