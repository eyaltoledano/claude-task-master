/**
 * VibeKit Service
 * Simplified service using VibeKit SDK for AI agent execution
 */

import { VibeKit } from '@vibe-kit/sdk';

export class VibeKitService {
  constructor(config = {}) {
    this.config = {
      defaultAgent: config.defaultAgent || 'claude',
      environment: {
        e2b: {
          apiKey: process.env.E2B_API_KEY
        }
      },
      github: {
        token: process.env.GITHUB_TOKEN,
        repository: config.repository
      },
      ...config
    };
  }

  /**
   * Create VibeKit instance with task context
   */
  createVibeKit(taskContext = {}) {
    const config = {
      agent: {
        type: taskContext.agent || this.config.defaultAgent,
        model: {
          apiKey: this.getApiKeyForAgent(taskContext.agent || this.config.defaultAgent)
        }
      },
      environment: this.config.environment
    };

    // Only add github config if token is available
    if (this.config.github.token) {
      config.github = this.config.github;
    }

    return new VibeKit(config);
  }

  /**
   * Execute code generation with streaming
   */
  async generateCode(prompt, options = {}) {
    const vibeKit = this.createVibeKit(options.taskContext);
    
    return await vibeKit.generateCode({
      prompt: this.enhancePromptWithContext(prompt, options.taskContext),
      mode: options.mode || "code",
      callbacks: {
        onUpdate: options.onUpdate || ((data) => console.log("Update:", data)),
        onError: options.onError || ((error) => console.error("Error:", error))
      }
    });
  }

  /**
   * Execute task-specific code generation
   */
  async executeTask(task, options = {}) {
    const prompt = this.createTaskPrompt(task);
    const taskContext = {
      taskId: task.id,
      projectRoot: options.projectRoot,
      branch: options.branch,
      agent: options.agent
    };

    return await this.generateCode(prompt, {
      ...options,
      taskContext,
      onUpdate: (data) => {
        // Emit progress updates for TUI
        if (options.onProgress) {
          options.onProgress({
            taskId: task.id,
            phase: 'executing',
            progress: data.progress || 0,
            message: data.message || 'Processing...',
            data
          });
        }
      }
    });
  }

  enhancePromptWithContext(prompt, context = {}) {
    if (!context.taskId) return prompt;

    return `
# Task Context
- Task ID: ${context.taskId}
- Project: ${context.projectRoot || 'Unknown'}
- Branch: ${context.branch || 'main'}

# Task Prompt
${prompt}

Please implement this task following best practices and include appropriate error handling.
    `;
  }

  createTaskPrompt(task) {
    return `
# Task: ${task.title}

## Description
${task.description}

## Implementation Details
${task.details || 'No additional details provided.'}

## Test Strategy
${task.testStrategy || 'Create appropriate tests for this implementation.'}

Please implement this task completely, including any necessary dependencies, error handling, and tests.
    `;
  }

  getApiKeyForAgent(agentType) {
    switch (agentType) {
      case 'claude':
        return process.env.ANTHROPIC_API_KEY;
      case 'codex':
        return process.env.OPENAI_API_KEY;
      case 'gemini':
        return process.env.GOOGLE_API_KEY;
      case 'opencode':
        return process.env.OPENCODE_API_KEY;
      default:
        return process.env.ANTHROPIC_API_KEY; // Default to Claude
    }
  }
}
