#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAndPushTag, findRootDir } from './utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Ensure we have required fields
assert(pkg.name, 'package.json must have a name field');
assert(pkg.version, 'package.json must have a version field');

const tag = `${pkg.name}@${pkg.version}`;

// Create and push the tag if it doesn't exist
const tagCreated = createAndPushTag(tag);

// Trigger extension release workflow via workflow_dispatch
// (push events from GITHUB_TOKEN don't trigger workflows, but workflow_dispatch does)
if (tagCreated) {
	console.log(`Triggering extension-release workflow for ${tag}...`);
	const result = spawnSync(
		'gh',
		['workflow', 'run', 'extension-release.yml', '--ref', tag],
		{ encoding: 'utf8', stdio: 'inherit' }
	);
	if (result.status === 0) {
		console.log(`✅ Triggered extension release workflow for ${tag}`);
	} else {
		console.warn(
			`⚠️  Failed to trigger extension release workflow (non-critical)`
		);
	}
}
