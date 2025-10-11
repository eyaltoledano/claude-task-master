#!/usr/bin/env node
/**
 * Build script for Task Master AI Claude Code Plugin
 *
 * Packages the plugin from source assets into a distributable format.
 * Run this before publishing or testing the plugin.
 *
 * Usage:
 *   npm run build:plugin
 *   tsx src/build.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Navigate from packages/claude-code-plugin/src to project root
const PLUGIN_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(PLUGIN_DIR, '..', '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets', 'claude');
const OUTPUT_DIR = PLUGIN_DIR;
const PACKAGE_JSON = path.join(ROOT_DIR, 'package.json');

interface PackageJson {
	version: string;
	description: string;
	author: string;
	license: string;
	repository?: {
		type: string;
		url: string;
	};
	homepage?: string;
	bugs?: {
		url: string;
	};
}

interface BuildMetadata {
	version: string;
	buildDate: string;
	nodeVersion: string;
	builtFrom: string;
}

console.log('🏗️  Building Task Master AI Claude Code Plugin...\n');

/**
 * Recursively copy directory contents
 */
function copyRecursive(src: string, dest: string): void {
	if (!fs.existsSync(src)) {
		console.error(`❌ Source directory not found: ${src}`);
		process.exit(1);
	}

	const stats = fs.statSync(src);

	if (stats.isDirectory()) {
		if (!fs.existsSync(dest)) {
			fs.mkdirSync(dest, { recursive: true });
		}

		const entries = fs.readdirSync(src);
		for (const entry of entries) {
			// Skip hidden files and directories except .claude-plugin and .mcp.json
			if (
				entry.startsWith('.') &&
				entry !== '.claude-plugin' &&
				entry !== '.mcp.json'
			) {
				continue;
			}

			copyRecursive(path.join(src, entry), path.join(dest, entry));
		}
	} else {
		fs.copyFileSync(src, dest);
	}
}

/**
 * Clean output directory (except src, node_modules, and special files)
 */
function cleanOutput(): void {
	console.log('🧹 Cleaning output directory...');

	if (fs.existsSync(OUTPUT_DIR)) {
		const entries = fs.readdirSync(OUTPUT_DIR);
		for (const entry of entries) {
			// Keep these directories/files
			if (
				entry === 'node_modules' ||
				entry === 'src' ||
				entry === '.gitignore' ||
				entry === 'package.json' ||
				entry === 'tsconfig.json'
			) {
				continue;
			}

			const fullPath = path.join(OUTPUT_DIR, entry);
			fs.rmSync(fullPath, { recursive: true, force: true });
		}
	}

	console.log('✓ Output directory cleaned\n');
}

/**
 * Copy commands from assets
 */
function copyCommands(): void {
	console.log('📋 Copying commands...');

	const src = path.join(ASSETS_DIR, 'commands');
	const dest = path.join(OUTPUT_DIR, 'commands');

	copyRecursive(src, dest);

	const count = countFiles(dest, '.md');
	console.log(`✓ Copied ${count} command files\n`);
}

/**
 * Copy agents from assets
 */
function copyAgents(): void {
	console.log('🤖 Copying agents...');

	const src = path.join(ASSETS_DIR, 'agents');
	const dest = path.join(OUTPUT_DIR, 'agents');

	copyRecursive(src, dest);

	const count = countFiles(dest, '.md');
	console.log(`✓ Copied ${count} agent files\n`);
}

/**
 * Count files with specific extension in directory
 */
function countFiles(dir: string, ext: string): number {
	let count = 0;

	function walk(d: string): void {
		const entries = fs.readdirSync(d);
		for (const entry of entries) {
			const fullPath = path.join(d, entry);
			const stats = fs.statSync(fullPath);

			if (stats.isDirectory()) {
				walk(fullPath);
			} else if (entry.endsWith(ext)) {
				count++;
			}
		}
	}

	walk(dir);
	return count;
}

/**
 * Read version from root package.json
 */
function getVersion(): string {
	const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8')) as PackageJson;
	return pkg.version;
}

/**
 * Create plugin manifest
 */
