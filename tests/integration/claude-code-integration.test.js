import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateTextService } from '../../scripts/modules/ai-services-unified.js';
import {
	getConfig,
	isApiKeySet
} from '../../scripts/modules/config-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Claude Code Integration Tests', () => {
	const testProjectRoot = path.join(__dirname, 'test-project');
	const configPath = path.join(testProjectRoot, '.taskmasterconfig');

	beforeAll(() => {
		// Create test project directory
		if (!fs.existsSync(testProjectRoot)) {
			fs.mkdirSync(testProjectRoot, { recursive: true });
		}
	});

	afterAll(() => {
		// Clean up test project directory
		if (fs.existsSync(testProjectRoot)) {
			fs.rmSync(testProjectRoot, { recursive: true, force: true });
		}
	});

	beforeEach(() => {
		// Clean up any existing config
		if (fs.existsSync(configPath)) {
			fs.unlinkSync(configPath);
		}
	});

	describe('Configuration', () => {
		it('should load claude-code as a valid provider', () => {
			const config = {
				models: {
					main: {
						provider: 'claude-code',
						modelId: 'default',
						maxTokens: 120000,
						temperature: 0.2
					},
					research: {
						provider: 'perplexity',
						modelId: 'sonar-pro',
						maxTokens: 8700,
						temperature: 0.1
					}
				},
				global: {
					logLevel: 'info',
					debug: false
				}
			};

			fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

			const loadedConfig = getConfig(testProjectRoot);
			expect(loadedConfig.models.main.provider).toBe('claude-code');
			expect(loadedConfig.models.main.modelId).toBe('default');
		});

		it('should not require API key for claude-code', () => {
			expect(isApiKeySet('claude-code')).toBe(true);
		});
	});

	describe('AI Service Integration', () => {
		it('should handle claude-code provider in generateTextService', async () => {
			// This test verifies that claude-code is properly registered in ai-services-unified
			// In a real test environment, you would mock the Claude Code execution

			// Create config with claude-code as main provider
			const config = {
				models: {
					main: {
						provider: 'claude-code',
						modelId: 'default',
						maxTokens: 1000,
						temperature: 0.2
					}
				}
			};

			fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

			// Skip this test in CI or when Claude Code is not installed
			// The test would require mocking at module load time which is complex
			// and the unit tests already cover the functionality
			if (process.env.CI || !process.env.CLAUDE_CODE_INSTALLED) {
				console.log('Skipping integration test - requires Claude Code CLI');
				return;
			}

			try {
				const result = await generateTextService({
					prompt: 'Test prompt',
					systemPrompt: 'Test system prompt',
					role: 'main',
					projectRoot: testProjectRoot,
					maxRetries: 1
				});

				expect(result).toBeDefined();
				expect(result.mainResult).toBeTruthy();
				expect(result.telemetryData.mainProvider).toBe('claude-code');
				expect(result.telemetryData.mainModelId).toBe('default');
				expect(result.telemetryData.totalCost).toBe(0);
			} catch (error) {
				// If Claude Code is not installed, skip this test
				if (
					error.message.includes('Claude Code CLI') ||
					error.message.includes('Unauthorized')
				) {
					console.log('Skipping test - Claude Code CLI not available');
					return;
				}
				throw error;
			}
		});
	});

	describe('Model Configuration', () => {
		it('should load claude-code from supported-models.json', async () => {
			const supportedModelsPath = path.join(
				__dirname,
				'../../scripts/modules/supported-models.json'
			);
			const supportedModels = JSON.parse(
				fs.readFileSync(supportedModelsPath, 'utf-8')
			);

			expect(supportedModels['claude-code']).toBeDefined();
			expect(Array.isArray(supportedModels['claude-code'])).toBe(true);
			expect(supportedModels['claude-code'].length).toBeGreaterThan(0);

			const claudeCodeModel = supportedModels['claude-code'][0];
			expect(claudeCodeModel.id).toBe('default');
			expect(claudeCodeModel.cost_per_1m_tokens.input).toBe(0);
			expect(claudeCodeModel.cost_per_1m_tokens.output).toBe(0);
			expect(claudeCodeModel.allowed_roles).toContain('main');
			expect(claudeCodeModel.allowed_roles).toContain('fallback');
		});
	});
});
