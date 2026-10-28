/**
 * Generated from ai-sdk-provider-gemini-cli 1.4.0, dist/index.mjs.
 * Upstream SHA-256: 8212d6bec119b9d72aac97417e3e26c4c30fa33249bdadeaf72634e37264d934
 * Copyright (c) 2025 Ben Vargas. MIT License; see ./LICENSE.
 * Only the Gemini core import is narrowed; the obsolete source map is removed.
 * Regenerate: node scripts/generate-gemini-sdk-compat.mjs
 */
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/gemini-provider.ts
import { NoSuchModelError } from "@ai-sdk/provider";

// src/gemini-language-model.ts
import { randomUUID as randomUUID2 } from "crypto";

// src/client.ts
import { randomUUID } from "crypto";
import {
  createContentGenerator,
  createContentGeneratorConfig,
  AuthType
} from "@google/gemini-cli-core/dist/src/core/contentGenerator.js";
async function initializeGeminiClient(options, modelId) {
  let authType;
  if (options.authType === "api-key" || options.authType === "gemini-api-key") {
    authType = AuthType.USE_GEMINI;
  } else if (options.authType === "vertex-ai") {
    authType = AuthType.USE_VERTEX_AI;
  } else if (options.authType === "oauth" || options.authType === "oauth-personal") {
    authType = AuthType.LOGIN_WITH_GOOGLE;
  } else if (options.authType === "google-auth-library") {
    authType = AuthType.USE_GEMINI;
  }
  const sessionId = randomUUID();
  const baseConfig = {
    // Required methods (currently working)
    getModel: () => modelId,
    getProxy: () => options.proxy || process.env.HTTP_PROXY || process.env.HTTPS_PROXY || void 0,
    getUsageStatisticsEnabled: () => false,
    // Disable telemetry by default
    getContentGeneratorConfig: () => ({
      authType,
      // Keep as AuthType | undefined for consistency
      model: modelId,
      apiKey: "apiKey" in options ? options.apiKey : void 0,
      vertexai: options.authType === "vertex-ai" ? true : void 0,
      proxy: options.proxy
    }),
    // Core safety methods - most likely to be called
    getSessionId: () => sessionId,
    getDebugMode: () => false,
    getTelemetryEnabled: () => false,
    getTargetDir: () => process.cwd(),
    getFullContext: () => false,
    getIdeMode: () => false,
    getCoreTools: () => [],
    getExcludeTools: () => [],
    getMaxSessionTurns: () => 100,
    getFileFilteringRespectGitIgnore: () => true,
    // OAuth-specific methods (required for LOGIN_WITH_GOOGLE auth)
    isBrowserLaunchSuppressed: () => false
    // Allow browser launch for OAuth flow
  };
  const configMock = new Proxy(baseConfig, {
    get(target, prop) {
      if (prop in target) {
        return target[prop];
      }
      if (typeof prop === "string") {
        if (prop.startsWith("get") || prop.startsWith("is") || prop.startsWith("has")) {
          if (process.env.DEBUG) {
            console.warn(
              `[ai-sdk-provider-gemini-cli] Unknown config method called: ${prop}()`
            );
          }
          return () => {
            if (prop.startsWith("is") || prop.startsWith("has")) {
              return false;
            }
            if (prop.startsWith("get")) {
              if (prop.includes("Enabled") || prop.includes("Mode")) {
                return false;
              }
              if (prop.includes("Registry") || prop.includes("Client") || prop.includes("Service")) {
                return void 0;
              }
              if (prop.includes("Config") || prop.includes("Options")) {
                return {};
              }
              if (prop.includes("Command") || prop.includes("Path")) {
                return void 0;
              }
              return void 0;
            }
            return void 0;
          };
        }
      }
      return void 0;
    }
  });
  const config = await createContentGeneratorConfig(
    configMock,
    authType
  );
  if ((options.authType === "api-key" || options.authType === "gemini-api-key") && options.apiKey) {
    config.apiKey = options.apiKey;
  } else if (options.authType === "vertex-ai" && options.vertexAI) {
    config.vertexai = true;
  }
  const client = await createContentGenerator(
    config,
    configMock,
    sessionId
  );
  return { client, config, sessionId };
}

