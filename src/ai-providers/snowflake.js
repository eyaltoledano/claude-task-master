/**
 * Snowflake Cortex AI provider using OpenAI-compatible API
 * 
 * Supports any Snowflake Cortex model using the `cortex/` prefix.
 * For the current list of available models, see:
 * https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql#model-restrictions
 * 
 * Models include Claude (Anthropic), GPT (OpenAI), Llama (Meta), Mistral, and DeepSeek.
 * 
 * Reference: https://docs.snowflake.com/en/user-guide/snowflake-cortex/open_ai_sdk
 */
import { OpenAICompatibleProvider } from './openai-compatible.js';
import { jsonSchema } from 'ai';

/**
 * Snowflake-compatible JSON Schemas for Task Master operations
 * 
 * These schemas mirror the Zod schemas in src/schemas/ but avoid patterns that Snowflake rejects:
 * - anyOf with null values (use optional properties instead)
 * - default keyword (omit entirely)
 * - Unsupported constraint keywords (minLength, maxLength, format, etc.)
 * 
 * For OpenAI models on Snowflake, these are also required:
 * - additionalProperties: false
 * - required field must contain all properties
 * 
 * When updating these schemas, compare with:
 * - src/schemas/add-task.js (AddTaskResponseSchema) → newTaskData
 * - src/schemas/expand-task.js (ExpandTaskResponseSchema) → subtasks
 * - src/schemas/update-tasks.js (UpdateTasksResponseSchema) → tasks
 * - src/schemas/update-task.js (UpdateTaskResponseSchema) → task
 * - src/schemas/analyze-complexity.js (ComplexityAnalysisResponseSchema) → complexityAnalysis
 * - src/schemas/parse-prd.js (ParsePRDResponseSchema) → tasks_data
 * 
 * @see https://docs.snowflake.com/en/user-guide/snowflake-cortex/complete-structured-outputs
 */

/**
 * Schema builder helper that enforces Snowflake requirements
 * Automatically adds additionalProperties: false and generates required array
 * 
 * @param {Object} properties - Property definitions
 * @param {string[]} [requiredFields] - Optional explicit required fields (defaults to all keys)
 * @returns {Object} Complete JSON schema
 */
const buildSchema = (properties, requiredFields = null) => ({
  type: 'object',
  properties,
  required: requiredFields || Object.keys(properties),
  additionalProperties: false
});

/**
 * Wrapper builder for single-property schemas (common pattern)
 */
const buildWrapperSchema = (propertyName, itemSchema) => 
  buildSchema({ [propertyName]: { type: 'array', items: itemSchema } });

// Base property definitions (reusable across schemas)
const SUBTASK_PROPERTIES = {
  id: { type: 'integer', description: 'Subtask ID (positive integer)' },
  title: { type: 'string', description: 'Subtask title' },
  description: { type: 'string', description: 'Subtask description' },
  dependencies: { type: 'array', items: { type: 'integer' }, description: 'Array of dependency IDs' },
  details: { type: 'string', description: 'Implementation details for the subtask' },
  status: { type: 'string', description: 'Status of the subtask' },
  testStrategy: { type: 'string', description: 'Testing approach for the subtask' }
};

const TASK_PROPERTIES = {
  id: { type: 'integer', description: 'Task ID' },
  title: { type: 'string', description: 'Task title' },
  description: { type: 'string', description: 'Task description' },
  status: { type: 'string', description: 'Task status' },
  dependencies: { type: 'array', items: { oneOf: [{ type: 'integer' }, { type: 'string' }] }, description: 'Task dependencies' },
  priority: { type: 'string', description: 'Task priority' },
  details: { type: 'string', description: 'Implementation details' },
  testStrategy: { type: 'string', description: 'Testing strategy' }
};

const COMPLEXITY_ITEM_PROPERTIES = {
  taskId: { type: 'integer', description: 'Task ID' },
  taskTitle: { type: 'string', description: 'Task title' },
  complexityScore: { type: 'number', description: 'Complexity score from 1-10' },
  recommendedSubtasks: { type: 'integer', description: 'Recommended number of subtasks' },
  expansionPrompt: { type: 'string', description: 'Suggested prompt for task expansion' },
  reasoning: { type: 'string', description: 'Reasoning for the complexity assessment' }
};