function createPluginManifest(): void {
	console.log('📝 Creating plugin manifest...');

	const version = getVersion();
	const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8')) as PackageJson;

	const manifest = {
		name: 'task-master-ai',
		displayName: 'Task Master AI',
		description: pkg.description,
		version: version,
		author: {
			name: pkg.author,
			url: pkg.repository?.url?.replace('git+', '').replace('.git', '')
		},
		repository: {
			type: 'git',
			url: pkg.repository?.url?.replace('git+', '')
		},
		homepage: pkg.homepage,
		bugs: {
			url: pkg.bugs?.url
		},
		license: pkg.license,
		keywords: [
			'task-management',
			'ai',
			'workflow',
			'orchestration',
			'automation',
			'mcp',
			'development',
			'productivity'
		],
		engines: {
			'claude-code': '>=1.0.0'
		}
	};

	const pluginDir = path.join(OUTPUT_DIR, '.claude-plugin');
	fs.mkdirSync(pluginDir, { recursive: true });

	const manifestPath = path.join(pluginDir, 'plugin.json');
	fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

	console.log(`✓ Created plugin manifest (v${version})\n`);
}

/**
 * Create MCP configuration
 */
function createMcpConfig(): void {
	console.log('🔌 Creating MCP configuration...');

	const mcpConfig = {
		mcpServers: {
			'task-master-ai': {
				type: 'stdio',
				command: 'npx',
				args: ['-y', 'task-master-ai'],
				env: {
					ANTHROPIC_API_KEY: '',
					PERPLEXITY_API_KEY: '',
					OPENAI_API_KEY: '',
					GOOGLE_API_KEY: '',
					XAI_API_KEY: '',
					OPENROUTER_API_KEY: '',
					MISTRAL_API_KEY: '',
					AZURE_OPENAI_API_KEY: '',
					OLLAMA_API_KEY: ''
				}
			}
		}
	};

	const mcpPath = path.join(OUTPUT_DIR, '.mcp.json');
	fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, '\t') + '\n');

	console.log('✓ Created MCP configuration\n');
}

/**
 * Update package.json with build metadata
 */
function updatePackageJson(): void {
	console.log('📦 Updating package.json...');

	const version = getVersion();
	const pkgPath = path.join(OUTPUT_DIR, 'package.json');

	let pluginPkg: Record<string, unknown>;

	if (fs.existsSync(pkgPath)) {
		pluginPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
	} else {
		pluginPkg = {
			name: '@tm/claude-code-plugin',
			type: 'module',
			private: true
		};
	}

	// Update version and metadata
	pluginPkg.version = version;
	pluginPkg.description =
		'Task Master AI plugin for Claude Code - Build tooling and assets';

	// Ensure scripts exist
	if (!pluginPkg.scripts || typeof pluginPkg.scripts !== 'object') {
		pluginPkg.scripts = {};
	}

	const scripts = pluginPkg.scripts as Record<string, string>;
	scripts.build = 'tsx src/build.ts';

	// Ensure devDependencies
	if (
		!pluginPkg.devDependencies ||
		typeof pluginPkg.devDependencies !== 'object'
	) {
		pluginPkg.devDependencies = {};
	}

	const devDeps = pluginPkg.devDependencies as Record<string, string>;
	if (!devDeps.tsx) {
		devDeps.tsx = '^4.20.4';
	}
	if (!devDeps.typescript) {
		devDeps.typescript = '^5.9.2';
	}
	if (!devDeps['@types/node']) {
		devDeps['@types/node'] = '^20.0.0';
	}

	fs.writeFileSync(pkgPath, JSON.stringify(pluginPkg, null, '\t') + '\n');

	console.log('✓ Updated package.json\n');
}

/**
 * Copy documentation files
 */
function copyDocumentation(): void {
	console.log('📚 Copying documentation...');

	// Copy README template if it exists
	const readmeSrc = path.join(ASSETS_DIR, 'PLUGIN_README.md');
	const readmeDest = path.join(OUTPUT_DIR, 'README.dist.md');

	if (fs.existsSync(readmeSrc)) {
		fs.copyFileSync(readmeSrc, readmeDest);
		console.log('✓ Copied README template');
	} else {
		createBasicReadme();
		console.log('✓ Created basic README');
	}

	// Copy LICENSE
	const licenseSrc = path.join(ROOT_DIR, 'LICENSE');
	const licenseDest = path.join(OUTPUT_DIR, 'LICENSE');

	if (fs.existsSync(licenseSrc)) {
		fs.copyFileSync(licenseSrc, licenseDest);
		console.log('✓ Copied LICENSE');
	} else {
		console.log('⚠️  LICENSE file not found in root');
	}

	console.log('');
}

/**
 * Create basic README for distribution
 */