// src/message-mapper.ts
function mapPromptToGeminiFormat(options) {
  const messages = options.prompt;
  const contents = [];
  let systemInstruction;
  for (const message of messages) {
    switch (message.role) {
      case "system":
        systemInstruction = {
          role: "user",
          parts: [{ text: message.content }]
        };
        break;
      case "user":
        contents.push(mapUserMessage(message));
        break;
      case "assistant":
        contents.push(mapAssistantMessage(message));
        break;
      case "tool": {
        const parts = [];
        for (const part of message.content) {
          if (part.type === "tool-result") {
            parts.push({
              functionResponse: {
                name: part.toolName,
                response: typeof part.output === "string" ? { result: part.output } : part.output
              }
            });
          }
        }
        contents.push({
          role: "user",
          parts
        });
        break;
      }
    }
  }
  return { contents, systemInstruction };
}
function mapUserMessage(message) {
  const parts = [];
  for (const part of message.content) {
    switch (part.type) {
      case "text":
        parts.push({ text: part.text });
        break;
      case "file": {
        const mediaType = part.mediaType || "application/octet-stream";
        if (mediaType.startsWith("image/")) {
          parts.push(mapImagePart(part));
        } else {
          throw new Error(`Unsupported file type: ${mediaType}`);
        }
        break;
      }
    }
  }
  return { role: "user", parts };
}
function mapAssistantMessage(message) {
  const parts = [];
  for (const part of message.content) {
    switch (part.type) {
      case "text":
        parts.push({ text: part.text });
        break;
      case "tool-call":
        parts.push({
          functionCall: {
            name: part.toolName,
            args: part.input || {}
          }
        });
        break;
    }
  }
  return { role: "model", parts };
}
function mapImagePart(part) {
  if (part.data instanceof URL) {
    throw new Error(
      "URL images are not supported by Gemini CLI Core. Please provide base64-encoded image data."
    );
  }
  const mimeType = part.mediaType || "image/jpeg";
  let base64Data;
  if (typeof part.data === "string") {
    base64Data = part.data;
  } else if (part.data instanceof Uint8Array) {
    base64Data = Buffer.from(part.data).toString("base64");
  } else {
    throw new Error("Unsupported image format");
  }
  return {
    inlineData: {
      mimeType,
      data: base64Data
    }
  };
}

