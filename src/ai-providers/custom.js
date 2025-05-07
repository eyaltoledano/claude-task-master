/**
 * src/ai-providers/custom.js
 *
 * Implementation for interacting with custom OpenAI-compatible models
 * using the Vercel AI SDK.
 */
import { createOpenAI } from '@ai-sdk/openai'; // Using openai provider from Vercel AI SDK
import { generateText, streamText, generateObject } from 'ai'; // Import necessary functions from 'ai'
import { log } from '../../scripts/modules/utils.js';
import { hasLimitedFunctionCalling, registerLimitedFunctionCalling } from './model-capabilities.js';

/**
 * Generates text using a custom OpenAI-compatible model via Vercel AI SDK.
 *
 * @param {object} params - Parameters for the text generation.
 * @param {string} params.apiKey - The API key for the custom provider.
 * @param {string} params.baseUrl - The base URL for the custom provider's API.
 * @param {string} params.modelId - The model ID to use.
 * @param {Array<object>} params.messages - The messages array.
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @param {object} [params.customHeaders] - Optional custom headers for the API request.
 * @returns {Promise<string>} The generated text content.
 * @throws {Error} If the API call fails.
 */
export async function generateCustomText({
  apiKey,
  baseUrl,
  modelId,
  messages,
  maxTokens,
  temperature,
  customHeaders
}) {
  log('debug', `Generating text with custom OpenAI-compatible model: ${modelId} at ${baseUrl}`);

  if (!apiKey) {
    throw new Error('Custom API key is required.');
  }
  if (!baseUrl) {
    throw new Error('Custom API base URL is required.');
  }
  if (!modelId) {
    throw new Error('Model ID is required.');
  }
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Invalid or empty messages array provided.');
  }

  try {
    // Create a custom OpenAI client with the provided base URL
    const customClient = createOpenAI({
      apiKey,
      baseURL: baseUrl,
      ...(customHeaders && { headers: JSON.parse(customHeaders) })
    });

    // Use the imported generateText function from 'ai' package
    const result = await generateText({
      model: customClient(modelId),
      messages,
      maxTokens,
      temperature
    });

    log('debug', `Custom provider generateText completed successfully for model: ${modelId}`);
    return result.text;
  } catch (error) {
    log('error', `Error in generateCustomText (Model: ${modelId}): ${error.message}`, { error });
    throw new Error(`Custom provider API error: ${error.message}`);
  }
}

/**
 * Streams text using a custom OpenAI-compatible model via Vercel AI SDK.
 *
 * @param {object} params - Parameters for the text streaming.
 * @param {string} params.apiKey - The API key for the custom provider.
 * @param {string} params.baseUrl - The base URL for the custom provider's API.
 * @param {string} params.modelId - The model ID to use.
 * @param {Array<object>} params.messages - The messages array.
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @param {object} [params.customHeaders] - Optional custom headers for the API request.
 * @param {function} params.onUpdate - Callback function for streaming updates.
 * @returns {Promise<string>} The complete generated text after streaming.
 * @throws {Error} If the API call fails.
 */
export async function streamCustomText({
  apiKey,
  baseUrl,
  modelId,
  messages,
  maxTokens,
  temperature,
  customHeaders,
  onUpdate
}) {
  log('debug', `Streaming text with custom OpenAI-compatible model: ${modelId} at ${baseUrl}`);

  if (!apiKey) {
    throw new Error('Custom API key is required.');
  }
  if (!baseUrl) {
    throw new Error('Custom API base URL is required.');
  }
  if (!modelId) {
    throw new Error('Model ID is required.');
  }
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Invalid or empty messages array provided.');
  }
  if (typeof onUpdate !== 'function') {
    throw new Error('onUpdate callback is required for streaming.');
  }

  try {
    // Create a custom OpenAI client with the provided base URL
    const customClient = createOpenAI({
      apiKey,
      baseURL: baseUrl,
      ...(customHeaders && { headers: JSON.parse(customHeaders) })
    });

    // Use the imported streamText function from 'ai' package
    const result = await streamText({
      model: customClient(modelId),
      messages,
      maxTokens,
      temperature,
      onStreamResult: (result) => {
        onUpdate(result.text);
      }
    });

    log('debug', `Custom provider streamText completed successfully for model: ${modelId}`);
    return result.text;
  } catch (error) {
    log('error', `Error in streamCustomText (Model: ${modelId}): ${error.message}`, { error });
    throw new Error(`Custom provider API error: ${error.message}`);
  }
}

