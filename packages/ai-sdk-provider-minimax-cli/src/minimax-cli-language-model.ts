/**
 * Minimax CLI Language Model implementation for AI SDK v5
 */
import {
  LanguageModelV1,
  LanguageModelV1CallOptions,
  LanguageModelV1FinishReason,
  LanguageModelV1LogProbs,
  LanguageModelV1StreamPart
} from '@ai-sdk/provider-utils';
import { createIdGenerator } from '@ai-sdk/provider-utils';
import type { MinimaxCliSettings, MinimaxCliModelId, MinimaxCliLanguageModelOptions } from './types.js';
import { 
  convertToMinimaxCliMessages, 
  convertFromMinimaxCliResponse,
  createPromptFromMinimaxCliMessages,
  escapeMinimaxCliArg
} from './message-converter.js';
import { createMinimaxCliAPIError, createMinimaxCliTimeoutError, createMinimaxCliInstallationError } from './errors.js';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import fs from 'fs/promises';

const generateId = createIdGenerator({
  prefix: 'minimax-cli',
  size: 16,
});

export class MinimaxCliLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1';
  readonly modelId: MinimaxCliModelId;
  readonly settings: MinimaxCliSettings;

  constructor(options: MinimaxCliLanguageModelOptions) {
    this.modelId = options.modelId;
    this.settings = options.settings ?? {};
  }

  get provider(): string {
    return 'minimax-cli';
  }

  private async checkMinimaxCliInstallation(): Promise<boolean> {
    return new Promise((resolve) => {
      exec('mini-agent --version', (error) => {
        if (error) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  private async getApiKey(): Promise<string | undefined> {
    // Check environment variable first
    if (process.env.MINIMAX_CLI_API_KEY) {
      return process.env.MINIMAX_CLI_API_KEY;
    }

    // Check Mini-agent CLI config file if it exists
    try {
      const configPath = join(require('os').homedir(), '.minimax', 'config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);
      return config.apiKey || config['api-key'];
    } catch (e) {
      // Config file doesn't exist or is invalid, continue
    }

    return undefined;
  }

  /**
   * Execute Minimax CLI command
   */
  private async executeMinimaxCli(
    args: string[],
    options: { apiKey?: string; timeout?: number } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    const { timeout = this.settings.timeout ?? 30000 } = options;
    
    // Use spawn for better control and timeout handling
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout;
      
      const child = spawn('mini-agent', args, {
        env: {
          ...process.env,
          ...(options.apiKey ? { MINIMAX_CLI_API_KEY: options.apiKey } : {})
        },
        timeout: timeout
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        if (timer) clearTimeout(timer);
        reject(error);
      });

      child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code });
      });

      // Set timeout
      timer = setTimeout(() => {
        child.kill();
        reject(createMinimaxCliTimeoutError({
          message: `Mini-agent CLI command timed out after ${timeout}ms`,
          timeout,
          cause: new Error('Command timeout')
        }));
      }, timeout);
    });
  }

  async doGenerate(options: Parameters<LanguageModelV1['doGenerate']>[0]) {
    // Check CLI installation
    const isInstalled = await this.checkMinimaxCliInstallation();
    if (!isInstalled) {
      throw createMinimaxCliInstallationError({
        message: 'Mini-agent CLI is not installed. Please install with: npm install -g @minimaxi/mini-agent'
      });
    }

    // Get API key
    const apiKey = options.apiKey ?? this.settings.apiKey ?? await this.getApiKey();
    if (!apiKey) {
      throw new Error('Mini-agent CLI API key not found. Set MINIMAX_CLI_API_KEY environment variable or configure mini-agent.');
    }

    // Convert messages to Minimax CLI format
    const minimaxMessages = convertToMinimaxCliMessages(options.messages);
    const prompt = createPromptFromMinimaxCliMessages(minimaxMessages);

    // Build command arguments
    const args = ['chat', '--model', this.modelId, '--prompt', prompt];

    // Add any supported parameters
    if (options.mode.type === 'regular') {
      const { temperature, maxTokens, topP, topK } = options.mode;

      if (temperature != null) {
        // Minimax CLI may not support all parameters, warn about unsupported ones
        console.warn(`Mini-agent CLI does not support the temperature parameter. It will be ignored.`);
      }
      if (maxTokens != null) {
        console.warn(`Mini-agent CLI does not support the maxTokens parameter. It will be ignored.`);
      }
      if (topP != null) {
        console.warn(`Mini-agent CLI does not support the topP parameter. It will be ignored.`);
      }
      if (topK != null) {
        console.warn(`Mini-agent CLI does not support the topK parameter. It will be ignored.`);
      }
    }

    try {
      const result = await this.executeMinimaxCli(args, { apiKey, timeout: this.settings.timeout });

      if (result.exitCode !== 0) {
        if (result.stderr.includes('Authentication') || result.stderr.includes('auth')) {
          throw createMinimaxCliAPIError({
            message: `Mini-agent CLI authentication failed: ${result.stderr}`,
            statusCode: 401,
            url: 'minimax-cli://auth',
            cause: new Error(result.stderr)
          });
        }
        
        throw createMinimaxCliAPIError({
          message: `Mini-agent CLI failed with exit code ${result.exitCode}: ${result.stderr || 'Unknown error'}`,
          statusCode: 500,
          url: 'minimax-cli://command',
          cause: new Error(result.stderr || `Exit code: ${result.exitCode}`)
        });
      }

      const response = convertFromMinimaxCliResponse(result.stdout);

      return {
        text: response.choices[0]?.content ?? '',
        finishReason: 'stop' as LanguageModelV1FinishReason, // Default finish reason
        usage: {
          promptTokens: 0, // Minimax CLI may not provide token usage
          completionTokens: 0,
          totalTokens: 0
        },
        rawCall: { rawPrompt: { type: 'prompt', messages: options.messages }, rawSettings: {} },
        providerMetadata: {
          'minimax-cli': {
            model: this.modelId,
            command: ['mini-agent', ...args].join(' ')
          }
        }
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        throw error; // Re-throw timeout errors
      }
      
      throw createMinimaxCliAPIError({
        message: `Mini-agent CLI execution failed: ${(error as Error).message}`,
        statusCode: 500,
        url: 'minimax-cli://command',
        cause: error
      });
    }
  }

  /**
   * Stream text using Minimax CLI
   * Note: Minimax CLI doesn't natively support streaming, so this simulates streaming
   */
  async doStream(options: Parameters<LanguageModelV1['doStream']>[0]) {
    // Check CLI installation
    const isInstalled = await this.checkMinimaxCliInstallation();
    if (!isInstalled) {
      throw createMinimaxCliInstallationError({
        message: 'Mini-agent CLI is not installed. Please install with: npm install -g @minimaxi/mini-agent'
      });
    }

    // Get API key
    const apiKey = options.apiKey ?? this.settings.apiKey ?? await this.getApiKey();
    if (!apiKey) {
      throw new Error('Mini-agent CLI API key not found. Set MINIMAX_CLI_API_KEY environment variable or configure mini-agent.');
    }

    // Convert messages to Minimax CLI format
    const minimaxMessages = convertToMinimaxCliMessages(options.messages);
    const prompt = createPromptFromMinimaxCliMessages(minimaxMessages);

    // Build command arguments
    const args = ['chat', '--model', this.modelId, '--prompt', prompt, '--stream'];

    // Add any supported parameters
    if (options.mode.type === 'regular') {
      const { temperature, maxTokens, topP, topK } = options.mode;

      if (temperature != null) {
        console.warn(`Mini-agent CLI does not support the temperature parameter. It will be ignored.`);
      }
      if (maxTokens != null) {
        console.warn(`Mini-agent CLI does not support the maxTokens parameter. It will be ignored.`);
      }
      if (topP != null) {
        console.warn(`Mini-agent CLI does not support the topP parameter. It will be ignored.`);
      }
      if (topK != null) {
        console.warn(`Mini-agent CLI does not support the topK parameter. It will be ignored.`);
      }
    }

    const abortController = new AbortController();

    // Create a readable stream
    const stream = new ReadableStream<LanguageModelV1StreamPart>({
      async start(controller) {
        try {
          const result = await this.executeMinimaxCli(args, { apiKey, timeout: this.settings.timeout });

          if (result.exitCode !== 0) {
            if (result.stderr.includes('Authentication') || result.stderr.includes('auth')) {
              controller.error(new Error(`Mini-agent CLI authentication failed: ${result.stderr}`));
              return;
            }
            
            controller.error(new Error(`Mini-agent CLI failed with exit code ${result.exitCode}: ${result.stderr || 'Unknown error'}`));
              return;
          }

          // If Mini-agent CLI supports streaming, process the output line by line
          const lines = result.stdout.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            try {
              // Parse each line as a streaming response part
              const data = JSON.parse(line);
              
              controller.enqueue({
                type: 'text-delta',
                textDelta: data.content || ''
              });
            } catch (e) {
              // If it's not JSON, treat as plain text
              controller.enqueue({
                type: 'text-delta',
                textDelta: line
              });
            }
          }

          // Send completion
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
          });

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return {
      stream,
      rawCall: { rawPrompt: { type: 'prompt', messages: options.messages }, rawSettings: {} }
    };
  }
}