// src/tool-mapper.ts
import {
  FunctionCallingConfigMode
} from "@google/genai";
import { z } from "zod";
function mapToolsToGeminiFormat(tools) {
  const functionDeclarations = [];
  for (const tool of tools) {
    functionDeclarations.push({
      name: tool.name,
      description: tool.description,
      parameters: convertToolParameters(tool.inputSchema)
    });
  }
  return [{ functionDeclarations }];
}
function convertZodToJsonSchema(zodSchema) {
  const zodWithToJSONSchema = z;
  if (zodWithToJSONSchema.toJSONSchema && typeof zodWithToJSONSchema.toJSONSchema === "function") {
    try {
      return zodWithToJSONSchema.toJSONSchema(zodSchema);
    } catch {
    }
  }
  try {
    const zodToJsonSchemaModule = __require("zod-to-json-schema");
    return zodToJsonSchemaModule.zodToJsonSchema(zodSchema);
  } catch {
  }
  console.warn(
    "Unable to convert Zod schema to JSON Schema. For Zod v3, install zod-to-json-schema. For Zod v4, use z.toJSONSchema() function."
  );
  return { type: "object" };
}
function convertToolParameters(parameters) {
  if (isJsonSchema(parameters)) {
    return cleanJsonSchema(parameters);
  }
  if (isZodSchema(parameters)) {
    const jsonSchema = convertZodToJsonSchema(parameters);
    return cleanJsonSchema(jsonSchema);
  }
  return parameters;
}
function isJsonSchema(obj) {
  return typeof obj === "object" && obj !== null && ("type" in obj || "properties" in obj || "$schema" in obj);
}
function isZodSchema(obj) {
  return typeof obj === "object" && obj !== null && "_def" in obj && typeof obj._def === "object";
}
function cleanJsonSchema(schema) {
  if (typeof schema !== "object" || schema === null) {
    return schema;
  }
  const cleaned = { ...schema };
  delete cleaned.$schema;
  delete cleaned.$ref;
  delete cleaned.$defs;
  delete cleaned.definitions;
  if (cleaned.properties && typeof cleaned.properties === "object") {
    const cleanedProps = {};
    for (const [key, value] of Object.entries(cleaned.properties)) {
      cleanedProps[key] = cleanJsonSchema(value);
    }
    cleaned.properties = cleanedProps;
  }
  if (cleaned.items) {
    cleaned.items = cleanJsonSchema(cleaned.items);
  }
  if (cleaned.additionalProperties && typeof cleaned.additionalProperties === "object") {
    cleaned.additionalProperties = cleanJsonSchema(
      cleaned.additionalProperties
    );
  }
  for (const key of ["allOf", "anyOf", "oneOf"]) {
    const arrayProp = cleaned[key];
    if (Array.isArray(arrayProp)) {
      cleaned[key] = arrayProp.map(
        (item) => cleanJsonSchema(item)
      );
    }
  }
  return cleaned;
}
function mapGeminiToolConfig(options) {
  if (options.toolChoice) {
    const allowedFunctionNames = options.toolChoice.type === "tool" ? [options.toolChoice.toolName] : void 0;
    return {
      functionCallingConfig: {
        allowedFunctionNames,
        mode: mapToolChoiceToGeminiFormat(options.toolChoice)
      }
    };
  }
  return void 0;
}
function mapToolChoiceToGeminiFormat(toolChoice) {
  switch (toolChoice.type) {
    case "auto":
      return FunctionCallingConfigMode.AUTO;
    case "none":
      return FunctionCallingConfigMode.NONE;
    case "required":
    case "tool":
      return FunctionCallingConfigMode.ANY;
    default:
      return FunctionCallingConfigMode.MODE_UNSPECIFIED;
  }
}

// src/error.ts
import { APICallError, LoadAPIKeyError } from "@ai-sdk/provider";
function createAPICallError({
  message,
  code,
  exitCode,
  stderr,
  promptExcerpt,
  isRetryable = false,
  statusCode = 500
}) {
  return new APICallError({
    url: "gemini-cli-core://command",
    requestBodyValues: promptExcerpt ? { prompt: promptExcerpt } : {},
    statusCode,
    responseHeaders: {},
    message,
    data: {
      code,
      exitCode,
      stderr
    },
    isRetryable
  });
}
function createAuthenticationError({
  message
}) {
  return new LoadAPIKeyError({
    message
  });
}
function createTimeoutError({
  message,
  promptExcerpt
}) {
  return createAPICallError({
    message,
    code: "TIMEOUT",
    promptExcerpt,
    isRetryable: true,
    statusCode: 504
  });
}
function isAuthenticationError(error) {
  if (error instanceof LoadAPIKeyError) {
    return true;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("unauthorized") || message.includes("authentication") || message.includes("api key") || message.includes("credentials");
  }
  return false;
}
function isTimeoutError(error) {
  if (error instanceof APICallError) {
    return error.statusCode === 504 || error.data?.code === "TIMEOUT";
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("timeout") || message.includes("timed out");
  }
  return false;
}
function mapGeminiError(error) {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      throw error;
    }
    const message = error.message.toLowerCase();
    if (isAuthenticationError(error)) {
      return createAuthenticationError({
        message: error.message
      });
    }
    if (message.includes("rate limit") || message.includes("quota")) {
      return createAPICallError({
        message: error.message,
        code: "RATE_LIMIT",
        isRetryable: true,
        statusCode: 429
      });
    }
    if (isTimeoutError(error)) {
      return createTimeoutError({
        message: error.message
      });
    }
    if (message.includes("not found") || message.includes("no such model") || message.includes("model") && (message.includes("invalid") || message.includes("not found"))) {
      return createAPICallError({
        message: error.message,
        code: "MODEL_NOT_FOUND",
        isRetryable: false,
        statusCode: 404
      });
    }
    if (message.includes("invalid") || message.includes("bad request")) {
      return createAPICallError({
        message: error.message,
        code: "INVALID_REQUEST",
        isRetryable: false,
        statusCode: 400
      });
    }
    return createAPICallError({
      message: error.message,
      code: "INTERNAL_ERROR",
      isRetryable: true,
      statusCode: 500
    });
  }
  return createAPICallError({
    message: "An unknown error occurred",
    code: "UNKNOWN_ERROR",
    isRetryable: true,
    statusCode: 500
  });
}

