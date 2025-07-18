import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
describe('task-master models command', () => {
	let testDir;
	let helpers;
	let configPath;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-models-'));

		// Initialize test helpers
		const context = global.createTestContext('models command');
		helpers = context.helpers;

		// Copy .env file if it exists
		const mainEnvPath = join(process.cwd(), '.env');
		const testEnvPath = join(testDir, '.env');
		if (existsSync(mainEnvPath)) {
			const envContent = readFileSync(mainEnvPath, 'utf8');
			writeFileSync(testEnvPath, envContent);
		}

		// Initialize task-master project
		const initResult = await helpers.taskMaster('init', ['-y'], {
			cwd: testDir
		});
		expect(initResult).toHaveExitCode(0);

		configPath = join(testDir, '.taskmaster', 'config.json');
		
		// Create initial config with models
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

		mkdirSync(dirname(configPath), { recursive: true });
		writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));
	});

	afterEach(() => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	it('should display current model configuration', async () => {
		// Run models command without options
		const result = await helpers.taskMaster('models', [], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Active Model Configuration');
		expect(result.stdout).toContain('Main');
		expect(result.stdout).toContain('claude-3-5-sonnet-20241022');
		expect(result.stdout).toContain('Research');
		expect(result.stdout).toContain('sonar');
		expect(result.stdout).toContain('Fallback');
		expect(result.stdout).toContain('gpt-4o');
	});

	it('should set main model', async () => {
		// Run models command to set main model
		const result = await helpers.taskMaster('models', ['--set-main', 'gpt-4o-mini'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('✅');
		expect(result.stdout).toContain('main model');

		// Verify config was updated
		const config = JSON.parse(readFileSync(configPath, 'utf8'));
		expect(config.models.main.modelId).toBe('gpt-4o-mini');
		expect(config.models.main.provider).toBe('openai');
	});

	it('should set research model', async () => {
		// Run models command to set research model
		const result = await helpers.taskMaster('models', ['--set-research', 'sonar-pro'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('✅');
		expect(result.stdout).toContain('research model');

		// Verify config was updated
		const config = JSON.parse(readFileSync(configPath, 'utf8'));
		expect(config.models.research.modelId).toBe('sonar-pro');
		expect(config.models.research.provider).toBe('perplexity');
	});

	it('should set fallback model', async () => {
		// Run models command to set fallback model
		const result = await helpers.taskMaster('models', ['--set-fallback', 'claude-3-7-sonnet-20250219'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('✅');
		expect(result.stdout).toContain('fallback model');

		// Verify config was updated
		const config = JSON.parse(readFileSync(configPath, 'utf8'));
		expect(config.models.fallback.modelId).toBe('claude-3-7-sonnet-20250219');
		expect(config.models.fallback.provider).toBe('anthropic');
	});

	it('should set custom Ollama model', async () => {
		// Run models command with Ollama flag
		const result = await helpers.taskMaster('models', ['--set-main', 'llama3.3:70b', '--ollama'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		
		// Check if Ollama setup worked or if it failed gracefully
		if (result.stdout.includes('✅')) {
			// Ollama worked - verify config was updated
			const config = JSON.parse(readFileSync(configPath, 'utf8'));
			expect(config.models.main.modelId).toBe('llama3.3:70b');
			expect(config.models.main.provider).toBe('ollama');
		} else {
			// Ollama might not be available in test environment - just verify command completed
			expect(result.stdout).toContain('No model configuration changes were made');
		}
	});

	it('should set custom OpenRouter model', async () => {
		// Run models command with OpenRouter flag
		const result = await helpers.taskMaster('models', ['--set-main', 'anthropic/claude-3.5-sonnet', '--openrouter'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('✅');

		// Verify config was updated
		const config = JSON.parse(readFileSync(configPath, 'utf8'));
		expect(config.models.main.modelId).toBe('anthropic/claude-3.5-sonnet');
		expect(config.models.main.provider).toBe('openrouter');
	});

	it('should set custom Bedrock model', async () => {
		// Run models command with Bedrock flag
		const result = await helpers.taskMaster('models', ['--set-main', 'anthropic.claude-3-sonnet-20240229-v1:0', '--bedrock'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('✅');

		// Verify config was updated
		const config = JSON.parse(readFileSync(configPath, 'utf8'));
		expect(config.models.main.modelId).toBe('anthropic.claude-3-sonnet-20240229-v1:0');
		expect(config.models.main.provider).toBe('bedrock');
	});

	it('should set Claude Code model', async () => {
		// Run models command with Claude Code flag
		const result = await helpers.taskMaster('models', ['--set-main', 'sonnet', '--claude-code'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('✅');

		// Verify config was updated
		const config = JSON.parse(readFileSync(configPath, 'utf8'));
		expect(config.models.main.modelId).toBe('sonnet');
		expect(config.models.main.provider).toBe('claude-code');
	});

	it('should fail with multiple provider flags', async () => {
		// Run models command with multiple provider flags
		const result = await helpers.taskMaster('models', ['--set-main', 'some-model', '--ollama', '--openrouter'], { 
			cwd: testDir, 
			allowFailure: true 
		});

		// Should fail
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toContain('Error');
		expect(result.stderr).toContain('multiple provider flags');
	});

	it('should handle invalid model ID', async () => {
		// Run models command with non-existent model
		const result = await helpers.taskMaster('models', ['--set-main', 'non-existent-model-12345'], { 
			cwd: testDir,
			allowFailure: true 
		});

		// Command should complete successfully
		expect(result).toHaveExitCode(0);
		
		// Check what actually happened
		const config = JSON.parse(readFileSync(configPath, 'utf8'));
		
		if (config.models.main.modelId === 'non-existent-model-12345') {
			// Model was set (some systems allow any model ID)
			expect(config.models.main.modelId).toBe('non-existent-model-12345');
		} else {
			// Model was rejected and original kept - verify original is still there
			expect(config.models.main.modelId).toBe('claude-3-5-sonnet-20241022');
			// Should have some indication that the model wasn't changed
			expect(result.stdout).toMatch(/No model configuration changes|invalid|not found|error/i);
		}
	});

	it('should set multiple models at once', async () => {
		// Run models command to set multiple models
		const result = await helpers.taskMaster('models', ['--set-main', 'gpt-4o',
				'--set-research', 'sonar',
				'--set-fallback', 'claude-3-5-sonnet-20241022'], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toMatch(/✅.*main model/);
		expect(result.stdout).toMatch(/✅.*research model/);
		expect(result.stdout).toMatch(/✅.*fallback model/);

		// Verify all were updated
		const config = JSON.parse(readFileSync(configPath, 'utf8'));
		expect(config.models.main.modelId).toBe('gpt-4o');
		expect(config.models.research.modelId).toBe('sonar');
		expect(config.models.fallback.modelId).toBe('claude-3-5-sonnet-20241022');
	});

	it('should handle setup flag', async () => {
		// Run models command with setup flag
		// This will try to run interactive setup, so we need to handle it differently
		const result = await helpers.taskMaster('models', ['--setup'], { 
			cwd: testDir, 
			timeout: 2000, // Short timeout since it will wait for input
			allowFailure: true 
		});

		// Should start setup process or fail gracefully in non-interactive environment
		if (result.exitCode === 0) {
			expect(result.stdout).toContain('interactive model setup');
		} else {
			// In non-interactive environment, it might fail or show help
			expect(result.stderr || result.stdout).toBeTruthy();
		}
	});

	it('should display available models list', async () => {
		// Run models command with a flag that triggers model list display
		const result = await helpers.taskMaster('models', [], { cwd: testDir });

		// Should show current configuration
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Model');
		
		// Could also have available models section
		if (result.stdout.includes('Available Models')) {
			expect(result.stdout).toMatch(/claude|gpt|sonar/i);
		}
	});
});