/**
 * AI Provider interfaces and types for claude-task-master
 */

import type { Task, Subtask } from './task.js';

/**
 * Parameters for text generation
 */
export interface GenerateTextParams {
  apiKey: string;
  modelId: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  maxTokens?: number;
  temperature?: number;
  baseUrl?: string;
  headers?: Record<string, string>;
  [key: string]: any; // Allow additional provider-specific parameters
}

/**
 * Parameters for streaming text generation
 */
export interface StreamTextParams extends GenerateTextParams {
  onToken?: (token: string) => void;
  onFinish?: (text: string) => void;
}

/**
 * Parameters for structured object generation
 */
export interface GenerateObjectParams<T = any> extends GenerateTextParams {
  schema: any; // Zod schema or similar
  schemaName?: string;
  schemaDescription?: string;
}

/**
 * Usage data for AI calls
 */
export interface UsageData {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Result from text generation
 */
export interface GenerateTextResult {
  text: string;
  usage?: UsageData;
  finishReason?: string;
  model?: string;
}

/**
 * Result from streaming text generation
 */
export interface StreamTextResult {
  textStream: AsyncIterable<string>;
  usage?: Promise<UsageData>;
  finishReason?: Promise<string>;
  model?: string;
}

/**
 * Result from object generation
 */
export interface GenerateObjectResult<T = any> {
  object: T;
  usage?: UsageData;
  finishReason?: string;
  model?: string;
}

/**
 * Base AI Provider interface
 */
export interface AIProvider {
  /**
   * Generate text from a prompt
   */
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
  
  /**
   * Stream text generation
   */
  streamText(params: StreamTextParams): Promise<StreamTextResult>;
  
  /**
   * Generate structured objects
   */
  generateObject<T = any>(params: GenerateObjectParams<T>): Promise<GenerateObjectResult<T>>;
}

/**
 * Extended AI Provider interface for task management operations
 */
export interface TaskAIProvider extends AIProvider {
  /**
   * Generate tasks from a Product Requirements Document
   */
  generateTasks(prd: string, options?: {
    systemPrompt?: string;
    maxTasks?: number;
  }): Promise<Task[]>;
  
  /**
   * Expand a task into subtasks
   */
  expandTask(task: Task, options?: {
    systemPrompt?: string;
    targetSubtasks?: number;
    research?: boolean;
  }): Promise<Subtask[]>;
  
  /**
   * Update a task based on a prompt
   */
  updateTask(task: Task, prompt: string, options?: {
    systemPrompt?: string;
    research?: boolean;
  }): Promise<Task>;
  
  /**
   * Analyze task complexity
   */
  analyzeComplexity(tasks: Task[], options?: {
    systemPrompt?: string;
    research?: boolean;
  }): Promise<{
    tasks: Array<Task & { complexityScore: number }>;
    summary: string;
  }>;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  headers?: Record<string, string>;
  maxRetries?: number;
  timeout?: number;
}

/**
 * Available provider names
 */
export type ProviderName = 
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'perplexity'
  | 'mistral'
  | 'azure'
  | 'openrouter'
  | 'xai'
  | 'ollama';

/**
 * Provider role in the system
 */
export type ProviderRole = 'main' | 'research' | 'fallback';

/**
 * Service parameters for unified AI service calls
 */
export interface ServiceParams {
  role: ProviderRole;
  session?: any; // MCP session object
  projectRoot?: string;
  prompt: string;
  systemPrompt?: string;
  commandName: string;
  outputType?: 'cli' | 'mcp';
  messages?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  schema?: any;
  schemaName?: string;
  schemaDescription?: string;
}

/**
 * Model information
 */
export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderName;
  contextWindow?: number;
  maxOutput?: number;
  cost_per_1m_tokens?: {
    input: number;
    output: number;
    currency: string;
  };
  capabilities?: string[];
  deprecated?: boolean;
}

/**
 * AI usage tracking
 */
export interface AIUsageLog {
  timestamp: Date;
  provider: ProviderName;
  model: string;
  command: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost?: {
    input: number;
    output: number;
    total: number;
    currency: string;
  };
  duration?: number;
  success: boolean;
  error?: string;
}