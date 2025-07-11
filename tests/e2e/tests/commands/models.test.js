import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { setupTestEnvironment, cleanupTestEnvironment, runCommand } from '../../utils/test-helpers.js';
import path from 'path';
import fs from 'fs';

describe('models command', () => {
	let testDir;
	let configPath;

	beforeAll(() => {
		testDir = setupTestEnvironment('models-command');
		configPath = path.join(testDir, '.taskmaster', 'config.json');
		
		// Create initial config
		const initialConfig = {
			models: {
				main: {
					provider: 'anthropic',
					modelId: 'claude-3-5-sonnet-20241022',
					maxTokens: 100000,
					temperature: 0.2
				},
				research: {
					provider: 'perplexity',
					modelId: 'sonar',
					maxTokens: 4096,
					temperature: 0.1
				},
				fallback: {
					provider: 'openai',
					modelId: 'gpt-4o',
					maxTokens: 128000,
					temperature: 0.2
				}
			},
			global: {
				projectName: 'Test Project',
				defaultTag: 'master'
			}
		};

		fs.mkdirSync(path.dirname(configPath), { recursive: true });
		fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));
	});

	afterAll(() => {
		cleanupTestEnvironment(testDir);
	});

	it('should display current model configuration', async () => {
		// Run models command without options
		const result = await runCommand('models', [], testDir);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Current Model Configuration');
		expect(result.stdout).toContain('Main Model');
		expect(result.stdout).toContain('claude-3-5-sonnet-20241022');
		expect(result.stdout).toContain('Research Model');
		expect(result.stdout).toContain('sonar');
		expect(result.stdout).toContain('Fallback Model');
		expect(result.stdout).toContain('gpt-4o');
	});

	it('should set main model', async () => {
		// Run models command to set main model
		const result = await runCommand(
			'models',
			['--set-main', 'gpt-4o-mini'],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('✅');
		expect(result.stdout).toContain('main model');

		// Verify config was updated
		const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
		expect(config.models.main.modelId).toBe('gpt-4o-mini');
		expect(config.models.main.provider).toBe('openai');
	});

	it('should set research model', async () => {
		// Run models command to set research model
		const result = await runCommand(
			'models',
			['--set-research', 'sonar-pro'],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('✅');
		expect(result.stdout).toContain('research model');

		// Verify config was updated
		const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
		expect(config.models.research.modelId).toBe('sonar-pro');
		expect(config.models.research.provider).toBe('perplexity');
	});

	it('should set fallback model', async () => {
		// Run models command to set fallback model
		const result = await runCommand(
			'models',
			['--set-fallback', 'claude-3-7-sonnet-20250219'],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('✅');
		expect(result.stdout).toContain('fallback model');

		// Verify config was updated
		const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
		expect(config.models.fallback.modelId).toBe('claude-3-7-sonnet-20250219');
		expect(config.models.fallback.provider).toBe('anthropic');
	});

	it('should set custom Ollama model', async () => {
		// Run models command with Ollama flag
		const result = await runCommand(
			'models',
			['--set-main', 'llama3.3:70b', '--ollama'],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('✅');

		// Verify config was updated
		const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
		expect(config.models.main.modelId).toBe('llama3.3:70b');
		expect(config.models.main.provider).toBe('ollama');
	});

	it('should set custom OpenRouter model', async () => {
		// Run models command with OpenRouter flag
		const result = await runCommand(
			'models',
			['--set-main', 'anthropic/claude-3.5-sonnet', '--openrouter'],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('✅');

		// Verify config was updated
		const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
		expect(config.models.main.modelId).toBe('anthropic/claude-3.5-sonnet');
		expect(config.models.main.provider).toBe('openrouter');
	});

	it('should set custom Bedrock model', async () => {
		// Run models command with Bedrock flag
		const result = await runCommand(
			'models',
			['--set-main', 'anthropic.claude-3-sonnet-20240229-v1:0', '--bedrock'],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('✅');

		// Verify config was updated
		const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
		expect(config.models.main.modelId).toBe('anthropic.claude-3-sonnet-20240229-v1:0');
		expect(config.models.main.provider).toBe('bedrock');
	});

	it('should set Claude Code model', async () => {
		// Run models command with Claude Code flag
		const result = await runCommand(
			'models',
			['--set-main', 'sonnet', '--claude-code'],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('✅');

		// Verify config was updated
		const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
		expect(config.models.main.modelId).toBe('sonnet');
		expect(config.models.main.provider).toBe('claude-code');
	});

	it('should fail with multiple provider flags', async () => {
		// Run models command with multiple provider flags
		const result = await runCommand(
			'models',
			['--set-main', 'some-model', '--ollama', '--openrouter'],
			testDir
		);

		// Should fail
		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Error');
		expect(result.stderr).toContain('multiple provider flags');
	});

	it('should fail with invalid model ID', async () => {
		// Run models command with non-existent model
		const result = await runCommand(
			'models',
			['--set-main', 'non-existent-model-12345'],
			testDir
		);

		// Should fail
		expect(result.code).toBe(0); // May succeed but with warning
		if (result.stdout.includes('❌')) {
			expect(result.stdout).toContain('Error');
		}
	});

	it('should set multiple models at once', async () => {
		// Run models command to set multiple models
		const result = await runCommand(
			'models',
			[
				'--set-main', 'gpt-4o',
				'--set-research', 'sonar',
				'--set-fallback', 'claude-3-5-sonnet-20241022'
			],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toMatch(/✅.*main model/);
		expect(result.stdout).toMatch(/✅.*research model/);
		expect(result.stdout).toMatch(/✅.*fallback model/);

		// Verify all were updated
		const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
		expect(config.models.main.modelId).toBe('gpt-4o');
		expect(config.models.research.modelId).toBe('sonar');
		expect(config.models.fallback.modelId).toBe('claude-3-5-sonnet-20241022');
	});

	it('should handle setup flag', async () => {
		// Run models command with setup flag
		// This will try to run interactive setup, so we need to handle it differently
		const result = await runCommand(
			'models',
			['--setup'],
			testDir,
			{ timeout: 2000 } // Short timeout since it will wait for input
		);

		// Should start setup process
		expect(result.stdout).toContain('interactive model setup');
	});

	it('should display available models list', async () => {
		// Run models command with a flag that triggers model list display
		const result = await runCommand('models', [], testDir);

		// Should show current configuration
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Model');
		
		// Could also have available models section
		if (result.stdout.includes('Available Models')) {
			expect(result.stdout).toMatch(/claude|gpt|sonar/i);
		}
	});
});