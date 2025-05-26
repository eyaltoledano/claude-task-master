import { AzureOpenAI } from "openai";

/**
 * Azure OpenAI provider using the openai package's AzureOpenAI client
 * This is an alternative to the @ai-sdk/azure implementation
 */

/**
 * Generate text using Azure OpenAI
 * @param {Object} params - Parameters for text generation
 * @param {Array} params.messages - Array of message objects with role and content
 * @param {string} params.modelId - The model to use (deployment name)
 * @param {Object} params.options - Additional options
 * @param {string} params.endpoint - Azure OpenAI endpoint
 * @param {string} params.apiKey - Azure OpenAI API key
 * @param {string} params.apiVersion - Azure OpenAI API version
 * @returns {Promise<Object>} Generated text response with usage data
 */
export async function generateAzureOpenAIText(params) {
  const { messages, modelId, maxTokens, temperature, endpoint, apiKey, apiVersion } = params;
  
  const client = new AzureOpenAI({ 
    endpoint, 
    apiKey, 
    apiVersion, 
    deployment: modelId 
  });

  // Use max_completion_tokens for o3-mini model, max_tokens for others
  const maxTokensParam = modelId === 'o3-mini' ? 'max_completion_tokens' : 'max_tokens';
  const requestParams = {
    messages
  };
  
  // Add the appropriate max tokens parameter
  requestParams[maxTokensParam] = maxTokens || 4000;
  
  // o3-mini doesn't support temperature, top_p, frequency_penalty, presence_penalty, stop
  if (modelId !== 'o3-mini') {
    requestParams.temperature = temperature || 0.7;
    requestParams.top_p = 1;
    requestParams.frequency_penalty = 0;
    requestParams.presence_penalty = 0;
  }

  // DEBUG: Log request parameters
  console.log('[AzureOpenAI][generateAzureOpenAIText] Request Params:', JSON.stringify(requestParams, null, 2));
  let response;
  try {
    response = await client.chat.completions.create(requestParams);
    // DEBUG: Log full response
    console.log('[AzureOpenAI][generateAzureOpenAIText] Response:', JSON.stringify(response, null, 2));
  } catch (err) {
    console.error('[AzureOpenAI][generateAzureOpenAIText] ERROR:', err);
    throw err;
  }

  const choice = response.choices[0];
  const usage = response.usage;

  return {
    text: choice.message.content || '',
    usage: {
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      reasoningTokens: usage.completion_tokens_details?.reasoning_tokens || 0
    },
    finishReason: choice.finish_reason,
    model: response.model
  };
}

/**
 * Generate streaming text using Azure OpenAI
 * @param {Object} params - Parameters for streaming text generation
 * @returns {Promise<AsyncIterable>} Streaming text response
 */
export async function streamAzureOpenAIText(params) {
  const { messages, modelId, maxTokens, temperature, endpoint, apiKey, apiVersion } = params;
  
  const client = new AzureOpenAI({ 
    endpoint, 
    apiKey, 
    apiVersion, 
    deployment: modelId 
  });

  // Use max_completion_tokens for o3-mini model, max_tokens for others
  const maxTokensParam = modelId === 'o3-mini' ? 'max_completion_tokens' : 'max_tokens';
  const requestParams = {
    messages,
    stream: true
  };
  
  // Add the appropriate max tokens parameter
  requestParams[maxTokensParam] = maxTokens || 4000;
  
  // o3-mini doesn't support temperature, top_p, frequency_penalty, presence_penalty, stop
  if (modelId !== 'o3-mini') {
    requestParams.temperature = temperature || 0.7;
    requestParams.top_p = 1;
    requestParams.frequency_penalty = 0;
    requestParams.presence_penalty = 0;
  }

  // DEBUG: Log request parameters
  console.log('[AzureOpenAI][streamAzureOpenAIText] Request Params:', JSON.stringify(requestParams, null, 2));
  let stream;
  try {
    stream = await client.chat.completions.create(requestParams);
    // DEBUG: Log stream creation
    console.log('[AzureOpenAI][streamAzureOpenAIText] Stream created successfully');
  } catch (err) {
    console.error('[AzureOpenAI][streamAzureOpenAIText] ERROR:', err);
    throw err;
  }

  // Note: Streaming API does not provide usage data until the stream is complete.
  // Telemetry for streaming calls will be incomplete or unavailable.
  return stream;
}

/**
 * Generate structured object using Azure OpenAI
 * @param {Object} params - Parameters for object generation
 * @param {Array} params.messages - Array of message objects with role and content
 * @param {Object} params.schema - Zod schema for the expected object
 * @param {string} params.modelId - The model to use (deployment name)
 * @param {Object} params.options - Additional options
 * @param {string} params.endpoint - Azure OpenAI endpoint
 * @param {string} params.apiKey - Azure OpenAI API key
 * @param {string} params.apiVersion - Azure OpenAI API version
 * @returns {Promise<Object>} Generated object response with usage data
 */
