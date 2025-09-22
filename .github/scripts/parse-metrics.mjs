#!/usr/bin/env node

import { readFileSync, existsSync, writeFileSync } from 'fs';

function parseMetricsTable(content, metricName) {
	const lines = content.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (line.includes(metricName)) {
			// Split by | and get the value column, filtering empty strings
			const columns = line
				.split('|')
				.map((col) => col.trim())
				.filter((col) => col.length > 0);
			// Look for the value in columns 1-3 (accounting for different table formats)
			for (let j = 1; j < Math.min(columns.length, 4); j++) {
				const value = columns[j];
				if (value && value !== '---' && value !== metricName) {
					return value;
				}
			}
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
		console.log('⚠️  No issue_metrics.md found');
	}

	// Parse PR metrics
	if (existsSync('pr_metrics.md')) {
		console.log('📄 Found pr_metrics.md, parsing...');
		const prContent = readFileSync('pr_metrics.md', 'utf8');

		metrics.prs_created = parseCountMetric(
			prContent,
			'Total number of items created'
		);
		// Prefer merged; fall back to closed if the generator doesn't emit "merged"
		const mergedCount = parseCountMetric(prContent, 'Number of items merged');
		metrics.prs_merged = mergedCount || parseCountMetric(prContent, 'Number of items closed');

		metrics.pr_avg_first_response = parseMetricsTable(
			prContent,
			'Time to first response'
		);
		// Prefer "Average time to merge"; fall back to "Time to close"
		const maybeMergeTime = parseMetricsTable(prContent, 'Average time to merge');
		metrics.pr_avg_merge_time = maybeMergeTime !== 'N/A'
			? maybeMergeTime
			: parseMetricsTable(prContent, 'Time to close');
	} else {
		console.log('⚠️  No pr_metrics.md found');
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
