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
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { log } from '../../scripts/modules/utils.js';
import MODEL_MAP from '../../scripts/modules/supported-models.json' with { type: 'json' };

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
      // This tells the AI SDK client that the API supports structured outputs
      // However, only OpenAI and Claude models actually support it
      // We validate the specific model in generateObject/streamObject methods
      supportsStructuredOutputs: true
    });

    const { clientFactory } = options;

    this.clientFactory = clientFactory;
    this.modelMap = MODEL_MAP; // For max_tokens lookup in request transformer
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

  /**
   * Normalize Snowflake Cortex URLs to include required API path
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
      // CRITICAL: Snowflake requires additionalProperties: false in EVERY object node
      cleaned.additionalProperties = false;
      
      if (cleaned.properties) {
        const cleanedProps = {};
        for (const [key, value] of Object.entries(cleaned.properties)) {
          cleanedProps[key] = this._removeUnsupportedFeatures(value);
        }
        cleaned.properties = cleanedProps;
        
        // Snowflake requires 'required' array with ALL property names for OpenAI models
        // Set it for all models to avoid issues
        if (!cleaned.required || cleaned.required.length === 0) {
          cleaned.required = Object.keys(cleanedProps);
        } else {
          // Ensure required array only contains keys that exist in properties
          cleaned.required = cleaned.required.filter(key => key in cleanedProps);
        }
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
   * Override getClient to add request transformer and optional debug logging
   * @override
   */
  getClient(params) {
    const debugMode = process.env.TASKMASTER_DEBUG === 'true' || process.env.SNOWFLAKE_DEBUG === 'true';
    
    try {
      const { apiKey } = params;

      if (this.requiresApiKey && !apiKey) {
        throw new Error(`${this.name} API key is required.`);
      }

      const baseURL = this.getBaseURL(params);

      // Capture methods and data for use in fetch wrapper
      const removeUnsupportedFeatures = this._removeUnsupportedFeatures.bind(this);
      const modelMap = this.modelMap;

      // Create fetch wrapper that transforms requests for Snowflake compatibility
      const fetchWrapper = async (url, options) => {
        // Only transform POST requests to chat completions endpoint
        if (options?.method === 'POST' && url.includes('/chat/completions') && options?.body) {
          try {
            const body = JSON.parse(options.body);
            let modified = false;

            // 1. Inject max_completion_tokens based on model from supported-models.json
            // The body.model already contains the normalized model ID (e.g., "claude-haiku-4-5")
            const modelId = `cortex/${body.model}`;
            const snowflakeModels = modelMap?.snowflake || [];
            const modelInfo = snowflakeModels.find(m => m.id === modelId);
            const modelMaxTokens = modelInfo?.max_tokens || 64000; // Default to 64K if not found
            
            // Always set max_completion_tokens to the model's maximum capability
            if (!body.max_completion_tokens) {
              body.max_completion_tokens = modelMaxTokens;
              modified = true;
            } else if (body.max_completion_tokens > modelMaxTokens) {
              // Cap at model's maximum
              body.max_completion_tokens = modelMaxTokens;
              modified = true;
            }
            
            // Remove max_tokens if present (Snowflake uses max_completion_tokens)
            if (body.max_tokens) {
              delete body.max_tokens;
              modified = true;
            }

            // 2. Transform response_format for OpenAI/Claude structured outputs
            // Only clean schema if model supports structured outputs (OpenAI or Claude)
            const modelSupportsStructuredOutputs = body.model?.includes('openai') || body.model?.includes('claude');
            
            if (modelSupportsStructuredOutputs && body.response_format && typeof body.response_format === 'object') {
              // Remove Snowflake-unsupported features from JSON schema
              if (body.response_format.type === 'json_schema' && body.response_format.json_schema?.schema) {
                body.response_format.json_schema.schema = removeUnsupportedFeatures(
                  body.response_format.json_schema.schema
                );
                modified = true;
              }
            }

            // Debug logging if enabled
            if (debugMode) {
              console.error('\n[SNOWFLAKE DEBUG] ====== ACTUAL HTTP REQUEST TO SNOWFLAKE ======');
              console.error('[SNOWFLAKE DEBUG] URL:', url);
              console.error('[SNOWFLAKE DEBUG] Method:', options.method);
              console.error('[SNOWFLAKE DEBUG] Headers:', JSON.stringify(options.headers, null, 2));
              if (modified) {
                console.error('[SNOWFLAKE DEBUG] Request Body (TRANSFORMED):');
              } else {
                console.error('[SNOWFLAKE DEBUG] Request Body:');
              }
              console.error(JSON.stringify(body, null, 2));
              console.error('[SNOWFLAKE DEBUG] ==============================================\n');
            }

            // Update the request body
            if (modified) {
              options = {
                ...options,
                body: JSON.stringify(body)
              };
            }
          } catch (e) {
            // If we can't parse/transform, log and continue with original request
            if (debugMode) {
              console.error('[SNOWFLAKE DEBUG] Failed to transform request:', e.message);
            }
          }
        }
        
        // Call the actual fetch
        return fetch(url, options);
      };

      const clientConfig = {
        name: this.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        fetch: fetchWrapper
      };

      if (this.requiresApiKey && apiKey) {
        clientConfig.apiKey = apiKey;
      }

      if (baseURL) {
        clientConfig.baseURL = baseURL;
      }

      // Tell the AI SDK that the API supports structured outputs
      // Individual model support is validated in generateObject/streamObject
      if (this.supportsStructuredOutputs !== undefined) {
        clientConfig.supportsStructuredOutputs = this.supportsStructuredOutputs;
      }

      return createOpenAICompatible(clientConfig);
    } catch (error) {
      this.handleError('client initialization', error);
    }
  }

  /**
   * Normalize parameters: strip cortex/ prefix and handle temperature
   * @private
   */
  _normalizeParams(params) {
    const normalized = { ...params, modelId: this.normalizeModelId(params.modelId) };
    
    // OpenAI models and structured outputs don't support temperature parameter
    if (normalized.modelId?.includes('openai') || params.objectName) {
      delete normalized.temperature;
    }
    
    return normalized;
  }

  /**
   * Check if model supports native structured outputs (OpenAI or Claude only)
   * @private
   */
  _modelSupportsStructuredOutputs(modelId) {
    const normalized = this.normalizeModelId(modelId);
    return normalized?.includes('openai') || normalized?.includes('claude');
  }

  /**
   * Warn if model doesn't support structured outputs
   * @private
   */
  _warnIfUnsupportedStructuredOutputs(modelId) {
    if (!this._modelSupportsStructuredOutputs(modelId)) {
      log('warn', 
        `Model '${modelId}' does not support native structured outputs. ` +
        `Attempting JSON mode fallback. For best results, use OpenAI or Claude models.`
      );
    }
  }

  async generateText(params) {
    return await super.generateText(this._normalizeParams(params));
  }

  async streamText(params) {
    return await super.streamText(this._normalizeParams(params));
  }

  async generateObject(params) {
    const normalized = this._normalizeParams(params);
    this._warnIfUnsupportedStructuredOutputs(normalized.modelId);
    return await super.generateObject(normalized);
  }

  async streamObject(params) {
    const normalized = this._normalizeParams(params);
    this._warnIfUnsupportedStructuredOutputs(normalized.modelId);
    return await super.streamObject(normalized);
  }
}
