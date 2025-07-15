/**
 * Environment Variable Overrides for Flow Configuration
 * Handles mapping environment variables to configuration values
 */

/**
 * Apply environment variable overrides to configuration
 * Follows best practice of env vars taking precedence
 * Reuses existing Task Master .env file keys where possible
 */
export function applyEnvironmentOverrides(configData) {
  const env = process.env;

  // Environment overrides
  if (env.NODE_ENV) {
    configData.nodeEnv = env.NODE_ENV;
  }

  // VibeKit overrides
  if (!configData.vibekit) configData.vibekit = {};
  
  if (env.VIBEKIT_ENABLED !== undefined) {
    configData.vibekit.enabled = env.VIBEKIT_ENABLED === 'true';
  }
  
  if (env.VIBEKIT_DEFAULT_AGENT) {
    configData.vibekit.defaultAgent = env.VIBEKIT_DEFAULT_AGENT;
  }
  
  if (env.VIBEKIT_STREAMING_ENABLED !== undefined) {
    configData.vibekit.streamingEnabled = env.VIBEKIT_STREAMING_ENABLED === 'true';
  }
  
  if (env.VIBEKIT_GITHUB_INTEGRATION !== undefined) {
    configData.vibekit.githubIntegration = env.VIBEKIT_GITHUB_INTEGRATION === 'true';
  }
  
  if (env.VIBEKIT_WORKING_DIRECTORY) {
    configData.vibekit.workingDirectory = env.VIBEKIT_WORKING_DIRECTORY;
  }

  // VibeKit SDK overrides
  if (!configData.vibekit.sdk) configData.vibekit.sdk = {};
  
  if (env.VIBEKIT_SDK_VERSION) {
    configData.vibekit.sdk.version = env.VIBEKIT_SDK_VERSION;
  }
  
  if (env.VIBEKIT_SDK_TIMEOUT) {
    configData.vibekit.sdk.timeout = parseInt(env.VIBEKIT_SDK_TIMEOUT, 10);
  }
  
  if (env.VIBEKIT_SDK_BASE_URL) {
    configData.vibekit.sdk.baseUrl = env.VIBEKIT_SDK_BASE_URL;
  }
  
  // Telemetry overrides
  if (!configData.vibekit.telemetry) configData.vibekit.telemetry = {};
  
  if (env.VIBEKIT_TELEMETRY_ENABLED !== undefined) {
    configData.vibekit.telemetry.enabled = env.VIBEKIT_TELEMETRY_ENABLED === 'true';
  }
  
  if (env.VIBEKIT_TELEMETRY_ENDPOINT) {
    configData.vibekit.telemetry.endpoint = env.VIBEKIT_TELEMETRY_ENDPOINT;
  }
  
  if (env.VIBEKIT_TELEMETRY_API_KEY) {
    configData.vibekit.telemetry.apiKey = env.VIBEKIT_TELEMETRY_API_KEY;
  }
  
  if (env.VIBEKIT_TELEMETRY_SAMPLING_RATE) {
    configData.vibekit.telemetry.samplingRate = parseFloat(env.VIBEKIT_TELEMETRY_SAMPLING_RATE);
  }
  
  // Session management overrides
  if (!configData.vibekit.sessionManagement) configData.vibekit.sessionManagement = {};
  
  if (env.VIBEKIT_SESSION_ENABLED !== undefined) {
    configData.vibekit.sessionManagement.enabled = env.VIBEKIT_SESSION_ENABLED === 'true';
  }
  
  if (env.VIBEKIT_SESSION_PERSIST !== undefined) {
    configData.vibekit.sessionManagement.persistSessions = env.VIBEKIT_SESSION_PERSIST === 'true';
  }
  
  if (env.VIBEKIT_SESSION_DIR) {
    configData.vibekit.sessionManagement.sessionDir = env.VIBEKIT_SESSION_DIR;
  }

  // Secrets management overrides
  if (!configData.vibekit.secrets) configData.vibekit.secrets = {};
  
  if (env.VIBEKIT_SECRETS_PROVIDER) {
    configData.vibekit.secrets.provider = env.VIBEKIT_SECRETS_PROVIDER;
  }
  
  if (env.VIBEKIT_ENCRYPTION_KEY) {
    configData.vibekit.secrets.encryptionKey = env.VIBEKIT_ENCRYPTION_KEY;
  }

  // Ask Mode overrides
  if (!configData.vibekit.askMode) configData.vibekit.askMode = {};
  
  if (env.VIBEKIT_ASK_MODE_ENABLED !== undefined) {
    configData.vibekit.askMode.enabled = env.VIBEKIT_ASK_MODE_ENABLED === 'true';
  }
  
  if (env.VIBEKIT_ASK_MODE_DEFAULT) {
    configData.vibekit.askMode.defaultMode = env.VIBEKIT_ASK_MODE_DEFAULT;
  }

  // Streaming overrides
  if (!configData.vibekit.streaming) configData.vibekit.streaming = {};
  
  if (env.VIBEKIT_STREAMING_BUFFER_SIZE) {
    configData.vibekit.streaming.bufferSize = parseInt(env.VIBEKIT_STREAMING_BUFFER_SIZE, 10);
  }
  
  if (env.VIBEKIT_STREAMING_COMPRESSION !== undefined) {
    configData.vibekit.streaming.compression = env.VIBEKIT_STREAMING_COMPRESSION === 'true';
  }
  
  // Environment provider overrides (reusing existing Task Master keys)
  if (!configData.vibekit.environments) configData.vibekit.environments = {};
  
  // E2B overrides
  if (!configData.vibekit.environments.e2b) configData.vibekit.environments.e2b = {};
  if (env.E2B_API_KEY) {
    configData.vibekit.environments.e2b.apiKey = env.E2B_API_KEY;
    configData.vibekit.environments.e2b.enabled = true;
  }
  if (env.E2B_TEMPLATE_ID) {
    configData.vibekit.environments.e2b.templateId = env.E2B_TEMPLATE_ID;
  }
  if (env.E2B_REGION) {
    configData.vibekit.environments.e2b.region = env.E2B_REGION;
  }
  
  // Northflank overrides
  if (!configData.vibekit.environments.northflank) configData.vibekit.environments.northflank = {};
  if (env.NORTHFLANK_API_KEY) {
    configData.vibekit.environments.northflank.apiKey = env.NORTHFLANK_API_KEY;
    configData.vibekit.environments.northflank.enabled = true;
  }
  if (env.NORTHFLANK_PROJECT_ID) {
    configData.vibekit.environments.northflank.projectId = env.NORTHFLANK_PROJECT_ID;
  }
  if (env.NORTHFLANK_REGION) {
    configData.vibekit.environments.northflank.region = env.NORTHFLANK_REGION;
  }
  
  // Daytona overrides
  if (!configData.vibekit.environments.daytona) configData.vibekit.environments.daytona = {};
  if (env.DAYTONA_API_KEY) {
    configData.vibekit.environments.daytona.apiKey = env.DAYTONA_API_KEY;
    configData.vibekit.environments.daytona.enabled = true;
  }
  if (env.DAYTONA_WORKSPACE_ID) {
    configData.vibekit.environments.daytona.workspaceId = env.DAYTONA_WORKSPACE_ID;
  }
  if (env.DAYTONA_REGION) {
    configData.vibekit.environments.daytona.region = env.DAYTONA_REGION;
  }

  // Agent API key overrides (reusing existing Task Master keys)
  if (!configData.vibekit.agents) configData.vibekit.agents = {};
  
  // Claude agent
  if (!configData.vibekit.agents.claude) configData.vibekit.agents.claude = {};
  if (env.ANTHROPIC_API_KEY) {
    configData.vibekit.agents.claude.apiKey = env.ANTHROPIC_API_KEY;
    configData.vibekit.agents.claude.enabled = true;
  }
  
  // Codex agent
  if (!configData.vibekit.agents.codex) configData.vibekit.agents.codex = {};
  if (env.OPENAI_API_KEY) {
    configData.vibekit.agents.codex.apiKey = env.OPENAI_API_KEY;
  }
  
  // Gemini agent
  if (!configData.vibekit.agents.gemini) configData.vibekit.agents.gemini = {};
  if (env.GOOGLE_API_KEY) {
    configData.vibekit.agents.gemini.apiKey = env.GOOGLE_API_KEY;
  }
  
  // OpenCode agent (custom)
  if (!configData.vibekit.agents.opencode) configData.vibekit.agents.opencode = {};
  if (env.OPENCODE_API_KEY) {
    configData.vibekit.agents.opencode.apiKey = env.OPENCODE_API_KEY;
  }

  // GitHub integration overrides (reusing existing Task Master key)
  if (!configData.github) configData.github = {};
  
  if (env.GITHUB_API_KEY) {
    configData.github.token = env.GITHUB_API_KEY;
    configData.github.enabled = true;
  }
  
  if (env.GITHUB_WEBHOOK_SECRET) {
    configData.github.webhookSecret = env.GITHUB_WEBHOOK_SECRET;
  }
  
  if (env.GITHUB_DEFAULT_BRANCH) {
    configData.github.defaultBranch = env.GITHUB_DEFAULT_BRANCH;
  }

  // Execution overrides
  if (!configData.execution) configData.execution = {};
  
  if (env.FLOW_EXECUTION_TIMEOUT) {
    configData.execution.timeout = parseInt(env.FLOW_EXECUTION_TIMEOUT, 10);
  }
  
  if (env.FLOW_MAX_RETRIES) {
    configData.execution.maxRetries = parseInt(env.FLOW_MAX_RETRIES, 10);
  }
  
  if (env.FLOW_PARALLEL_TASKS) {
    configData.execution.parallelTasks = parseInt(env.FLOW_PARALLEL_TASKS, 10);
  }

  // Logging overrides
  if (!configData.logging) configData.logging = {};
  
  if (env.FLOW_LOG_LEVEL) {
    configData.logging.level = env.FLOW_LOG_LEVEL;
  }
  
  if (env.FLOW_LOG_FILE) {
    configData.logging.logFile = env.FLOW_LOG_FILE;
  }

  return configData;
} 