// Reusable component schemas
const SUBTASK_ITEM_SCHEMA = buildSchema(SUBTASK_PROPERTIES);

const SUBTASK_ITEM_SCHEMA_WITH_STRING_DEPS = buildSchema({
  ...SUBTASK_PROPERTIES,
  dependencies: { type: 'array', items: { type: 'string' } }
});

const FULL_TASK_SCHEMA = buildSchema({
  ...TASK_PROPERTIES,
  subtasks: { type: 'array', items: SUBTASK_ITEM_SCHEMA }
}, ['id', 'title', 'description', 'status', 'dependencies']); // Only these are required

// Simplified task schema without nested subtasks and integer-only dependencies (for Snowflake compatibility)
const SIMPLE_TASK_SCHEMA = buildSchema({
  id: { type: 'integer', description: 'Task ID' },
  title: { type: 'string', description: 'Task title' },
  description: { type: 'string', description: 'Task description' },
  status: { type: 'string', description: 'Task status' },
  dependencies: { type: 'array', items: { type: 'integer' }, description: 'Task dependencies' },
  priority: { type: 'string', description: 'Task priority' },
  details: { type: 'string', description: 'Implementation details' },
  testStrategy: { type: 'string', description: 'Testing strategy' }
}, ['id', 'title', 'description', 'status', 'dependencies']);

// Main operation schemas (matches src/schemas/)
const NEW_TASK_DATA_SCHEMA = buildSchema({
  title: { type: 'string', description: 'Clear, concise title for the task' },
  description: { type: 'string', description: 'A one or two sentence description of the task' },
  details: { type: 'string', description: 'In-depth implementation details, considerations, and guidance' },
  testStrategy: { type: 'string', description: 'Detailed approach for verifying task completion' },
  dependencies: { type: 'array', items: { type: 'number' }, description: 'Array of task IDs that this task depends on' }
});

const SUBTASKS_SCHEMA = buildWrapperSchema('subtasks', SUBTASK_ITEM_SCHEMA);
const TASKS_SCHEMA = buildWrapperSchema('tasks', SIMPLE_TASK_SCHEMA); // Use simple schema without nested subtasks
const TASK_SCHEMA = buildSchema({ task: FULL_TASK_SCHEMA });

const COMPLEXITY_ANALYSIS_SCHEMA = buildWrapperSchema(
  'complexityAnalysis',
  buildSchema(COMPLEXITY_ITEM_PROPERTIES)
);

const TASKS_DATA_SCHEMA = buildWrapperSchema(
  'tasks',
  buildSchema(
    {
      id: { type: 'integer' },
      title: { type: 'string' },
      description: { type: 'string' },
      details: { type: 'string' },
      testStrategy: { type: 'string' },
      priority: { type: 'string' },
      dependencies: { type: 'array', items: { type: 'integer' } },
      status: { type: 'string' }
    },
    ['id', 'title', 'description'] // Only these required
  )
);

const UPDATED_TASK_SCHEMA = buildSchema({
  title: { type: 'string', description: 'Updated task title' },
  description: { type: 'string', description: 'Updated description' },
  details: { type: 'string', description: 'Updated implementation details' },
  testStrategy: { type: 'string', description: 'Updated testing approach' },
  priority: { type: 'string', description: 'Task priority level' }
});

const SUBTASK_REGENERATION_SCHEMA = buildWrapperSchema('subtasks', SUBTASK_ITEM_SCHEMA_WITH_STRING_DEPS);

// Schema lookup map
const SNOWFLAKE_SCHEMA_MAP = {
  newTaskData: NEW_TASK_DATA_SCHEMA,
  subtasks: SUBTASKS_SCHEMA,
  tasks: TASKS_SCHEMA,
  task: TASK_SCHEMA,
  complexityAnalysis: COMPLEXITY_ANALYSIS_SCHEMA,
  tasks_data: TASKS_DATA_SCHEMA,
  updated_task: UPDATED_TASK_SCHEMA,
  subtask_regeneration: SUBTASK_REGENERATION_SCHEMA
};

