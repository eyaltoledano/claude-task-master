#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

// Find the root directory by looking for package.json with task-master-ai
export function findRootDir(startDir) {
	let currentDir = resolve(startDir);
	while (currentDir !== '/') {
		const pkgPath = join(currentDir, 'package.json');
		try {
			const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
			if (pkg.name === 'task-master-ai' || pkg.repository) {
				return currentDir;
			}
		} catch {}
		currentDir = dirname(currentDir);
	}
	throw new Error('Could not find root directory');
}

// Run a command with proper error handling
export function runCommand(command, args = [], options = {}) {
	console.log(`Running: ${command} ${args.join(' ')}`);
	const result = spawnSync(command, args, {
		encoding: 'utf8',
		stdio: 'inherit',
		...options
	});

	if (result.status !== 0) {
		console.error(`Command failed with exit code ${result.status}`);
		process.exit(result.status);
	}

	return result;
}

// Get package version from a package.json file
export function getPackageVersion(packagePath) {
	try {
		const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
		return pkg.version;
	} catch (error) {
		console.error(
			`Failed to read package version from ${packagePath}:`,
			error.message
		);
		process.exit(1);
	}
}

// Check if a git tag exists on remote
export function tagExistsOnRemote(tag, remote = 'origin') {
	const result = spawnSync('git', ['ls-remote', remote, tag], {
		encoding: 'utf8'
	});

	return result.status === 0 && result.stdout.trim() !== '';
}

// Create and push a git tag if it doesn't exist
export function createAndPushTag(tag, remote = 'origin') {
	// Check if tag already exists
	if (tagExistsOnRemote(tag, remote)) {
		console.log(`Tag ${tag} already exists on remote, skipping`);
		return false;
	}

	console.log(`Creating new tag: ${tag}`);

	// Create the tag locally
	const tagResult = spawnSync('git', ['tag', tag]);
	if (tagResult.status !== 0) {
		console.error('Failed to create tag:', tagResult.error || tagResult.stderr);
		process.exit(1);
	}

	// Push the tag to remote
	const pushResult = spawnSync('git', ['push', remote, tag]);
	if (pushResult.status !== 0) {
		console.error('Failed to push tag:', pushResult.error || pushResult.stderr);
		process.exit(1);
	}

	console.log(`✅ Successfully created and pushed tag: ${tag}`);
	return true;
}
