#!/usr/bin/env node

import { readFileSync, existsSync, writeFileSync } from 'fs';

function parseMetricsTable(content, metricName) {
	const lines = content.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		// Match a markdown table row like: | Metric Name | value | ...
		const safeName = metricName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const re = new RegExp(`^\\|\\s*${safeName}\\s*\\|\\s*([^|]+)\\|?`);
		const match = line.match(re);
		if (match) {
			return match[1].trim() || 'N/A';
		}
	}
	return 'N/A';
}

function parseCountMetric(content, metricName) {
	const result = parseMetricsTable(content, metricName);
	// Extract number from string, handling commas and spaces
	const numberMatch = result.toString().match(/[\d,]+/);
	if (numberMatch) {
		const number = parseInt(numberMatch[0].replace(/,/g, ''));
		return isNaN(number) ? 0 : number;
	}
	return 0;
}

function main() {
	const metrics = {
		issues_created: 0,
		issues_closed: 0,
		prs_created: 0,
		prs_merged: 0,
		issue_avg_first_response: 'N/A',
		issue_avg_time_to_close: 'N/A',
		pr_avg_first_response: 'N/A',
		pr_avg_merge_time: 'N/A'
	};

	// Parse issue metrics
	if (existsSync('issue_metrics.md')) {
		console.log('📄 Found issue_metrics.md, parsing...');
		const issueContent = readFileSync('issue_metrics.md', 'utf8');

		metrics.issues_created = parseCountMetric(
			issueContent,
			'Total number of items created'
		);
		metrics.issues_closed = parseCountMetric(
			issueContent,
			'Number of items closed'
		);
		metrics.issue_avg_first_response = parseMetricsTable(
			issueContent,
			'Time to first response'
		);
		metrics.issue_avg_time_to_close = parseMetricsTable(
			issueContent,
			'Time to close'
		);
	} else {
		console.warn('[parse-metrics] issue_metrics.md not found; using defaults.');
	}

	// Parse PR created metrics
	if (existsSync('pr_created_metrics.md')) {
		console.log('📄 Found pr_created_metrics.md, parsing...');
		const prCreatedContent = readFileSync('pr_created_metrics.md', 'utf8');

		metrics.prs_created = parseCountMetric(
			prCreatedContent,
			'Total number of items created'
		);
		metrics.pr_avg_first_response = parseMetricsTable(
			prCreatedContent,
			'Time to first response'
		);
	} else {
		console.warn(
			'[parse-metrics] pr_created_metrics.md not found; using defaults.'
		);
	}

	// Parse PR merged metrics (for more accurate merge data)
	if (existsSync('pr_merged_metrics.md')) {
		console.log('📄 Found pr_merged_metrics.md, parsing...');
		const prMergedContent = readFileSync('pr_merged_metrics.md', 'utf8');

		metrics.prs_merged = parseCountMetric(
			prMergedContent,
			'Total number of items created'
		);
		// For merged PRs, "Time to close" is actually time to merge
		metrics.pr_avg_merge_time = parseMetricsTable(
			prMergedContent,
			'Time to close'
		);
	} else {
		console.warn(
			'[parse-metrics] pr_merged_metrics.md not found; falling back to pr_metrics.md.'
		);
		// Fallback: try old pr_metrics.md if it exists
		if (existsSync('pr_metrics.md')) {
			console.log('📄 Falling back to pr_metrics.md...');
			const prContent = readFileSync('pr_metrics.md', 'utf8');

			const mergedCount = parseCountMetric(prContent, 'Number of items merged');
			metrics.prs_merged =
				mergedCount || parseCountMetric(prContent, 'Number of items closed');

			const maybeMergeTime = parseMetricsTable(
				prContent,
				'Average time to merge'
			);
			metrics.pr_avg_merge_time =
				maybeMergeTime !== 'N/A'
					? maybeMergeTime
					: parseMetricsTable(prContent, 'Time to close');
		} else {
			console.warn('[parse-metrics] pr_metrics.md not found; using defaults.');
		}
	}

	// Output for GitHub Actions
	const output = Object.entries(metrics)
		.map(([key, value]) => `${key}=${value}`)
		.join('\n');

	// Always output to stdout for debugging
	console.log('\n=== FINAL METRICS ===');
	Object.entries(metrics).forEach(([key, value]) => {
		console.log(`${key}: ${value}`);
	});

	// Write to GITHUB_OUTPUT if in GitHub Actions
	if (process.env.GITHUB_OUTPUT) {
		try {
			writeFileSync(process.env.GITHUB_OUTPUT, output + '\n', { flag: 'a' });
			console.log(
				`\nSuccessfully wrote metrics to ${process.env.GITHUB_OUTPUT}`
			);
		} catch (error) {
			console.error(`Failed to write to GITHUB_OUTPUT: ${error.message}`);
			process.exit(1);
		}
	} else {
		console.log(
			'\nNo GITHUB_OUTPUT environment variable found, skipping file write'
		);
	}
}

main();