/**
 * Generates a structured object using a custom OpenAI-compatible model via Vercel AI SDK.
 *
 * @param {object} params - Parameters for the object generation.
 * @param {string} params.apiKey - The API key for the custom provider.
 * @param {string} params.baseUrl - The base URL for the custom provider's API.
 * @param {string} params.modelId - The model ID to use.
 * @param {Array<object>} params.messages - The messages array.
 * @param {import('zod').ZodSchema} params.schema - The Zod schema for the object.
 * @param {string} params.objectName - A name for the object/tool.
 * @param {number} [params.maxTokens] - Maximum tokens for the response.
 * @param {number} [params.temperature] - Temperature for generation.
 * @param {object} [params.customHeaders] - Optional custom headers for the API request.
 * @param {number} [params.maxRetries] - Max retries for validation/generation.
 * @returns {Promise<object>} The generated object matching the schema.
 * @throws {Error} If generation or validation fails.
 */
export async function generateCustomObject({
  apiKey,
  baseUrl,
  modelId,
  messages,
  schema,
  objectName = 'generated_object',
  maxTokens,
  temperature,
  customHeaders,
  maxRetries = 3
}) {
  log('debug', `Generating object with custom OpenAI-compatible model: ${modelId} at ${baseUrl}`);

  if (!apiKey) {
    throw new Error('Custom API key is required.');
  }
  if (!baseUrl) {
    throw new Error('Custom API base URL is required.');
  }
  if (!modelId) {
    throw new Error('Model ID is required.');
  }
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Invalid or empty messages array provided.');
  }
  if (!schema) {
    throw new Error('Schema is required for object generation.');
  }

  // Check if this model is known to have limited function calling support
  const knownLimitedModel = hasLimitedFunctionCalling(modelId);
  if (knownLimitedModel) {
    log('info', `Model ${modelId} is known to have limited function calling support. Using JSON fallback directly.`);
    return await generateWithJSONFallback({
      apiKey,
      baseUrl,
      modelId,
      messages,
      schema,
      objectName,
      maxTokens,
      temperature,
      customHeaders
    });
  }

  // Enhanced system prompt to encourage function calling
  const enhancedMessages = [...messages];
  let hasSystemMessage = false;

  // Check if there's already a system message
  for (let i = 0; i < enhancedMessages.length; i++) {
    if (enhancedMessages[i].role === 'system') {
      hasSystemMessage = true;
      // Enhance existing system message
      enhancedMessages[i].content = `${enhancedMessages[i].content}\n\nIMPORTANT: You MUST use the provided function to respond. Do not respond with plain text. Always use the function to structure your response.`;
      break;
    }
  }

  // Add system message if none exists
  if (!hasSystemMessage) {
    enhancedMessages.unshift({
      role: 'system',
      content: `You are a helpful assistant that always uses the provided function to structure your response. Do not respond with plain text. Always use the function to structure your response.`
    });
  }

  // Create a custom OpenAI client with the provided base URL
  const customClient = createOpenAI({
    apiKey,
    baseURL: baseUrl,
    ...(customHeaders && { headers: JSON.parse(customHeaders) })
  });

  // Log the request payload for debugging
  log('debug', 'Custom provider generateObject request payload:', {
    modelId,
    messages: enhancedMessages,
    schema: JSON.stringify(schema),
    objectName,
    maxTokens,
    temperature,
    maxRetries
  });

  try {
    // First attempt with enhanced system prompt
    const result = await generateObject({
      model: customClient(modelId),
      schema,
      messages: enhancedMessages,
      mode: 'tool',
      tool: {
        name: objectName,
        description: `Generate a ${objectName} based on the prompt.`
      },
      maxTokens,
      temperature,
      maxRetries
    });

    log('debug', `Custom provider generateObject completed successfully for model: ${modelId}`);
    return result.object;
  } catch (error) {
    // Check if the error is related to the model not using the tool
    const errorMessage = error.message.toLowerCase();
    const isToolCallingError =
      errorMessage.includes('no object generated') ||
      errorMessage.includes('tool was not called') ||
      errorMessage.includes('finish_reason') && errorMessage.includes('stop') ||
      errorMessage.includes('function') && errorMessage.includes('not called');

    if (isToolCallingError) {
      // Register this model as having limited function calling support
      registerLimitedFunctionCalling(modelId);

      // Log as INFO instead of ERROR or WARN since this is an expected fallback path
      log('info', `Model ${modelId} did not use function calling. This is normal for some models. Using JSON fallback...`);

      // Use the JSON fallback method
      return await generateWithJSONFallback({
        apiKey,
        baseUrl,
        modelId,
        messages,
        schema,
        objectName,
        maxTokens,
        temperature,
        customHeaders
      });
    }

    // For non-tool-calling errors, log as error
    log('error', `Error in generateCustomObject (Model: ${modelId}): ${error.message}`, { error });

    // If it's not a tool-related error or fallback failed, throw the original error
    throw new Error(`Custom provider API error during object generation: ${error.message}`);
  }
}