// src/logger.ts
var defaultLogger = {
  debug: (message) => console.debug(`[DEBUG] ${message}`),
  info: (message) => console.info(`[INFO] ${message}`),
  warn: (message) => console.warn(`[WARN] ${message}`),
  error: (message) => console.error(`[ERROR] ${message}`)
};
var noopLogger = {
  debug: () => {
  },
  info: () => {
  },
  warn: () => {
  },
  error: () => {
  }
};
function getLogger(logger) {
  if (logger === false) {
    return noopLogger;
  }
  if (logger === void 0) {
    return defaultLogger;
  }
  return logger;
}
function createVerboseLogger(logger, verbose = false) {
  if (verbose) {
    return logger;
  }
  return {
    debug: () => {
    },
    // Suppressed in non-verbose mode
    info: () => {
    },
    // Suppressed in non-verbose mode
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger)
  };
}

// src/gemini-language-model.ts
function mapGeminiFinishReason(geminiReason) {
  switch (geminiReason) {
    case "STOP":
      return "stop";
    case "MAX_TOKENS":
      return "length";
    case "SAFETY":
    case "RECITATION":
      return "content-filter";
    case "OTHER":
      return "other";
    default:
      return "unknown";
  }
}
function prepareGenerationConfig(options, settings) {
  const warnings = [];
  const responseFormat = options.responseFormat;
  const isJsonMode = responseFormat?.type === "json";
  const schema = isJsonMode ? responseFormat.schema : void 0;
  const hasSchema = isJsonMode && schema !== void 0;
  if (isJsonMode && !hasSchema) {
    warnings.push({
      type: "unsupported-setting",
      setting: "responseFormat",
      details: "JSON response format without a schema is not supported. Treating as plain text. Provide a schema for structured output."
    });
  }
  const generationConfig = {
    temperature: options.temperature ?? settings?.temperature,
    topP: options.topP ?? settings?.topP,
    topK: options.topK ?? settings?.topK,
    maxOutputTokens: options.maxOutputTokens ?? settings?.maxOutputTokens,
    stopSequences: options.stopSequences,
    // Only use application/json when we have a schema to enforce it
    responseMimeType: hasSchema ? "application/json" : "text/plain",
    // Pass schema directly to Gemini API for native structured output
    responseJsonSchema: hasSchema ? schema : void 0,
    toolConfig: mapGeminiToolConfig(options)
  };
  return { generationConfig, warnings };
}
var GeminiLanguageModel = class {
  constructor(options) {
    this.specificationVersion = "v2";
    this.provider = "gemini-cli-core";
    this.defaultObjectGenerationMode = "json";
    this.supportsImageUrls = false;
    // CLI Core uses base64 data, not URLs
    this.supportedUrls = {};
    // No native URL support
    this.supportsStructuredOutputs = true;
    this.modelId = options.modelId;
    this.providerOptions = options.providerOptions;
    this.settings = options.settings;
    const baseLogger = getLogger(options.settings?.logger);
    this.logger = createVerboseLogger(
      baseLogger,
      options.settings?.verbose ?? false
    );
  }
  async ensureInitialized() {
    if (this.contentGenerator && this.config) {
      return { contentGenerator: this.contentGenerator, config: this.config };
    }
    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }
    await this.initPromise;
    return { contentGenerator: this.contentGenerator, config: this.config };
  }
  async initialize() {
    try {
      const { client, config } = await initializeGeminiClient(
        this.providerOptions,
        this.modelId
      );
      this.contentGenerator = client;
      this.config = config;
    } catch (error) {
      throw new Error(`Failed to initialize Gemini model: ${String(error)}`);
    }
  }
  /**
   * Non-streaming generation method
   */
  async doGenerate(options) {
    this.logger.debug(
      `[gemini-cli] Starting doGenerate request with model: ${this.modelId}`
    );
    try {
      const { contentGenerator } = await this.ensureInitialized();
      const { contents, systemInstruction } = mapPromptToGeminiFormat(options);
      this.logger.debug(
        `[gemini-cli] Request mode: ${options.responseFormat?.type === "json" ? "object-json" : "regular"}, response format: ${options.responseFormat?.type ?? "none"}`
      );
      this.logger.debug(
        `[gemini-cli] Converted ${options.prompt.length} messages`
      );
      const { generationConfig, warnings } = prepareGenerationConfig(
        options,
        this.settings
      );
      let tools;
      if (options.tools) {
        const functionTools = options.tools.filter(
          (tool) => tool.type === "function"
        );
        if (functionTools.length > 0) {
          tools = mapToolsToGeminiFormat(functionTools);
        }
      }
      const request = {
        model: this.modelId,
        contents,
        config: {
          ...generationConfig,
          systemInstruction,
          tools
        }
      };
      let abortListener;
      if (options.abortSignal) {
        if (options.abortSignal.aborted) {
          const abortError = new Error("Request aborted");
          abortError.name = "AbortError";
          throw abortError;
        }
        abortListener = () => {
        };
        options.abortSignal.addEventListener("abort", abortListener, {
          once: true
        });
      }
      let response;
      const startTime = Date.now();
      try {
        this.logger.debug("[gemini-cli] Executing generateContent request");
        response = await contentGenerator.generateContent(
          request,
          randomUUID2()
        );
        const duration = Date.now() - startTime;
        this.logger.info(
          `[gemini-cli] Request completed - Duration: ${duration}ms`
        );
        if (options.abortSignal?.aborted) {
          const abortError = new Error("Request aborted");
          abortError.name = "AbortError";
          throw abortError;
        }
      } finally {
        if (options.abortSignal && abortListener) {
          options.abortSignal.removeEventListener("abort", abortListener);
        }
      }
      const candidate = response.candidates?.[0];
      const responseContent = candidate?.content;
      const content = [];
      if (responseContent?.parts) {
        for (const part of responseContent.parts) {
          if (part.text) {
            content.push({
              type: "text",
              text: part.text
            });
          } else if (part.functionCall) {
            content.push({
              type: "tool-call",
              toolCallId: randomUUID2(),
              toolName: part.functionCall.name || "",
              input: JSON.stringify(part.functionCall.args || {})
            });
          }
        }
      }
      const inputTokens = response.usageMetadata?.promptTokenCount || 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
      const totalTokens = inputTokens + outputTokens;
      const usage = {
        inputTokens,
        outputTokens,
        totalTokens
      };
      this.logger.debug(
        `[gemini-cli] Token usage - Input: ${inputTokens}, Output: ${outputTokens}, Total: ${totalTokens}`
      );
      const finishReason = mapGeminiFinishReason(candidate?.finishReason);
      this.logger.debug(`[gemini-cli] Finish reason: ${finishReason}`);
      return {
        content,
        finishReason,
        usage,
        rawCall: {
          rawPrompt: { contents, systemInstruction, generationConfig, tools },
          rawSettings: generationConfig
        },
        rawResponse: {
          body: response
        },
        response: {
          id: randomUUID2(),
          timestamp: /* @__PURE__ */ new Date(),
          modelId: this.modelId
        },
        warnings
      };
    } catch (error) {
      this.logger.debug(
        `[gemini-cli] Error during doGenerate: ${error instanceof Error ? error.message : String(error)}`
      );
      throw mapGeminiError(error);
    }
  }
  /**
   * Streaming generation method
   */
  async doStream(options) {
    this.logger.debug(
      `[gemini-cli] Starting doStream request with model: ${this.modelId}`
    );
    try {
      const { contentGenerator } = await this.ensureInitialized();
      const { contents, systemInstruction } = mapPromptToGeminiFormat(options);
      this.logger.debug(
        `[gemini-cli] Stream mode: ${options.responseFormat?.type === "json" ? "object-json" : "regular"}, response format: ${options.responseFormat?.type ?? "none"}`
      );
      this.logger.debug(
        `[gemini-cli] Converted ${options.prompt.length} messages for streaming`
      );
      const { generationConfig, warnings } = prepareGenerationConfig(
        options,
        this.settings
      );
      let tools;
      if (options.tools) {
        const functionTools = options.tools.filter(
          (tool) => tool.type === "function"
        );
        if (functionTools.length > 0) {
          tools = mapToolsToGeminiFormat(functionTools);
        }
      }
      const request = {
        model: this.modelId,
        contents,
        config: {
          ...generationConfig,
          systemInstruction,
          tools
        }
      };
      let abortListener;
      if (options.abortSignal) {
        if (options.abortSignal.aborted) {
          const abortError = new Error("Request aborted");
          abortError.name = "AbortError";
          throw abortError;
        }
        abortListener = () => {
        };
        options.abortSignal.addEventListener("abort", abortListener, {
          once: true
        });
      }
      let streamResponse;
      try {
        this.logger.debug(
          "[gemini-cli] Starting generateContentStream request"
        );
        streamResponse = await contentGenerator.generateContentStream(
          request,
          randomUUID2()
        );
        if (options.abortSignal?.aborted) {
          const abortError = new Error("Request aborted");
          abortError.name = "AbortError";
          throw abortError;
        }
      } catch (error) {
        if (options.abortSignal && abortListener) {
          options.abortSignal.removeEventListener("abort", abortListener);
        }
        throw error;
      }
      const modelId = this.modelId;
      const logger = this.logger;
      const streamWarnings = warnings;
      const stream = new ReadableStream({
        async start(controller) {
          try {
            if (options.abortSignal?.aborted) {
              const abortError = new Error("Request aborted");
              abortError.name = "AbortError";
              controller.error(abortError);
              return;
            }
            let totalInputTokens = 0;
            let totalOutputTokens = 0;
            controller.enqueue({
              type: "stream-start",
              warnings: streamWarnings
            });
            const streamStartTime = Date.now();
            logger.debug("[gemini-cli] Stream started, processing chunks");
            for await (const chunk of streamResponse) {
              if (options.abortSignal?.aborted) {
                const abortError = new Error("Request aborted");
                abortError.name = "AbortError";
                controller.error(abortError);
                break;
              }
              const candidate = chunk.candidates?.[0];
              const content = candidate?.content;
              if (chunk.usageMetadata) {
                totalInputTokens = chunk.usageMetadata.promptTokenCount || 0;
                totalOutputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
              }
              if (content?.parts) {
                for (const part of content.parts) {
                  if (part.text) {
                    controller.enqueue({
                      type: "text-delta",
                      id: randomUUID2(),
                      delta: part.text
                    });
                  } else if (part.functionCall) {
                    controller.enqueue({
                      type: "tool-call",
                      toolCallId: randomUUID2(),
                      toolName: part.functionCall.name || "",
                      input: JSON.stringify(part.functionCall.args || {})
                    });
                  }
                }
              }
              if (candidate?.finishReason) {
                const duration = Date.now() - streamStartTime;
                logger.info(
                  `[gemini-cli] Stream completed - Duration: ${duration}ms`
                );
                logger.debug(
                  `[gemini-cli] Stream token usage - Input: ${totalInputTokens}, Output: ${totalOutputTokens}, Total: ${totalInputTokens + totalOutputTokens}`
                );
                const finishReason = mapGeminiFinishReason(
                  candidate.finishReason
                );
                logger.debug(
                  `[gemini-cli] Stream finish reason: ${finishReason}`
                );
                controller.enqueue({
                  type: "response-metadata",
                  id: randomUUID2(),
                  timestamp: /* @__PURE__ */ new Date(),
                  modelId
                });
                controller.enqueue({
                  type: "finish",
                  finishReason,
                  usage: {
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    totalTokens: totalInputTokens + totalOutputTokens
                  }
                });
              }
            }
            logger.debug("[gemini-cli] Stream finalized, closing stream");
            controller.close();
          } catch (error) {
            logger.debug(
              `[gemini-cli] Error during doStream: ${error instanceof Error ? error.message : String(error)}`
            );
            controller.error(mapGeminiError(error));
          } finally {
            if (options.abortSignal && abortListener) {
              options.abortSignal.removeEventListener("abort", abortListener);
            }
          }
        },
        cancel: () => {
          if (options.abortSignal && abortListener) {
            options.abortSignal.removeEventListener("abort", abortListener);
          }
        }
      });
      return {
        stream,
        rawCall: {
          rawPrompt: { contents, systemInstruction, generationConfig, tools },
          rawSettings: generationConfig
        }
      };
    } catch (error) {
      this.logger.debug(
        `[gemini-cli] Error creating stream: ${error instanceof Error ? error.message : String(error)}`
      );
      throw mapGeminiError(error);
    }
  }
};