export class SnowflakeProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      name: 'Snowflake Cortex',
      apiKeyEnvVar: 'SNOWFLAKE_API_KEY',
      requiresApiKey: true,
      supportsStructuredOutputs: true  // Enabled with schema transformation for compatibility
    });
  }

  /**
   * Override getBaseURL to normalize Snowflake Cortex URLs
   * @param {object} params - Client parameters
   * @returns {string|undefined} The normalized base URL
   */
  getBaseURL(params) {
    // Get the base URL from params or default
    const baseURL = params.baseURL || this.defaultBaseURL;
    if (!baseURL) return undefined;
    
    const requiredPath = '/api/v2/cortex/v1';
    
    // If URL already has the required path, return as-is
    if (baseURL.includes(requiredPath)) {
      return baseURL;
    }
    
    // Remove trailing slash from base URL if present
    const cleanBaseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
    
    // Append the required path
    return `${cleanBaseURL}${requiredPath}`;
  }

  /**
   * Gets Snowflake-compatible JSON Schema for the given object type
   * @param {string} objectName - Name of the object being generated
   * @returns {object|null} JSON Schema object or null if no custom schema available
   */
  _createSnowflakeCompatibleSchema(objectName) {
    return SNOWFLAKE_SCHEMA_MAP[objectName] || null;
  }

  /**
   * Removes 'cortex/' prefix from model IDs before API calls
   * @param {string} modelId - Model identifier with optional cortex/ prefix
   * @returns {string} Model ID without prefix
   */
  normalizeModelId(modelId) {
    return modelId?.startsWith('cortex/') ? modelId.substring(7) : modelId;
  }

  /**
   * Normalizes parameters for Snowflake API calls
   * Strips cortex/ prefix and handles temperature for Snowflake compatibility
   * @param {object} params - Original parameters
   * @returns {object} Normalized parameters
   */
  _normalizeParams(params) {
    const normalized = {
      ...params,
      modelId: this.normalizeModelId(params.modelId)
    };
    
    // Snowflake Cortex: OpenAI models don't support temperature parameter at all
    // Claude models support it, so we set it to 0 for structured outputs for determinism
    const isOpenAI = normalized.modelId?.includes('openai');
    if (isOpenAI) {
      delete normalized.temperature;
    } else if (params.objectName) {
      // For Claude structured outputs, use temperature 0 for deterministic responses
      normalized.temperature = 0;
    }

    // Always optimize prompts for structured output (Snowflake best practice)
    if (params.objectName && normalized.systemPrompt) {
      normalized.systemPrompt = `${normalized.systemPrompt}\n\nRespond in JSON.`;
    }
    
    return normalized;
  }

  /**
   * Prepares token parameter for OpenAI-compatible API
   * @param {string} modelId - Model identifier (unused but required by interface)
   * @param {number} maxTokens - Maximum tokens to generate
   * @returns {object} Token parameter object
   */
  prepareTokenParam(modelId, maxTokens) {
    if (maxTokens === undefined) return {};
    return { maxTokens: Math.floor(Number(maxTokens)) };
  }

  async generateText(params) {
    return await super.generateText(this._normalizeParams(params));
  }

  async streamText(params) {
    return await super.streamText(this._normalizeParams(params));
  }

  async generateObject(params) {
    const normalizedParams = this._normalizeParams(params);

    // Use custom Snowflake-compatible schema if available
    const customSchema = this._createSnowflakeCompatibleSchema(params.objectName);
    if (customSchema) {
      normalizedParams.schema = jsonSchema(customSchema);
    }

    return await super.generateObject(normalizedParams);
  }

  async streamObject(params) {
    const normalizedParams = this._normalizeParams(params);

    // Use custom Snowflake-compatible schema if available
    const customSchema = this._createSnowflakeCompatibleSchema(params.objectName);
    if (customSchema) {
      normalizedParams.schema = jsonSchema(customSchema);
    }

    return await super.streamObject(normalizedParams);
  }
}
