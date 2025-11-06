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

export class SnowflakeProvider extends OpenAICompatibleProvider {
  /**
   * Snowflake-unsupported JSON Schema constraint keywords
   * @see https://docs.snowflake.com/en/user-guide/snowflake-cortex/complete-structured-outputs
   */
  static UNSUPPORTED_KEYWORDS = [
    'default', '$schema', // General
    'multipleOf', // Integer
    'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', // Number
    'minLength', 'maxLength', 'format', // String
    'uniqueItems', 'contains', 'minContains', 'maxContains', 'minItems', 'maxItems', // Array
    'patternProperties', 'minProperties', 'maxProperties', 'propertyNames' // Object
  ];

  constructor(options = {}) {
    super({
      name: 'Snowflake Cortex',
      apiKeyEnvVar: 'SNOWFLAKE_API_KEY',
      requiresApiKey: true,
      supportsStructuredOutputs: true
    });

    const { clientFactory } = options;

    this.clientFactory = clientFactory;
  }

  validateAuth(params) {
    super.validateAuth(params);
    if (typeof params.apiKey !== 'string' || params.apiKey.trim().length === 0) {
      throw new Error('Snowflake Cortex API key is required');
    }
  }

  handleError(operation, error) {
    const errorMessage = error?.message || 'Unknown error occurred';
    throw new Error(`${this.name} API error during ${operation}: ${errorMessage}`);
  }

  getClient(params) {
    if (this.clientFactory) {
      const baseURL = this.getBaseURL(params);
      return this.clientFactory({ ...params, baseURL });
    }
    return super.getClient(params);
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
   * Recursively removes Snowflake-unsupported features from JSON Schema
   * @private
   * @param {object} schema - JSON Schema object
   * @returns {object} Cleaned schema
   */
  _removeUnsupportedFeatures(schema) {
    if (!schema || typeof schema !== 'object') {
      return schema;
    }

    const cleaned = { ...schema };

    // Remove Snowflake-unsupported keywords
    SnowflakeProvider.UNSUPPORTED_KEYWORDS.forEach(keyword => {
      delete cleaned[keyword];
    });

    // Handle anyOf with null (convert to optional)
    if (cleaned.anyOf) {
      const nonNullTypes = cleaned.anyOf.filter(item => 
        !(item.type === 'null' || (Array.isArray(item.type) && item.type.includes('null')))
      );
      if (nonNullTypes.length === 1) {
        // Single non-null type - flatten it
        Object.assign(cleaned, nonNullTypes[0]);
        delete cleaned.anyOf;
      } else if (nonNullTypes.length > 1) {
        cleaned.anyOf = nonNullTypes.map(item => this._removeUnsupportedFeatures(item));
      }
    }

    // Normalize objects
    if (cleaned.type === 'object') {
      cleaned.additionalProperties = false;
      
      if (cleaned.properties) {
        const cleanedProps = {};
        for (const [key, value] of Object.entries(cleaned.properties)) {
          cleanedProps[key] = this._removeUnsupportedFeatures(value);
        }
        cleaned.properties = cleanedProps;
      }

      // Ensure required array only contains keys that exist in properties
      if (cleaned.required && cleaned.properties) {
        cleaned.required = cleaned.required.filter(key => key in cleaned.properties);
      }
    }

    // Handle arrays
    if (cleaned.type === 'array' && cleaned.items) {
      cleaned.items = this._removeUnsupportedFeatures(cleaned.items);
    }

    // Handle oneOf
    if (cleaned.oneOf) {
      cleaned.oneOf = cleaned.oneOf.map(item => this._removeUnsupportedFeatures(item));
    }

    return cleaned;
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

  /**
   * Transforms the schema to be Snowflake-compatible
   * Converts Zod schema to JSON Schema and removes unsupported features
   * @private
   */
  _applySnowflakeSchema(params) {
    if (!params.schema) return;
    
    // Check if params.schema is a Zod schema (has toJSONSchema method)
    if (typeof params.schema.toJSONSchema !== 'function') {
      // Schema is not a Zod schema, skip transformation
      return;
    }
    
    // Convert Zod schema to JSON Schema (Draft 7)
    const jsonSchemaObj = params.schema.toJSONSchema({ target: 'draft-7' });
    
    // Remove Snowflake-unsupported features
    const cleanedSchema = this._removeUnsupportedFeatures(jsonSchemaObj);
    
    // Wrap cleaned schema back with AI SDK helper
    params.schema = jsonSchema(cleanedSchema);
  }

  async generateObject(params) {
    const normalizedParams = this._normalizeParams(params);
    this._applySnowflakeSchema(normalizedParams);
    return await super.generateObject(normalizedParams);
  }

  async streamObject(params) {
    const normalizedParams = this._normalizeParams(params);
    this._applySnowflakeSchema(normalizedParams);
    return await super.streamObject(normalizedParams);
  }
}