// src/validation.ts
function validateAuthOptions(options = {}) {
  const authType = options.authType || "oauth-personal";
  switch (authType) {
    case "api-key":
    case "gemini-api-key":
      if (!("apiKey" in options) || !options.apiKey) {
        throw new Error(`API key is required for ${authType} auth type`);
      }
      return { ...options, authType };
    case "vertex-ai":
      if ("vertexAI" in options && options.vertexAI) {
        if (!options.vertexAI.projectId || options.vertexAI.projectId.trim() === "") {
          throw new Error("Project ID is required for vertex-ai auth type");
        }
        if (!options.vertexAI.location || options.vertexAI.location.trim() === "") {
          throw new Error("Location is required for vertex-ai auth type");
        }
      } else {
        throw new Error(
          "Vertex AI configuration is required for vertex-ai auth type"
        );
      }
      return { ...options, authType };
    case "oauth":
    case "oauth-personal":
      return { ...options, authType };
    case "google-auth-library":
      if (!("googleAuth" in options) || !options.googleAuth) {
        throw new Error(
          "Google Auth Library instance is required for google-auth-library auth type"
        );
      }
      return { ...options, authType };
    default:
      throw new Error(`Invalid auth type: ${String(authType)}`);
  }
}

// src/gemini-provider.ts
function createGeminiProvider(options = {}) {
  const validatedOptions = validateAuthOptions(options);
  const createLanguageModel = (modelId, settings) => {
    return new GeminiLanguageModel({
      modelId,
      providerOptions: validatedOptions,
      settings: {
        maxOutputTokens: 65536,
        // 64K output tokens for Gemini 2.5 models
        ...settings
      }
    });
  };
  const provider = Object.assign(
    function(modelId, settings) {
      if (new.target) {
        throw new Error(
          "The provider function cannot be called with the new keyword."
        );
      }
      return createLanguageModel(modelId, settings);
    },
    {
      languageModel: createLanguageModel,
      chat: createLanguageModel,
      textEmbeddingModel: (modelId) => {
        throw new NoSuchModelError({
          modelId,
          modelType: "textEmbeddingModel",
          message: `Gemini provider does not support text embedding models.`
        });
      },
      imageModel: (modelId) => {
        throw new NoSuchModelError({
          modelId,
          modelType: "imageModel",
          message: `Gemini provider does not support image models.`
        });
      }
    }
  );
  return provider;
}
export {
  createGeminiProvider as createGeminiCliCoreProvider,
  createGeminiProvider
};
