import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config as dotenvConfig } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const projectRoot = join(__dirname, '../../..');
dotenvConfig({ path: join(projectRoot, '.env') });

export const testConfig = {
  // Paths
  paths: {
    projectRoot,
    sourceDir: projectRoot,
    baseTestDir: join(projectRoot, 'tests/e2e/_runs'),
    logDir: join(projectRoot, 'tests/e2e/log'),
    samplePrdSource: join(projectRoot, 'tests/fixtures/sample-prd.txt'),
    mainEnvFile: join(projectRoot, '.env'),
    supportedModelsFile: join(projectRoot, 'scripts/modules/supported-models.json')
  },

  // Test settings
  settings: {
    runVerificationTest: true,
    parallelTestGroups: 4, // Number of parallel test groups
    timeout: 600000, // 10 minutes default timeout
    retryAttempts: 2
  },

  // Provider test configuration
  providers: [
    { name: 'anthropic', model: 'claude-3-7-sonnet-20250219', flags: [] },
    { name: 'openai', model: 'gpt-4o', flags: [] },
    { name: 'google', model: 'gemini-2.5-pro-preview-05-06', flags: [] },
    { name: 'perplexity', model: 'sonar-pro', flags: [] },
    { name: 'xai', model: 'grok-3', flags: [] },
    { name: 'openrouter', model: 'anthropic/claude-3.7-sonnet', flags: [] }
  ],

  // Test prompts
  prompts: {
    addTask: 'Create a task to implement user authentication using OAuth 2.0 with Google as the provider. Include steps for registering the app, handling the callback, and storing user sessions.',
    updateTask: 'Update backend server setup: Ensure CORS is configured to allow requests from the frontend origin.',
    updateFromTask: 'Refactor the backend storage module to use a simple JSON file (storage.json) instead of an in-memory object for persistence. Update relevant tasks.',
    updateSubtask: 'Implementation note: Remember to handle potential API errors and display a user-friendly message.'
  },

  // LLM Analysis settings
  llmAnalysis: {
    enabled: true,
    model: 'claude-3-7-sonnet-20250219',
    provider: 'anthropic',
    maxTokens: 3072
  }
};

// Export test groups for parallel execution
export const testGroups = {
  setup: ['setup'],
  core: ['core'],
  providers: ['providers'],
  advanced: ['advanced']
};