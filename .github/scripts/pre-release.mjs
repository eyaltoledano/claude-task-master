#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRootDir, runCommand, getPackageVersion, createAndPushTag } from './utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = findRootDir(__dirname);
const extensionPkgPath = join(rootDir, 'apps', 'extension', 'package.json');

console.log('🚀 Starting pre-release process...');

// Check if we're in RC mode
const preJsonPath = join(rootDir, '.changeset', 'pre.json');
if (!existsSync(preJsonPath)) {
	console.error('⚠️  Not in RC mode. Run "npx changeset pre enter rc" first.');
	process.exit(1);
}

try {
	const preJson = JSON.parse(readFileSync(preJsonPath, 'utf8'));
	if (preJson.tag !== 'rc') {
		console.error(`⚠️  Not in RC mode. Current tag: ${preJson.tag}`);
		process.exit(1);
	}
} catch (error) {
	console.error('Failed to read pre.json:', error.message);
	process.exit(1);
}

// Get current extension version
const extensionVersion = getPackageVersion(extensionPkgPath);
console.log(`Extension version: ${extensionVersion}`);

// Run changeset publish for npm packages
console.log('📦 Publishing npm packages...');
runCommand('npx', ['changeset', 'publish']);

// Create tag for extension pre-release if it doesn't exist
const extensionTag = `extension-rc@${extensionVersion}`;
const tagCreated = createAndPushTag(extensionTag);

if (tagCreated) {
	console.log('This will trigger the extension-pre-release workflow...');
}

console.log('✅ Pre-release process completed!');
