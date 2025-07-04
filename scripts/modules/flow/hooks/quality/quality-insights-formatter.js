/**
 * Format quality metrics for task update
 */
export function formatForTaskUpdate(qualityMetrics) {
	if (!qualityMetrics || qualityMetrics.error) {
		return {
			summary: 'Quality analysis unavailable',
			details: qualityMetrics?.error || 'No quality metrics available'
		};
	}

	if (!qualityMetrics.hasChanges) {
		return {
			summary: 'No code changes detected',
			details:
				qualityMetrics.message || 'Session completed without file changes'
		};
	}

	const summary = generateSummary(qualityMetrics);
	const details = generateDetailedReport(qualityMetrics);

	return { summary, details };
}

/**
 * Generate a concise summary
 */
export function generateSummary(metrics) {
	const score = metrics.overallScore;
	const fileCount = metrics.fileCount;
	const totalLines = metrics.totalLines;

	let scoreEmoji = '✅';
	let scoreDescription = 'excellent';

	if (score < 6) {
		scoreEmoji = '🔧';
		scoreDescription = 'needs improvement';
	} else if (score < 8) {
		scoreEmoji = '⚠️';
		scoreDescription = 'acceptable';
	}

	return `${scoreEmoji} Quality Score: ${score}/10 (${scoreDescription}) • ${fileCount} files • ${totalLines} lines`;
}

/**
 * Generate detailed quality report
 */
export function generateDetailedReport(metrics) {
	const sections = [];

	// Overview section
	sections.push('## Quality Analysis Summary');
	sections.push(`- **Overall Score:** ${metrics.overallScore}/10`);
	sections.push(`- **Files Analyzed:** ${metrics.fileCount}`);
	sections.push(`- **Total Lines:** ${metrics.totalLines}`);
	sections.push(`- **Analysis Time:** ${metrics.analysisTime}ms`);
	sections.push('');

	// Aggregate metrics
	if (metrics.aggregateMetrics) {
		sections.push('## Code Metrics');
		const agg = metrics.aggregateMetrics;

		sections.push(
			`- **Average Complexity:** ${agg.averageComplexity?.toFixed(1) || 'N/A'}`
		);
		sections.push(
			`- **Comment Ratio:** ${(agg.averageCommentRatio * 100)?.toFixed(1) || 'N/A'}%`
		);
		sections.push(`- **Total Functions:** ${agg.totalFunctions || 0}`);

		if (agg.complexityDistribution) {
			const dist = agg.complexityDistribution;
			sections.push(
				`- **Complexity Distribution:** Low: ${dist.low}, Medium: ${dist.medium}, High: ${dist.high}, Very High: ${dist['very-high']}`
			);
		}
		sections.push('');
	}

	// Linting results
	if (metrics.lintResults) {
		sections.push('## Linting Results');
		const lint = metrics.lintResults;

		if (lint.available) {
			if (lint.errorCount > 0 || lint.warningCount > 0) {
				sections.push(`- **Errors:** ${lint.errorCount || 0}`);
				sections.push(`- **Warnings:** ${lint.warningCount || 0}`);

				if (lint.issues && lint.issues.length > 0) {
					sections.push('- **Top Issues:**');
					lint.issues.slice(0, 3).forEach((issue) => {
						sections.push(`  - ${issue.severity}: ${issue.message}`);
					});
				}
			} else {
				sections.push('- ✅ No linting issues found');
			}
		} else {
			sections.push(
				`- ⚠️ Linting unavailable: ${lint.reason || lint.error || 'Unknown reason'}`
			);
		}
		sections.push('');
	}

	// Task alignment
	if (metrics.taskAlignment) {
		sections.push('## Task Alignment');
		const alignment = metrics.taskAlignment;

		sections.push(
			`- **Keyword Coverage:** ${(alignment.keywordCoverage * 100).toFixed(1)}%`
		);
		sections.push(
			`- **Implementation Scope:** ${alignment.implementationScope}`
		);
		sections.push(
			`- **Relevant Files:** ${(alignment.relevantFileRatio * 100).toFixed(1)}%`
		);

		if (alignment.foundKeywords?.length > 0) {
			sections.push(
				`- **Found Keywords:** ${alignment.foundKeywords.join(', ')}`
			);
		}
		if (alignment.missedKeywords?.length > 0) {
			sections.push(
				`- **Missed Keywords:** ${alignment.missedKeywords.join(', ')}`
			);
		}
		sections.push('');
	}

	// File breakdown
	if (metrics.files && metrics.files.length > 0) {
		sections.push('## File Analysis');

		metrics.files.forEach((file) => {
			const complexity = file.metrics.complexity?.cyclomaticComplexity || 'N/A';
			const complexityLevel =
				file.metrics.complexity?.complexityLevel || 'unknown';
			const lines = file.metrics.linesOfCode || 0;

			sections.push(`- **${file.path}** (${file.status})`);
			sections.push(
				`  - Lines: ${lines}, Complexity: ${complexity} (${complexityLevel})`
			);

			if (file.jsMetrics) {
				const js = file.jsMetrics;
				sections.push(
					`  - Functions: ${js.functionCount}, Classes: ${js.classCount}, Imports: ${js.importCount}`
				);

				if (js.todoComments > 0) {
					sections.push(`  - TODO comments: ${js.todoComments}`);
				}
				if (js.consoleUsage > 0) {
					sections.push(`  - Console usage: ${js.consoleUsage}`);
				}
			}

			if (file.issues?.length > 0) {
				sections.push(`  - Issues: ${file.issues.join(', ')}`);
			}
		});
	}

	return sections.join('\n');
}