/**
 * Fallback method to generate a JSON object directly without using function calling.
 * This is used when a model doesn't support function calling or fails to use it properly.
 *
 * @param {object} params - Parameters for the JSON generation.
 * @returns {Promise<object>} The generated object.
 * @throws {Error} If JSON generation fails.
 */
async function generateWithJSONFallback({
  apiKey,
  baseUrl,
  modelId,
  messages,
  schema,
  objectName,
  maxTokens,
  temperature,
  customHeaders,
  retryCount = 0,
  maxRetries = 2 // Allow up to 2 retries (3 total attempts)
}) {
  // Use debug level for technical details, but keep the main flow as info
  if (retryCount === 0) {
    log('info', `Using direct JSON generation for model ${modelId} (this is a normal fallback strategy)`);
  } else {
    log('debug', `Retrying JSON generation for model ${modelId} (attempt ${retryCount + 1}/${maxRetries + 1})`);
  }

  try {
    // Create a custom OpenAI client
    const customClient = createOpenAI({
      apiKey,
      baseURL: baseUrl,
      ...(customHeaders && { headers: JSON.parse(customHeaders) })
    });

    // Extract required field names from the schema
    const requiredFields = [];
    try {
      // Extract field names from the schema
      if (schema && schema._def && schema._def.shape) {
        const shapeKeys = Object.keys(schema._def.shape);
        for (const key of shapeKeys) {
          // Check if the field is required (not optional)
          const field = schema._def.shape[key];
          if (!field._def.isOptional) {
            requiredFields.push(key);
          }
        }
      }
      log('debug', `Required fields extracted from schema: ${requiredFields.join(', ')}`);
    } catch (schemaError) {
      log('warn', `Could not extract required fields from schema: ${schemaError.message}`);
    }

    // Create a specialized prompt for JSON generation with emphasis on required fields
    const jsonPrompt = [
      {
        role: 'system',
        content: `You are a helpful assistant that always responds with valid JSON that matches the following schema: ${JSON.stringify(schema)}.
        Your entire response must be valid JSON only, with no additional text before or after the JSON.

        Schema: ${JSON.stringify(schema, null, 2)}

        CRITICAL REQUIREMENTS:
        1. Your response must be a valid JSON object
        2. Do not include any text before or after the JSON
        3. You MUST include ALL of these required fields with non-empty values: ${requiredFields.join(', ')}
        4. Follow the types specified in the schema exactly
        5. Do not add any properties not in the schema
        6. NEVER return empty strings for required fields
        7. For fields like 'title', 'description', and 'testStrategy', provide detailed, meaningful content

        Example of a good response structure:
        {
          "title": "Implement Feature X",
          "description": "Create a new feature that allows users to...",
          "testStrategy": "Test the feature by verifying that...",
          ...other fields as required
        }`
      },
      ...messages.filter(m => m.role !== 'system') // Add all non-system messages
    ];

    // Log the fallback request
    log('debug', 'JSON fallback request:', {
      modelId,
      jsonPrompt
    });

    // Use regular text generation instead
    const textResult = await generateText({
      model: customClient(modelId),
      messages: jsonPrompt,
      maxTokens,
      temperature
    });

    // Try to parse the result as JSON
    try {
      // Extract JSON from the response (in case there's any text around it)
      const jsonMatch = textResult.text.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : textResult.text;

      // Log the raw response for debugging
      log('debug', 'Raw JSON fallback response:', {
        rawResponse: textResult.text,
        extractedJson: jsonString
      });

      // Parse the JSON
      const parsedObject = JSON.parse(jsonString);

      // Validate that all required fields are present and not empty
      const missingFields = [];
      const emptyFields = [];

      // Check for missing or empty required fields
      for (const field of requiredFields) {
        if (!(field in parsedObject)) {
          missingFields.push(field);
        } else if (typeof parsedObject[field] === 'string' && parsedObject[field].trim() === '') {
          emptyFields.push(field);
        }
      }

      // Special handling for common task fields that should never be empty
      const criticalFields = ['title', 'description', 'testStrategy'];
      for (const field of criticalFields) {
        if (field in parsedObject && typeof parsedObject[field] === 'string' && parsedObject[field].trim() === '') {
          if (!emptyFields.includes(field)) {
            emptyFields.push(field);
          }
        }
      }

      // Log warnings for missing or empty fields
      if (missingFields.length > 0) {
        log('warn', `Generated object is missing required fields: ${missingFields.join(', ')}`);
      }

      if (emptyFields.length > 0) {
        log('warn', `Generated object has empty values for fields: ${emptyFields.join(', ')}`);
      }

      // If there are missing or empty critical fields, try to retry or fix them
      if (missingFields.length > 0 || emptyFields.length > 0) {
        // Check if we should retry with a more specific prompt
        if (retryCount < maxRetries && (
            // Retry if any critical field is missing or empty
            criticalFields.some(field => missingFields.includes(field) || emptyFields.includes(field))
        )) {
          log('info', `Critical fields missing or empty. Retrying with more specific prompt (attempt ${retryCount + 2}/${maxRetries + 1})...`);

          // Create a more specific prompt for the retry
          const retryMessages = [
            {
              role: 'system',
              content: `You MUST respond with a valid JSON object that matches this schema: ${JSON.stringify(schema, null, 2)}

              Your previous response was missing or had empty values for these fields: ${[...missingFields, ...emptyFields].join(', ')}

              CRITICAL REQUIREMENTS:
              1. Your response must be ONLY a valid JSON object with NO additional text
              2. Include ALL required fields with non-empty values
              3. The following fields MUST have detailed, meaningful content:
                 - title: A clear, specific title for the task
                 - description: A detailed description of what the task involves
                 - testStrategy: A specific approach for testing and validating the task
              4. Do not use placeholders or empty strings

              Example of correct JSON format with good content:
              {
                "title": "Implement Custom Provider Fallback Mechanism",
                "description": "Create a robust fallback mechanism for the custom provider that handles models without function calling support by generating structured JSON directly.",
                "testStrategy": "Test the fallback by using models known to lack function calling, verify all fields are populated correctly, and ensure error handling works for malformed responses.",
                ...other fields as required
              }`
            },
            ...messages.filter(m => m.role !== 'system')
          ];

          // Retry with a higher temperature to encourage different output
          return await generateWithJSONFallback({
            apiKey,
            baseUrl,
            modelId,
            messages: retryMessages,
            schema,
            objectName,
            maxTokens,
            temperature: Math.min(temperature + 0.2, 1.0), // Increase temperature slightly, but cap at 1.0
            customHeaders,
            retryCount: retryCount + 1,
            maxRetries
          });
        }

        // If we've exhausted retries or it's not a critical field issue, fix with default values
        log('info', 'Attempting to fix missing or empty fields with default values');

        // Create a fixed object with default values for missing or empty fields
        const fixedObject = { ...parsedObject };

        // Add default values for missing fields
        for (const field of [...missingFields, ...emptyFields]) {
          if (field === 'title') {
            fixedObject.title = `Task generated with ${modelId}`;
          } else if (field === 'description') {
            fixedObject.description = 'This task was generated using the JSON fallback mechanism. Please update with a proper description.';
          } else if (field === 'testStrategy') {
            fixedObject.testStrategy = 'Implement appropriate tests for this task based on its requirements.';
          } else if (field === 'details') {
            fixedObject.details = 'Implementation details need to be specified. Please update this field.';
          } else {
            // For other fields, use a generic default based on type
            if (schema && schema._def && schema._def.shape && schema._def.shape[field]) {
              const fieldDef = schema._def.shape[field];
              if (fieldDef._def.typeName === 'ZodString') {
                fixedObject[field] = `Default value for ${field}`;
              } else if (fieldDef._def.typeName === 'ZodNumber') {
                fixedObject[field] = 0;
              } else if (fieldDef._def.typeName === 'ZodBoolean') {
                fixedObject[field] = false;
              } else if (fieldDef._def.typeName === 'ZodArray') {
                fixedObject[field] = [];
              } else if (fieldDef._def.typeName === 'ZodObject') {
                fixedObject[field] = {};
              }
            }
          }
        }

        // Log the fixed object
        log('info', 'Fixed object with default values:', fixedObject);

        // Return the fixed object
        log('info', `Successfully generated and fixed object via direct JSON generation for model: ${modelId}`);
        return fixedObject;
      }

      // If all required fields are present and not empty, return the parsed object
      log('info', `Successfully generated object via direct JSON generation for model: ${modelId}`);
      return parsedObject;
    } catch (parseError) {
      log('error', `Failed to parse JSON from fallback response: ${parseError.message}`, {
        response: textResult.text
      });

      // Check if we can retry
      if (retryCount < maxRetries) {
        log('info', `Retrying JSON generation (attempt ${retryCount + 2}/${maxRetries + 1})...`);

        // Create a more explicit prompt for the retry
        const retryMessages = [
          {
            role: 'system',
            content: `You MUST respond with a valid JSON object that matches this schema: ${JSON.stringify(schema, null, 2)}

            Your previous response could not be parsed as valid JSON.

            CRITICAL REQUIREMENTS:
            1. Your response must be ONLY a valid JSON object with NO additional text
            2. Include ALL required fields with non-empty values
            3. Fields like 'title', 'description', and 'testStrategy' MUST have meaningful content
            4. Do not use placeholders or empty strings
            5. Make sure all JSON syntax is correct (quotes, commas, brackets)

            Example of correct JSON format:
            {
              "title": "Implement Feature X",
              "description": "Create a new feature that allows users to...",
              "testStrategy": "Test the feature by verifying that...",
              ...other fields as required
            }`
          },
          ...messages.filter(m => m.role !== 'system')
        ];

        // Retry with a higher temperature to encourage different output
        return await generateWithJSONFallback({
          apiKey,
          baseUrl,
          modelId,
          messages: retryMessages,
          schema,
          objectName,
          maxTokens,
          temperature: Math.min(temperature + 0.2, 1.0), // Increase temperature slightly, but cap at 1.0
          customHeaders,
          retryCount: retryCount + 1,
          maxRetries
        });
      }

      // If we've exhausted retries, throw the error
      throw new Error(`Failed to generate valid JSON object after ${maxRetries + 1} attempts: ${parseError.message}`);
    }
  } catch (fallbackError) {
    // Check if we can retry for other types of errors
    if (retryCount < maxRetries && !fallbackError.message.includes('after')) {
      log('info', `Retrying due to error: ${fallbackError.message} (attempt ${retryCount + 2}/${maxRetries + 1})...`);

      // Retry with slightly different parameters
      return await generateWithJSONFallback({
        apiKey,
        baseUrl,
        modelId,
        messages,
        schema,
        objectName,
        maxTokens: maxTokens ? Math.min(maxTokens + 500, 4000) : 2000, // Increase max tokens if specified
        temperature: Math.min(temperature + 0.1, 1.0), // Slightly increase temperature
        customHeaders,
        retryCount: retryCount + 1,
        maxRetries
      });
    }

    log('error', `JSON fallback attempt failed after ${retryCount + 1} attempts: ${fallbackError.message}`, { fallbackError });
    throw new Error(`Custom provider failed to generate object via JSON fallback: ${fallbackError.message}`);
  }
}