export async function generateAzureOpenAIObject(params) {
  const { messages, schema, modelId, maxTokens, temperature, endpoint, apiKey, apiVersion } = params;
  
  const client = new AzureOpenAI({ 
    endpoint, 
    apiKey, 
    apiVersion, 
    deployment: modelId 
  });

  // Convert Zod schema to JSON schema for OpenAI
  const jsonSchema = zodToJsonSchema(schema);

  // Use developer role for o3-mini, system role for others
  const systemRole = modelId === 'o3-mini' ? 'developer' : 'system';
  
  // Build the messages array with schema information
  const requestMessages = [
    { 
      role: systemRole, 
      content: "You are a helpful AI assistant. Respond with valid JSON that matches the provided schema. Do not include any text outside the JSON response." 
    },
    ...messages,
    { 
      role: "user", 
      content: `Please respond with a JSON object that matches this schema:\n${JSON.stringify(jsonSchema, null, 2)}` 
    }
  ];

  // Use max_completion_tokens for o3-mini model, max_tokens for others
  const maxTokensParam = modelId === 'o3-mini' ? 'max_completion_tokens' : 'max_tokens';
  const requestParams = {
    messages: requestMessages,
    response_format: { type: "json_object" }
  };
  
  // Add the appropriate max tokens parameter
  requestParams[maxTokensParam] = maxTokens || 4000;
  
  // o3-mini doesn't support temperature, top_p, frequency_penalty, presence_penalty
  if (modelId !== 'o3-mini') {
    requestParams.temperature = temperature || 0.7;
    requestParams.top_p = 1;
    requestParams.frequency_penalty = 0;
    requestParams.presence_penalty = 0;
  }

  // DEBUG: Log request parameters
  console.log('[AzureOpenAI][generateAzureOpenAIObject] Request Params:', JSON.stringify(requestParams, null, 2));
  let response;
  try {
    response = await client.chat.completions.create(requestParams);
    // DEBUG: Log full response
    console.log('[AzureOpenAI][generateAzureOpenAIObject] Response:', JSON.stringify(response, null, 2));
  } catch (err) {
    console.error('[AzureOpenAI][generateAzureOpenAIObject] ERROR:', err);
    throw err;
  }

  const choice = response.choices[0];
  const usage = response.usage;
  
  let parsedObject;
  try {
    parsedObject = JSON.parse(choice.message.content);
    
    // Normalize common enum values to lowercase for better compatibility
    if (parsedObject && typeof parsedObject === 'object') {
      for (const [key, value] of Object.entries(parsedObject)) {
        if (typeof value === 'string') {
          // Common enum normalizations
          if (key === 'priority' && ['low', 'medium', 'high'].includes(value.toLowerCase())) {
            parsedObject[key] = value.toLowerCase();
          }
          if (key === 'status' && ['pending', 'done', 'in-progress', 'review', 'deferred', 'cancelled'].includes(value.toLowerCase())) {
            parsedObject[key] = value.toLowerCase();
          }
        }
      }
    }
    
    // Validate against schema
    parsedObject = schema.parse(parsedObject);
  } catch (error) {
    throw new Error(`Failed to parse or validate response: ${error.message}`);
  }

  return {
    object: parsedObject,
    usage: {
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      reasoningTokens: usage.completion_tokens_details?.reasoning_tokens || 0
    },
    finishReason: choice.finish_reason,
    model: response.model
  };
}

/**
 * Convert Zod schema to JSON schema (simplified version)
 * @param {Object} zodSchema - Zod schema object
 * @returns {Object} JSON schema object
 */
function zodToJsonSchema(zodSchema) {
  // This is a simplified conversion - for production use, consider using zod-to-json-schema package
  const shape = zodSchema._def.shape();
  const properties = {};
  const required = [];

  for (const [key, value] of Object.entries(shape)) {
    if (value._def.typeName === 'ZodString') {
      properties[key] = { type: 'string' };
      if (value._def.description) {
        properties[key].description = value._def.description;
      }
    } else if (value._def.typeName === 'ZodNumber') {
      properties[key] = { type: 'number' };
      if (value._def.description) {
        properties[key].description = value._def.description;
      }
    } else if (value._def.typeName === 'ZodBoolean') {
      properties[key] = { type: 'boolean' };
      if (value._def.description) {
        properties[key].description = value._def.description;
      }
    } else if (value._def.typeName === 'ZodArray') {
      properties[key] = { 
        type: 'array',
        items: { type: 'object' } // Simplified - could be more specific
      };
      if (value._def.description) {
        properties[key].description = value._def.description;
      }
    } else if (value._def.typeName === 'ZodObject') {
      properties[key] = { 
        type: 'object',
        properties: zodToJsonSchema(value).properties
      };
      if (value._def.description) {
        properties[key].description = value._def.description;
      }
    }

    // Check if field is required (not optional)
    if (!value.isOptional()) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false
  };
} 