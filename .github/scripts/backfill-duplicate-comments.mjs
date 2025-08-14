#!/usr/bin/env node

async function githubRequest(endpoint, token, method = 'GET', body) {
	const response = await fetch(`https://api.github.com${endpoint}`, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github.v3+json',
			'User-Agent': 'backfill-duplicate-comments-script',
			...(body && { 'Content-Type': 'application/json' })
		},
		...(body && { body: JSON.stringify(body) })
	});

	if (!response.ok) {
		throw new Error(
			`GitHub API request failed: ${response.status} ${response.statusText}`
		);
	}

	return response.json();
}

async function triggerDedupeWorkflow(
	owner,
	repo,
	issueNumber,
	token,
	dryRun = true
) {
	if (dryRun) {
		console.log(
			`[DRY RUN] Would trigger dedupe workflow for issue #${issueNumber}`
		);
		return;
	}

	await githubRequest(
		`/repos/${owner}/${repo}/actions/workflows/claude-dedupe-issues.yml/dispatches`,
		token,
		'POST',
		{
			ref: 'main',
			inputs: {
				issue_number: issueNumber.toString()
			}
		}
	);
}

async function backfillDuplicateComments() {
	console.log('[DEBUG] Starting backfill duplicate comments script');

	const token = process.env.GITHUB_TOKEN;
	if (!token) {
		throw new Error(`GITHUB_TOKEN environment variable is required

Usage:
  node .github/scripts/backfill-duplicate-comments.mjs

Environment Variables:
  GITHUB_TOKEN - GitHub personal access token with repo and actions permissions (required)
  DRY_RUN - Set to "false" to actually trigger workflows (default: true for safety)
  DAYS_BACK - How many days back to look for old issues (default: 90)`);
	}
	console.log('[DEBUG] GitHub token found');

	const owner = process.env.GITHUB_REPOSITORY_OWNER || 'eyaltoledano';
	const repo = process.env.GITHUB_REPOSITORY_NAME || 'claude-task-master';
	const dryRun = process.env.DRY_RUN !== 'false';
	const daysBack = parseInt(process.env.DAYS_BACK || '90', 10);

	console.log(`[DEBUG] Repository: ${owner}/${repo}`);
	console.log(`[DEBUG] Dry run mode: ${dryRun}`);
	console.log(`[DEBUG] Looking back ${daysBack} days`);

	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - daysBack);

	console.log(
		`[DEBUG] Fetching issues created since ${cutoffDate.toISOString()}...`
	);
	const allIssues = [];
	let page = 1;
	const perPage = 100;

	while (true) {
		const pageIssues = await githubRequest(
			`/repos/${owner}/${repo}/issues?state=all&per_page=${perPage}&page=${page}&since=${cutoffDate.toISOString()}`,
			token
		);

		if (pageIssues.length === 0) break;

		allIssues.push(...pageIssues);
		page++;

		// Safety limit to avoid infinite loops
		if (page > 100) {
			console.log('[DEBUG] Reached page limit, stopping pagination');
			break;
		}
	}

	console.log(
		`[DEBUG] Found ${allIssues.length} issues from the last ${daysBack} days`
	);

	let processedCount = 0;
	let candidateCount = 0;
	let triggeredCount = 0;

	for (const issue of allIssues) {
		processedCount++;
		console.log(
			`[DEBUG] Processing issue #${issue.number} (${processedCount}/${allIssues.length}): ${issue.title}`
		);

		console.log(`[DEBUG] Fetching comments for issue #${issue.number}...`);
		const comments = await githubRequest(
			`/repos/${owner}/${repo}/issues/${issue.number}/comments`,
			token
		);
		console.log(
			`[DEBUG] Issue #${issue.number} has ${comments.length} comments`
		);

		// Look for existing duplicate detection comments (from the dedupe bot)
		const dupeDetectionComments = comments.filter(
			(comment) =>
				comment.body.includes('Found') &&
				comment.body.includes('possible duplicate') &&
				comment.user.type === 'Bot'
		);

		console.log(
			`[DEBUG] Issue #${issue.number} has ${dupeDetectionComments.length} duplicate detection comments`
		);

		// Skip if there's already a duplicate detection comment
		if (dupeDetectionComments.length > 0) {
			console.log(
				`[DEBUG] Issue #${issue.number} already has duplicate detection comment, skipping`
			);
			continue;
		}

		candidateCount++;
		const issueUrl = `https://github.com/${owner}/${repo}/issues/${issue.number}`;

		try {
			console.log(
				`[INFO] ${dryRun ? '[DRY RUN] ' : ''}Triggering dedupe workflow for issue #${issue.number}: ${issueUrl}`
			);
			await triggerDedupeWorkflow(owner, repo, issue.number, token, dryRun);

			if (!dryRun) {
				console.log(
					`[SUCCESS] Successfully triggered dedupe workflow for issue #${issue.number}`
				);
			}
			triggeredCount++;
		} catch (error) {
			console.error(
				`[ERROR] Failed to trigger workflow for issue #${issue.number}: ${error}`
			);
		}

		// Add a delay between workflow triggers to avoid overwhelming the system
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	console.log(
		`[DEBUG] Script completed. Processed ${processedCount} issues, found ${candidateCount} candidates without duplicate comments, ${dryRun ? 'would trigger' : 'triggered'} ${triggeredCount} workflows`
	);
}

backfillDuplicateComments().catch(console.error);
