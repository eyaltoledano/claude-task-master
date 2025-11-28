#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

// Define allowed public packages that can be referenced in changesets
const PUBLIC_PACKAGES = ['task-master-ai', 'extension'];

/**
 * Parse a changeset file and extract package names from the frontmatter
 * This uses a simple YAML parser that's sufficient for changeset files
 * and doesn't require external dependencies.
 *
 * @param {string} filePath - Path to the changeset file
 * @returns {string[]} - Array of package names
 * @throws {Error} - If file cannot be read or parsed
 */
function parseChangesetFile(filePath) {
	try {
		const content = readFileSync(filePath, 'utf-8');

		// Extract frontmatter between --- markers
		const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

		if (!frontmatterMatch) {
			throw new Error('No valid frontmatter found (missing --- delimiters)');
		}

		const frontmatter = frontmatterMatch[1];
		const packages = [];

		// Parse simple YAML format: 'package-name': version
		// This handles the standard changeset format without needing a full YAML parser
		const lines = frontmatter.split(/\r?\n/);

		for (const line of lines) {
			const trimmed = line.trim();

			// Skip empty lines and comments
			if (!trimmed || trimmed.startsWith('#')) {
				continue;
			}

			// Match package declarations: 'package-name': version or "package-name": version
			const match = trimmed.match(/^['"]?([^'":\s]+)['"]?\s*:\s*.+$/);

			if (match) {
				packages.push(match[1]);
			}
		}

		if (packages.length === 0) {
			throw new Error('No packages found in frontmatter');
		}

		return packages;
	} catch (error) {
		if (error.code === 'ENOENT') {
			throw new Error(`File not found: ${filePath}`);
		}
		throw new Error(`Failed to parse ${filePath}: ${error.message}`);
	}
}

/**
 * Validate all changeset files in the .changeset directory
 * @returns {boolean} - True if all changesets are valid
 */
function validateChangesets() {
	try {
		const changesetsDir = join(rootDir, '.changeset');
		const files = readdirSync(changesetsDir);

		const errors = [];

		for (const file of files) {
			// Skip config files and README
			if (
				file === 'config.json' ||
				file === 'README.md' ||
				!file.endsWith('.md')
			) {
				continue;
			}

			const filePath = join(changesetsDir, file);

			try {
				const packages = parseChangesetFile(filePath);

				for (const pkg of packages) {
					// Only allow packages in the PUBLIC_PACKAGES whitelist
					if (!PUBLIC_PACKAGES.includes(pkg)) {
						errors.push({
							file,
							package: pkg,
							message: `Invalid package "${pkg}". Only these packages are allowed: ${PUBLIC_PACKAGES.join(', ')}`
						});
					}
				}
			} catch (error) {
				errors.push({
					file,
					package: 'N/A',
					message: `Parse error: ${error.message}`
				});
			}
		}

		// Print results
		if (errors.length === 0) {
			console.log('✅ All changesets are valid!');
			return true;
		}

		console.error('\n❌ Changeset validation failed:\n');
		for (const error of errors) {
			console.error(`  ${error.file}:`);
			console.error(`    ${error.message}`);
			console.error('');
		}

		return false;
	} catch (error) {
		console.error(`\n❌ Fatal error during validation: ${error.message}\n`);
		return false;
	}
}

const isValid = validateChangesets();
process.exit(isValid ? 0 : 1);
