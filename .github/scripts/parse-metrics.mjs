#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { writeFileSync } from 'fs';

function parseMetricsTable(content, metricName) {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes(metricName)) {
      // Split by | and get the value column (usually index 2)
      const columns = line.split('|').map(col => col.trim());
      if (columns.length >= 3) {
        return columns[2] || 'N/A';
      }
    }
  }
  return 'N/A';
}

function parseCountMetric(content, metricName) {
  const result = parseMetricsTable(content, metricName);
  // Try to extract just the number if it's a valid number
  const number = parseInt(result);
  return isNaN(number) ? 0 : number;
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
    const issueContent = readFileSync('issue_metrics.md', 'utf8');

    metrics.issues_created = parseCountMetric(issueContent, 'Total number of items created');
    metrics.issues_closed = parseCountMetric(issueContent, 'Number of items closed');
    metrics.issue_avg_first_response = parseMetricsTable(issueContent, 'Time to first response');
    metrics.issue_avg_time_to_close = parseMetricsTable(issueContent, 'Time to close');
  }

  // Parse PR metrics
  if (existsSync('pr_metrics.md')) {
    const prContent = readFileSync('pr_metrics.md', 'utf8');

    metrics.prs_created = parseCountMetric(prContent, 'Total number of items created');
    metrics.prs_merged = parseCountMetric(prContent, 'Number of items closed');
    metrics.pr_avg_first_response = parseMetricsTable(prContent, 'Time to first response');
    metrics.pr_avg_merge_time = parseMetricsTable(prContent, 'Time to close');
  }

  // Output for GitHub Actions
  const output = Object.entries(metrics)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Write to GITHUB_OUTPUT if in GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT, output + '\n', { flag: 'a' });
  }
}

main();