/**
 * Format quality metrics for PR description
 */
export function formatForPRDescription(qualityMetrics) {
	if (!qualityMetrics || qualityMetrics.error || !qualityMetrics.hasChanges) {
		return '';
	}

	const sections = [];

	sections.push('## 🔍 Code Quality Analysis');
	sections.push('');
	sections.push(`**Overall Score:** ${qualityMetrics.overallScore}/10`);

	if (qualityMetrics.aggregateMetrics) {
		const agg = qualityMetrics.aggregateMetrics;
		sections.push(`**Complexity:** ${agg.averageComplexity?.toFixed(1)} avg`);
		sections.push(
			`**Documentation:** ${(agg.averageCommentRatio * 100)?.toFixed(1)}% comments`
		);
	}

	if (qualityMetrics.lintResults?.available) {
		const lint = qualityMetrics.lintResults;
		if (lint.errorCount === 0 && lint.warningCount === 0) {
			sections.push(`**Linting:** ✅ Clean`);
		} else {
			sections.push(
				`**Linting:** ${lint.errorCount} errors, ${lint.warningCount} warnings`
			);
		}
	}

	if (qualityMetrics.taskAlignment) {
		const coverage = (
			qualityMetrics.taskAlignment.keywordCoverage * 100
		).toFixed(0);
		sections.push(`**Task Alignment:** ${coverage}% keyword coverage`);
	}

	return sections.join('\n');
}

/**
 * Format quality metrics for console output
 */
export function formatForConsole(qualityMetrics) {
	if (!qualityMetrics || qualityMetrics.error) {
		return `❌ Quality analysis failed: ${qualityMetrics?.error || 'Unknown error'}`;
	}

	if (!qualityMetrics.hasChanges) {
		return '📝 No code changes detected in session';
	}

	const lines = [];

	// Header
	lines.push(`🔍 Code Quality Analysis (${qualityMetrics.analysisTime}ms)`);
	lines.push(''.padEnd(50, '─'));

	// Score
	const scoreEmoji =
		qualityMetrics.overallScore >= 8
			? '✅'
			: qualityMetrics.overallScore >= 6
				? '⚠️'
				: '🔧';
	lines.push(`${scoreEmoji} Overall Score: ${qualityMetrics.overallScore}/10`);

	// Files
	lines.push(
		`📁 Files: ${qualityMetrics.fileCount} (${qualityMetrics.totalLines} lines)`
	);

	// Metrics
	if (qualityMetrics.aggregateMetrics) {
		const agg = qualityMetrics.aggregateMetrics;
		lines.push(`🔄 Avg Complexity: ${agg.averageComplexity?.toFixed(1)}`);
		lines.push(
			`📝 Comment Ratio: ${(agg.averageCommentRatio * 100)?.toFixed(1)}%`
		);
	}

	// Linting
	if (qualityMetrics.lintResults?.available) {
		const lint = qualityMetrics.lintResults;
		if (lint.errorCount === 0 && lint.warningCount === 0) {
			lines.push('✅ Linting: Clean');
		} else {
			lines.push(
				`🔧 Linting: ${lint.errorCount} errors, ${lint.warningCount} warnings`
			);
		}
	}

	// Task alignment
	if (qualityMetrics.taskAlignment) {
		const coverage = (
			qualityMetrics.taskAlignment.keywordCoverage * 100
		).toFixed(0);
		const emoji = coverage >= 70 ? '✅' : coverage >= 50 ? '⚠️' : '❌';
		lines.push(`${emoji} Task Alignment: ${coverage}%`);
	}

	return lines.join('\n');
}
