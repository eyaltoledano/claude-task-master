import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { setupTestEnvironment, cleanupTestEnvironment, runCommand } from '../../utils/test-helpers.js';
import path from 'path';
import fs from 'fs';

describe('init command', () => {
	let testDir;

	beforeAll(() => {
		testDir = setupTestEnvironment('init-command');
	});

	afterAll(() => {
		cleanupTestEnvironment(testDir);
	});

	it('should initialize a new project with default values', async () => {
		// Run init command with --yes flag to skip prompts
		const result = await runCommand(
			'init',
			['--yes', '--skip-install', '--no-aliases', '--no-git'],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Initializing project');

		// Check that .taskmaster directory was created
		const taskMasterDir = path.join(testDir, '.taskmaster');
		expect(fs.existsSync(taskMasterDir)).toBe(true);

		// Check that config.json was created
		const configPath = path.join(taskMasterDir, 'config.json');
		expect(fs.existsSync(configPath)).toBe(true);

		// Verify config content
		const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
		expect(config).toHaveProperty('global');
		expect(config).toHaveProperty('models');
		expect(config.global.projectName).toBeTruthy();

		// Check that templates directory was created
		const templatesDir = path.join(taskMasterDir, 'templates');
		expect(fs.existsSync(templatesDir)).toBe(true);

		// Check that docs directory was created
		const docsDir = path.join(taskMasterDir, 'docs');
		expect(fs.existsSync(docsDir)).toBe(true);
	});

	it('should initialize with custom project name and description', async () => {
		const customName = 'MyTestProject';
		const customDescription = 'A test project for task-master';
		const customAuthor = 'Test Author';

		// Run init command with custom values
		const result = await runCommand(
			'init',
			[
				'--yes',
				'--name', customName,
				'--description', customDescription,
				'--author', customAuthor,
				'--skip-install',
				'--no-aliases',
				'--no-git'
			],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);

		// Check config was created with custom values
		const configPath = path.join(testDir, '.taskmaster', 'config.json');
		const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
		
		expect(config.global.projectName).toBe(customName);
		// Note: description and author might be stored elsewhere or in package.json
	});

	it('should initialize with specific rules', async () => {
		// Run init command with specific rules
		const result = await runCommand(
			'init',
			[
				'--yes',
				'--rules', 'cursor,windsurf',
				'--skip-install',
				'--no-aliases',
				'--no-git'
			],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Initializing project');

		// Check that rules were created
		const rulesFiles = fs.readdirSync(testDir);
		const ruleFiles = rulesFiles.filter(f => f.includes('rules') || f.includes('.cursorrules') || f.includes('.windsurfrules'));
		expect(ruleFiles.length).toBeGreaterThan(0);
	});

	it('should handle dry-run option', async () => {
		// Run init command with dry-run
		const result = await runCommand(
			'init',
			['--yes', '--dry-run'],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('DRY RUN');

		// Check that no actual files were created
		const taskMasterDir = path.join(testDir, '.taskmaster');
		expect(fs.existsSync(taskMasterDir)).toBe(false);
	});

	it('should fail when initializing in already initialized project', async () => {
		// First initialization
		await runCommand(
			'init',
			['--yes', '--skip-install', '--no-aliases', '--no-git'],
			testDir
		);

		// Second initialization should fail
		const result = await runCommand(
			'init',
			['--yes', '--skip-install', '--no-aliases', '--no-git'],
			testDir
		);

		// Verify failure
		expect(result.code).toBe(1);
		expect(result.stderr).toContain('already exists');
	});

	it('should initialize with version option', async () => {
		const customVersion = '1.2.3';

		// Run init command with custom version
		const result = await runCommand(
			'init',
			[
				'--yes',
				'--version', customVersion,
				'--skip-install',
				'--no-aliases',
				'--no-git'
			],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);

		// If package.json is created, check version
		const packagePath = path.join(testDir, 'package.json');
		if (fs.existsSync(packagePath)) {
			const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
			expect(packageJson.version).toBe(customVersion);
		}
	});

	it('should handle git options correctly', async () => {
		// Run init command with git option
		const result = await runCommand(
			'init',
			[
				'--yes',
				'--git',
				'--git-tasks',
				'--skip-install',
				'--no-aliases'
			],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);

		// Check if .git directory was created
		const gitDir = path.join(testDir, '.git');
		expect(fs.existsSync(gitDir)).toBe(true);

		// Check if .gitignore was created
		const gitignorePath = path.join(testDir, '.gitignore');
		if (fs.existsSync(gitignorePath)) {
			const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
			// When --git-tasks is false, tasks should be in .gitignore
			if (!result.stdout.includes('git-tasks')) {
				expect(gitignoreContent).toContain('.taskmaster/tasks');
			}
		}
	});
});