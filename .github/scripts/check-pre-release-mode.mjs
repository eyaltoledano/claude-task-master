#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get context from command line argument or environment
const context = process.argv[2] || process.env.GITHUB_WORKFLOW || 'manual';

function findRootDir(startDir) {
	let currentDir = resolve(startDir);
	while (currentDir !== '/') {
		if (existsSync(join(currentDir, 'package.json'))) {
			try {
				const pkg = JSON.parse(
					readFileSync(join(currentDir, 'package.json'), 'utf8')
				);
				if (pkg.name === 'task-master-ai' || pkg.repository) {
					return currentDir;
				}
			} catch {}
		}
		currentDir = dirname(currentDir);
	}
	throw new Error('Could not find root directory');
}

function checkPreReleaseMode() {
	console.log('🔍 Checking if branch is in pre-release mode...');

	const rootDir = findRootDir(__dirname);
	const preJsonPath = join(rootDir, '.changeset', 'pre.json');

	// Check if pre.json exists
	if (!existsSync(preJsonPath)) {
		console.log('✅ Not in active pre-release mode - safe to proceed');
		process.exit(0);
	}

	try {
		// Read and parse pre.json
		const preJsonContent = readFileSync(preJsonPath, 'utf8');
		const preJson = JSON.parse(preJsonContent);

		// Check if we're in active pre-release mode
		if (preJson.mode === 'pre') {
			console.error('❌ ERROR: This branch is in active pre-release mode!');
			console.error('');

			// Provide context-specific error messages
			if (context === 'Release Check' || context === 'pull_request') {
				console.error(
					'Pre-release mode must be exited before merging to main.'
				);
				console.error('');
				console.error(
					'To fix this, run the following commands in your branch:'
				);
				console.error('  npx changeset pre exit');
				console.error('  git add -u');
				console.error('  git commit -m "chore: exit pre-release mode"');
				console.error('  git push');
				console.error('');
				console.error('Then update this pull request.');
			} else if (context === 'Release' || context === 'main') {
				console.error(
					'Pre-release mode should only be used on feature branches, not main.'
				);
				console.error('');
				console.error('To fix this, run the following commands locally:');
				console.error('  npx changeset pre exit');
				console.error('  git add -u');
				console.error('  git commit -m "chore: exit pre-release mode"');
				console.error('  git push origin main');
				console.error('');
				console.error('Then re-run this workflow.');
			} else {
				console.error('Pre-release mode must be exited before proceeding.');
				console.error('');
				console.error('To fix this, run the following commands:');
				console.error('  npx changeset pre exit');
				console.error('  git add -u');
				console.error('  git commit -m "chore: exit pre-release mode"');
				console.error('  git push');
			}

			process.exit(1);
		}

		console.log('✅ Not in active pre-release mode - safe to proceed');
		process.exit(0);
	} catch (error) {
		console.error(`❌ ERROR: Unable to parse .changeset/pre.json – aborting.`);
		console.error(`Error details: ${error.message}`);
		process.exit(1);
	}
}

// Run the check
checkPreReleaseMode();
