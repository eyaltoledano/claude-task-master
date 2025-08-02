#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find the root directory by looking for package.json
function findRootDir(startDir) {
	let currentDir = resolve(startDir);
	while (currentDir !== '/') {
		if (existsSync(join(currentDir, 'package.json'))) {
			// Verify it's the root package.json by checking for expected fields
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

const rootDir = findRootDir(__dirname);

// Read the extension's package.json
const extensionDir = join(rootDir, 'apps', 'extension');
const pkgPath = join(extensionDir, 'package.json');

let pkg;
try {
	const pkgContent = readFileSync(pkgPath, 'utf8');
	pkg = JSON.parse(pkgContent);
} catch (error) {
	console.error('Failed to read package.json:', error.message);
	process.exit(1);
}

// Read root package.json for repository info
const rootPkgPath = join(rootDir, 'package.json');
let rootPkg;
try {
	const rootPkgContent = readFileSync(rootPkgPath, 'utf8');
	rootPkg = JSON.parse(rootPkgContent);
} catch (error) {
	console.error('Failed to read root package.json:', error.message);
	process.exit(1);
}

// Ensure we have required fields
assert(pkg.name, 'package.json must have a name field');
assert(pkg.version, 'package.json must have a version field');
assert(rootPkg.repository, 'root package.json must have a repository field');

const tag = `${pkg.name}@${pkg.version}`;

// Get repository URL from root package.json
const repoUrl = rootPkg.repository.url;

const { status, stdout, error } = spawnSync('git', ['ls-remote', repoUrl, tag]);

assert.equal(status, 0, error);

const exists = String(stdout).trim() !== '';

if (!exists) {
	console.log(`Creating new extension tag: ${tag}`);

	// Create the tag
	const tagResult = spawnSync('git', ['tag', tag]);
	if (tagResult.status !== 0) {
		console.error(
			'Failed to create tag:',
			tagResult.error || tagResult.stderr.toString()
		);
		process.exit(1);
	}

	// Push the tag
	const pushResult = spawnSync('git', ['push', 'origin', tag]);
	if (pushResult.status !== 0) {
		console.error(
			'Failed to push tag:',
			pushResult.error || pushResult.stderr.toString()
		);
		process.exit(1);
	}

	console.log(`✅ Successfully created and pushed tag: ${tag}`);
} else {
	console.log(`Extension tag already exists: ${tag}`);
}
