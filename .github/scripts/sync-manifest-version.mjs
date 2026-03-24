#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
	existsSync,
	readFileSync,
	readdirSync,
	unlinkSync,
	writeFileSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRootDir } from './utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = findRootDir(__dirname);

// Read the root package.json version
const pkgPath = join(rootDir, 'package.json');
const manifestPath = join(rootDir, 'manifest.json');

let pkg;
try {
	pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
} catch (error) {
	console.error('Failed to read package.json:', error.message);
	process.exit(1);
}

let manifest;
try {
	manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
	console.error('Failed to read manifest.json:', error.message);
	process.exit(1);
}

// Sync manifest version if different
if (manifest.version !== pkg.version) {
	console.log(
		`Syncing manifest.json version: ${manifest.version} → ${pkg.version}`
	);
	manifest.version = pkg.version;

	try {
		writeFileSync(
			manifestPath,
			JSON.stringify(manifest, null, '\t') + '\n',
			'utf8'
		);
		console.log(`✅ Updated manifest.json version to ${pkg.version}`);
	} catch (error) {
		console.error('Failed to write manifest.json:', error.message);
		process.exit(1);
	}
} else {
	console.log(
		`✓ manifest.json version already matches package.json (${pkg.version})`
	);
}

// Remove old .mcpb files
const files = readdirSync(rootDir);
for (const file of files) {
	if (file.endsWith('.mcpb')) {
		const filePath = join(rootDir, file);
		console.log(`Removing old bundle: ${file}`);
		unlinkSync(filePath);
	}
}

// Generate new .mcpb bundle
const bundleName = 'taskmaster.mcpb';
console.log(`Generating ${bundleName} for version ${pkg.version}...`);
const result = spawnSync('npx', ['mcpb', 'pack', '.', bundleName], {
	cwd: rootDir,
	encoding: 'utf8',
	stdio: 'inherit'
});

if (result.status !== 0) {
	console.error('Failed to generate MCPB bundle');
	process.exit(1);
}

// Verify the new bundle was created
if (existsSync(join(rootDir, bundleName))) {
	console.log(`✅ Generated ${bundleName}`);
} else {
	console.error(`Expected bundle ${bundleName} was not created`);
	process.exit(1);
}