function createBasicReadme(): void {
	const version = getVersion();
	const readme = `# Task Master AI - Claude Code Plugin

> AI-powered task management system for ambitious development workflows

Version: ${version}

## Installation

\`\`\`
/plugin marketplace add your-org/task-master-marketplace
/plugin install task-master-ai@your-marketplace
\`\`\`

## Features

- 49 slash commands for comprehensive task management
- 3 specialized AI agents (orchestrator, executor, checker)
- MCP server integration
- Complexity analysis and auto-expansion
- Dependency management and validation

## Quick Start

\`\`\`
/tm:init
/tm:parse-prd
/tm:next
\`\`\`

## Documentation

For complete documentation, visit:
https://github.com/eyaltoledano/claude-task-master

## License

MIT WITH Commons-Clause
`;

	const readmePath = path.join(OUTPUT_DIR, 'README.dist.md');
	fs.writeFileSync(readmePath, readme);
}

/**
 * Create build metadata file
 */
function createBuildMetadata(): void {
	const metadata: BuildMetadata = {
		version: getVersion(),
		buildDate: new Date().toISOString(),
		nodeVersion: process.version,
		builtFrom: 'assets/claude'
	};

	const metadataPath = path.join(OUTPUT_DIR, '.build-metadata.json');
	fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
}

/**
 * Validate the built plugin
 */
function validatePlugin(): void {
	console.log('✅ Validating plugin...');

	const requiredFiles = [
		'.claude-plugin/plugin.json',
		'.mcp.json',
		'package.json'
	];

	const requiredDirs = ['commands', 'agents'];

	let valid = true;

	// Check required files
	for (const file of requiredFiles) {
		const filePath = path.join(OUTPUT_DIR, file);
		if (!fs.existsSync(filePath)) {
			console.error(`❌ Missing required file: ${file}`);
			valid = false;
		}
	}

	// Check required directories
	for (const dir of requiredDirs) {
		const dirPath = path.join(OUTPUT_DIR, dir);
		if (!fs.existsSync(dirPath)) {
			console.error(`❌ Missing required directory: ${dir}`);
			valid = false;
		}
	}

	// Validate JSON files
	const jsonFiles = ['.claude-plugin/plugin.json', '.mcp.json', 'package.json'];

	for (const file of jsonFiles) {
		const filePath = path.join(OUTPUT_DIR, file);
		try {
			JSON.parse(fs.readFileSync(filePath, 'utf8'));
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(`❌ Invalid JSON in ${file}: ${errorMessage}`);
			valid = false;
		}
	}

	if (!valid) {
		console.error('\n❌ Plugin validation failed');
		process.exit(1);
	}

	console.log('✓ Plugin validation passed\n');
}

/**
 * Print build summary
 */
function printSummary(): void {
	const version = getVersion();
	const commandCount = countFiles(path.join(OUTPUT_DIR, 'commands'), '.md');
	const agentCount = countFiles(path.join(OUTPUT_DIR, 'agents'), '.md');
	const totalFiles = countAllFiles(OUTPUT_DIR);

	console.log('═══════════════════════════════════════════════════════');
	console.log('  Task Master AI - Claude Code Plugin Build Complete');
	console.log('═══════════════════════════════════════════════════════\n');
	console.log(`📦 Version:      ${version}`);
	console.log(`📍 Output:       ${path.relative(ROOT_DIR, OUTPUT_DIR)}`);
	console.log(`📊 Total Files:  ${totalFiles}`);
	console.log(`📋 Commands:     ${commandCount}`);
	console.log(`🤖 Agents:       ${agentCount}`);
	console.log('\n✨ Plugin is ready for distribution!\n');
	console.log('Next steps:');
	console.log('  1. Test locally:  Create test marketplace');
	console.log('  2. Distribute:    Publish to marketplace\n');
}

/**
 * Count all files in directory
 */
function countAllFiles(dir: string): number {
	let count = 0;

	function walk(d: string): void {
		const entries = fs.readdirSync(d);
		for (const entry of entries) {
			// Skip node_modules, src, and certain hidden files
			if (
				entry === 'node_modules' ||
				entry === 'src' ||
				(entry.startsWith('.') &&
					entry !== '.claude-plugin' &&
					entry !== '.mcp.json' &&
					entry !== '.build-metadata.json')
			) {
				continue;
			}

			const fullPath = path.join(d, entry);
			const stats = fs.statSync(fullPath);

			if (stats.isDirectory()) {
				walk(fullPath);
			} else {
				count++;
			}
		}
	}

	walk(dir);
	return count;
}

/**
 * Main build process
 */
async function build(): Promise<void> {
	try {
		cleanOutput();
		copyCommands();
		copyAgents();
		createPluginManifest();
		createMcpConfig();
		updatePackageJson();
		copyDocumentation();
		createBuildMetadata();
		validatePlugin();
		printSummary();

		process.exit(0);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorStack = error instanceof Error ? error.stack : '';
		console.error('\n❌ Build failed:', errorMessage);
		console.error(errorStack);
		process.exit(1);
	}
}

// Run build
build();
