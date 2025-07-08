/**
 * VibeKit Service
 * Enhanced service using VibeKit SDK for AI agent execution
 * Fully aligned with official VibeKit configuration API
 */

import { VibeKit } from '@vibe-kit/sdk';
import path from 'node:path';
import fs from 'node:fs';

export class VibeKitService {
  constructor(config = {}) {
    this.config = {
      defaultAgent: config.defaultAgent || 'claude-code',
      
      // Agent configuration
      agent: {
        type: config.agent?.type || config.defaultAgent || 'claude-code',
        model: {
          apiKey: config.agent?.model?.apiKey,
          name: config.agent?.model?.name,
          provider: config.agent?.model?.provider,
          ...config.agent?.model
        }
      },
      
      // Environment configurations - support all official providers
      environments: {
        e2b: {
          apiKey: process.env.E2B_API_KEY,
          // Additional E2B config options
          ...config.environments?.e2b
        },
        northflank: {
          apiKey: process.env.NORTHFLANK_API_KEY,
          projectId: process.env.NORTHFLANK_PROJECT_ID,
          ...config.environments?.northflank
        },
        daytona: {
          apiKey: process.env.DAYTONA_API_KEY,
          workspaceId: process.env.DAYTONA_WORKSPACE_ID,
          ...config.environments?.daytona
        }
      },
      
      // GitHub integration with full configuration
      github: {
        token: process.env.GITHUB_TOKEN,
        repository: config.repository || this.detectGitRepository(),
        ...config.github
      },
      
      // Telemetry configuration (optional)
      telemetry: config.telemetry || {
        enabled: process.env.VIBEKIT_TELEMETRY_ENABLED === 'true',
        endpoint: process.env.VIBEKIT_TELEMETRY_ENDPOINT,
        apiKey: process.env.VIBEKIT_TELEMETRY_API_KEY,
        samplingRate: parseFloat(process.env.VIBEKIT_TELEMETRY_SAMPLING_RATE || '0.1')
      },
      
      // Session management
      sessionManagement: {
        enabled: config.sessionManagement?.enabled ?? true,
        persistSessions: config.sessionManagement?.persistSessions ?? true,
        sessionDir: config.sessionManagement?.sessionDir || '.taskmaster/flow/sessions'
      },
      
      // Working directory configuration
      workingDirectory: config.workingDirectory || process.cwd(),
      
      ...config
    };
    
    // Ensure session directory exists if session management is enabled
    if (this.config.sessionManagement.enabled && this.config.sessionManagement.persistSessions) {
      const sessionPath = path.join(this.config.workingDirectory, this.config.sessionManagement.sessionDir);
      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
      }
    }
  }

  /**
   * Create VibeKit instance with complete configuration
   */
  createVibeKit(taskContext = {}) {
    const agentType = taskContext.agent || this.config.defaultAgent;
    
    const config = {
      // Agent configuration with full model details
      agent: {
        type: agentType,
        model: {
          apiKey: this.getApiKeyForAgent(agentType),
          name: this.getModelNameForAgent(agentType, taskContext),
          provider: this.getProviderForAgent(agentType),
          // Additional model config from task context
          ...taskContext.modelConfig
        }
      },
      
      // Environment configuration - only include configured providers
      environment: this.getActiveEnvironmentConfig(),
      
      // Working directory
      workingDirectory: taskContext.workingDirectory || this.config.workingDirectory
    };

    // Only add github config if token is available
    if (this.config.github.token) {
      config.github = this.config.github;
    }
    
    // Add telemetry if enabled
    if (this.config.telemetry?.enabled && this.config.telemetry?.endpoint) {
      config.telemetry = this.config.telemetry;
    }
    
    // Add session ID if session management is enabled
    if (this.config.sessionManagement.enabled) {
      config.sessionId = taskContext.sessionId || this.generateSessionId(taskContext);
    }

    return new VibeKit(config);
  }

  /**
   * Execute code generation with enhanced error handling and streaming
   * Follows official VibeKit generateCode API specification
   */
  async generateCode({ prompt, mode, branch, history, callbacks, ...options } = {}) {
    try {
      // Validate required parameters
      if (!prompt || typeof prompt !== 'string') {
        throw new Error('prompt parameter is required and must be a string');
      }
      
      if (!mode || !['ask', 'code'].includes(mode)) {
        throw new Error('mode parameter is required and must be "ask" or "code"');
      }
      
    const vibeKit = this.createVibeKit(options.taskContext);
    
      // Build generateCode parameters according to official API
      const generateOptions = {
      prompt: this.enhancePromptWithContext(prompt, options.taskContext),
        mode,
        // Include optional parameters only if provided
        ...(branch && { branch }),
        ...(history && { history }),
        ...(callbacks && { callbacks })
      };
      
      const result = await vibeKit.generateCode(generateOptions);
      
      // Save session if enabled
      if (this.config.sessionManagement.enabled && this.config.sessionManagement.persistSessions) {
        await this.saveSession(options.taskContext?.sessionId, result);
      }
      
      return result;
    } catch (error) {
      // Enhanced error handling
      console.error('VibeKit generateCode error:', error);
      
      // Check for specific error types
      if (error.message?.includes('API key')) {
        throw new Error(`Missing or invalid API key for ${options.taskContext?.agent || this.config.defaultAgent}. Please check your environment variables.`);
      } else if (error.message?.includes('network')) {
        throw new Error('Network error: Unable to connect to VibeKit service. Please check your internet connection.');
      } else if (error.message?.includes('rate limit')) {
        throw new Error('Rate limit exceeded. Please try again in a few moments.');
      } else if (error.message?.includes('not initialized')) {
        throw new Error(`Agent not initialized: ${error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Execute task-specific code generation with enhanced context
   */
  async executeTask(task, options = {}) {
    const prompt = this.createTaskPrompt(task);
    const taskContext = {
      taskId: task.id,
      projectRoot: options.projectRoot,
      branch: options.branch,
      agent: options.agent,
      sessionId: options.sessionId || `task-${task.id}-${Date.now()}`,
      workingDirectory: options.workingDirectory,
      modelConfig: options.modelConfig
    };

    // Create callbacks that match VibeKit's official API
    const callbacks = {
      onUpdate: (message) => {
        // Emit progress updates for TUI
        if (options.onProgress) {
          options.onProgress({
            taskId: task.id,
            phase: 'executing',
            progress: 50, // Default progress
            message: message || 'Processing...',
            data: { message }
          });
        }
      },
      onError: (error) => {
        if (options.onError) {
          options.onError(error);
        }
      }
    };

    return await this.generateCode({
      prompt,
      mode: options.mode || 'code',
      branch: options.branch,
      history: options.history,
      callbacks,
      taskContext,
      ...options
    });
  }

  /**
   * Backward compatibility helper for old generateCode signature
   * @deprecated Use the new generateCode({ prompt, mode, ... }) signature instead
   */
  async generateCodeLegacy(prompt, options = {}) {
    console.warn('generateCodeLegacy is deprecated. Use generateCode({ prompt, mode, ... }) instead.');
    
    // Convert old options to new API format
    const callbacks = {};
    if (options.onUpdate) callbacks.onUpdate = options.onUpdate;
    if (options.onError) callbacks.onError = options.onError;
    
    return this.generateCode({
      prompt,
      mode: options.mode || 'code',
      branch: options.branch,
      history: options.history,
      callbacks: Object.keys(callbacks).length > 0 ? callbacks : undefined,
      taskContext: options.taskContext,
      ...options
    });
  }

  /**
   * Execute shell commands in the sandbox environment
   * Follows official VibeKit executeCommand API specification
   */
  async executeCommand(command, options = {}) {
    try {
      // Validate required parameters
      if (!command || typeof command !== 'string') {
        throw new Error('command parameter is required and must be a string');
      }

      // Validate options if provided
      if (options.timeoutMs !== undefined && (typeof options.timeoutMs !== 'number' || options.timeoutMs <= 0)) {
        throw new Error('timeoutMs must be a positive number');
      }

      if (options.background !== undefined && typeof options.background !== 'boolean') {
        throw new Error('background must be a boolean');
      }

      if (options.callbacks && typeof options.callbacks !== 'object') {
        throw new Error('callbacks must be an object');
      }

      const vibeKit = this.createVibeKit(options.taskContext);
      
      // Build executeCommand parameters according to official API
      const executeOptions = {
        timeoutMs: options.timeoutMs,
        background: options.background || false,
        callbacks: options.callbacks
      };

      // Remove undefined values to match official API behavior
      Object.keys(executeOptions).forEach(key => {
        if (executeOptions[key] === undefined) {
          delete executeOptions[key];
        }
      });
      
      const result = await vibeKit.executeCommand(command, executeOptions);
      
      // Save session if enabled
      if (this.config.sessionManagement.enabled && this.config.sessionManagement.persistSessions) {
        await this.saveSession(options.taskContext?.sessionId, {
          type: 'executeCommand',
          command,
          result
        });
      }
      
      return result;
    } catch (error) {
      // Enhanced error handling for executeCommand
      console.error('VibeKit executeCommand error:', error);
      
      // Check if this is a validation error first (these should be re-thrown as-is)
      if (error.message?.includes('parameter is required') || 
          error.message?.includes('must be a positive number') ||
          error.message?.includes('must be a boolean') ||
          error.message?.includes('must be an object')) {
        throw error; // Re-throw validation errors unchanged
      }
      
      // Check for specific execution error types
      if (error.message?.includes('timeout exceeded') || error.message?.includes('execution timed out')) {
        throw new Error(`Command execution timed out: ${command}`);
      } else if (error.message?.includes('permission denied')) {
        throw new Error(`Permission denied for command: ${command}`);
      } else if (error.message?.includes('sandbox not available')) {
        throw new Error('Sandbox environment not available. Please check your environment configuration.');
      } else if (error.message?.includes('command not found')) {
        throw new Error(`Command not found: ${command}`);
      } else if (error.message?.includes('resource limit')) {
        throw new Error(`Command exceeded resource limits: ${command}`);
      }
      
      throw error;
    }
  }

  /**
   * Execute command for a specific task with enhanced context
   */
  async executeTaskCommand(task, command, options = {}) {
    const taskContext = {
      taskId: task.id,
      projectRoot: options.projectRoot,
      branch: options.branch,
      agent: options.agent,
      sessionId: options.sessionId || `task-${task.id}-cmd-${Date.now()}`,
      workingDirectory: options.workingDirectory,
      modelConfig: options.modelConfig
    };

    // Create callbacks that match VibeKit's official API
    const callbacks = {
      onUpdate: (message) => {
        // Emit progress updates for TUI
        if (options.onProgress) {
          options.onProgress({
            taskId: task.id,
            phase: 'executing-command',
            progress: 50, // Default progress
            message: message || 'Running command...',
            data: { command, message }
          });
        }
      },
      onError: (error) => {
        if (options.onError) {
          options.onError(error);
        }
      }
    };

    return await this.executeCommand(command, {
      timeoutMs: options.timeoutMs,
      background: options.background,
      callbacks,
      taskContext,
      ...options
    });
  }

  /**
   * Create a GitHub pull request after code generation
   * Follows official VibeKit createPullRequest API specification
   */
  async createPullRequest(labelOptions, branchPrefix) {
    try {
      // Validate labelOptions if provided BEFORE creating VibeKit instance
      if (labelOptions && typeof labelOptions !== 'object') {
        throw new Error('labelOptions must be an object');
      }
      
      if (labelOptions) {
        if (!labelOptions.name || typeof labelOptions.name !== 'string') {
          throw new Error('labelOptions.name is required and must be a string');
        }
        if (!labelOptions.color || typeof labelOptions.color !== 'string') {
          throw new Error('labelOptions.color is required and must be a string');
        }
        if (!labelOptions.description || typeof labelOptions.description !== 'string') {
          throw new Error('labelOptions.description is required and must be a string');
        }
        
        // Validate color format (hex without #)
        if (!/^[0-9a-fA-F]{6}$/.test(labelOptions.color)) {
          throw new Error('labelOptions.color must be a 6-character hex color code without # (e.g., "0e8a16")');
        }
      }
      
      // Validate branchPrefix if provided
      if (branchPrefix !== undefined && typeof branchPrefix !== 'string') {
        throw new Error('branchPrefix must be a string');
      }
      
      // Ensure GitHub configuration is available
      if (!this.config.github?.token) {
        throw new Error('GitHub token is required for createPullRequest. Please configure github.token in your VibeKit settings.');
      }
      
      if (!this.config.github?.repository) {
        throw new Error('GitHub repository is required for createPullRequest. Please configure github.repository in your VibeKit settings.');
      }

      // Only create VibeKit instance after all validation passes
      const vibeKit = this.createVibeKit();
      
      const result = await vibeKit.createPullRequest(labelOptions, branchPrefix);
      
      // Save session if enabled
      if (this.config.sessionManagement.enabled && this.config.sessionManagement.persistSessions) {
        await this.saveSession(`pr-${result.number || result.id}`, {
          type: 'createPullRequest',
          result,
          labelOptions,
          branchPrefix
        });
      }
      
      return result;
    } catch (error) {
      // Enhanced error handling for createPullRequest
      console.error('VibeKit createPullRequest error:', error);
      
      // Check if this is a validation error first (these should be re-thrown as-is)
      if (error.message?.includes('is required') || 
          error.message?.includes('must be a') ||
          error.message?.includes('must be an')) {
        throw error; // Re-throw validation errors unchanged
      }
      
      // Check for specific GitHub/PR creation error types
      if (error.message?.includes('Agent not initialized')) {
        throw new Error('Agent not initialized. Please ensure your VibeKit configuration is complete and valid.');
      } else if (error.message?.includes('GitHub token')) {
        throw new Error('GitHub authentication failed. Please verify your GitHub token has the necessary permissions.');
      } else if (error.message?.includes('repository not found') || error.message?.includes('404')) {
        throw new Error('Repository not found. Please verify the repository URL and ensure the token has access.');
      } else if (error.message?.includes('permission') || error.message?.includes('403')) {
        throw new Error('Insufficient permissions. Please ensure your GitHub token can create pull requests in this repository.');
      } else if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        throw new Error('GitHub API rate limit exceeded. Please wait and try again later.');
      } else if (error.message?.includes('network') || error.message?.includes('ENOTFOUND')) {
        throw new Error('Network error. Please check your internet connection and GitHub API availability.');
      }
      
      throw error;
    }
  }

  /**
   * Create a GitHub pull request for a specific task with enhanced context
   */
  async createTaskPullRequest(task, options = {}) {
    const taskContext = {
      taskId: task.id,
      projectRoot: options.projectRoot,
      branch: options.branch,
      agent: options.agent,
      sessionId: options.sessionId || `task-${task.id}-pr-${Date.now()}`,
      workingDirectory: options.workingDirectory,
      modelConfig: options.modelConfig
    };

    // Create default label options based on task if not provided
    const defaultLabelOptions = options.labelOptions || {
      name: `task-${task.id}`,
      color: '0e8a16', // GitHub green
      description: `Task ${task.id}: ${task.title}`
    };

    // Create default branch prefix based on task if not provided
    const defaultBranchPrefix = options.branchPrefix || `task-${task.id}`;

    // Emit progress for TUI integration
    if (options.onProgress) {
      options.onProgress({
        taskId: task.id,
        phase: 'creating-pull-request',
        progress: 25,
        message: 'Preparing pull request...',
        data: { 
          labelOptions: defaultLabelOptions,
          branchPrefix: defaultBranchPrefix
        }
      });
    }

    try {
      const result = await this.createPullRequest(defaultLabelOptions, defaultBranchPrefix);
      
      // Emit completion progress
      if (options.onProgress) {
        options.onProgress({
          taskId: task.id,
          phase: 'pull-request-created',
          progress: 100,
          message: `Pull request created: #${result.number}`,
          data: { 
            pullRequestNumber: result.number,
            pullRequestUrl: result.url,
            result
          }
        });
      }
      
      return result;
    } catch (error) {
      // Emit error progress
      if (options.onProgress) {
        options.onProgress({
          taskId: task.id,
          phase: 'pull-request-error',
          progress: 0,
          message: `Failed to create pull request: ${error.message}`,
          data: { error: error.message }
        });
      }
      
      throw error;
    }
  }

  /**
   * Complete development workflow: generate code, run commands, run tests, create PR/push
   * Combines generateCode, executeCommand, runTests, and createPullRequest/pushToBranch for full automation
   */
  async executeCompleteWorkflow(task, options = {}) {
    const workflowId = `workflow-${task.id}-${Date.now()}`;
    const workflowResult = {
      taskId: task.id,
      workflowId,
      steps: {
        codeGeneration: null,
        commandExecution: null,
        testExecution: null,
        pullRequestCreation: null,
        branchPush: null,
        sandboxCleanup: null,
        sandboxPause: null,
        sandboxResume: null,
        hostUrls: []
      },
      success: false,
      error: null
    };

    try {
      // Step 1: Session Management (getSession/setSession)
      let sessionId = null;
      try {
        sessionId = await this.getSession();
        if (sessionId) {
          if (options.onProgress) {
            options.onProgress({
              taskId: task.id,
              phase: 'workflow-session',
              progress: 5,
              message: `Working with session: ${sessionId}`,
              data: { workflowId, step: 'session-check', sessionId }
            });
          }
        } else {
          if (options.onProgress) {
            options.onProgress({
              taskId: task.id,
              phase: 'workflow-session',
              progress: 5,
              message: 'No active session - will be created during generateCode',
              data: { workflowId, step: 'session-check', sessionId: null }
            });
          }
        }
        
        // Allow session override via options.sessionId
        if (options.sessionId && options.sessionId !== sessionId) {
          if (options.onProgress) {
            options.onProgress({
              taskId: task.id,
              phase: 'workflow-session-switch',
              progress: 7,
              message: `Switching to specified session: ${options.sessionId}`,
              data: { workflowId, step: 'session-switch', fromSession: sessionId, toSession: options.sessionId }
            });
          }
          
          await this.setSession(options.sessionId);
          sessionId = options.sessionId;
          
          if (options.onProgress) {
            options.onProgress({
              taskId: task.id,
              phase: 'workflow-session-switched',
              progress: 8,
              message: `Session switched successfully: ${sessionId}`,
              data: { workflowId, step: 'session-switch', sessionId }
            });
          }
        }
      } catch (error) {
        if (options.onProgress) {
          options.onProgress({
            taskId: task.id,
            phase: 'workflow-session-error',
            progress: 5,
            message: `Session management failed: ${error.message}`,
            data: { workflowId, step: 'session-check', error: error.message }
          });
        }
        // Continue execution - session will be created during generateCode if needed
      }

      // Step 2: Generate Code
      if (options.onProgress) {
        options.onProgress({
          taskId: task.id,
          phase: 'workflow-start',
          progress: 10,
          message: 'Starting complete development workflow...',
          data: { workflowId, step: 'initialization' }
        });
      }

      if (options.generateCode !== false) { // Allow skipping code generation
        if (options.onProgress) {
          options.onProgress({
            taskId: task.id,
            phase: 'workflow-code-generation',
            progress: 20,
            message: 'Generating code with AI...',
            data: { step: 'code-generation' }
          });
        }

        workflowResult.steps.codeGeneration = await this.executeTask(task, {
          ...options,
          mode: options.mode || 'code',
          onProgress: (progress) => {
            if (options.onProgress) {
              options.onProgress({
                ...progress,
                phase: 'workflow-code-generation',
                progress: 20 + (progress.progress || 0) * 0.25 // 20-45%
              });
            }
          }
        });
      }

      // Step 3: Execute Commands (if specified)
      if (options.commands && options.commands.length > 0) {
        if (options.onProgress) {
          options.onProgress({
            taskId: task.id,
            phase: 'workflow-command-execution',
            progress: 45,
            message: 'Executing commands...',
            data: { step: 'command-execution', commands: options.commands }
          });
        }

        const commandResults = [];
        for (let i = 0; i < options.commands.length; i++) {
          const command = options.commands[i];
          const commandProgress = 45 + ((i / options.commands.length) * 20); // 45-65%
          
          if (options.onProgress) {
            options.onProgress({
              taskId: task.id,
              phase: 'workflow-command-execution',
              progress: commandProgress,
              message: `Executing: ${command}`,
              data: { step: 'command-execution', currentCommand: command }
            });
          }

          const commandResult = await this.executeTaskCommand(task, command, {
            ...options,
            onProgress: (progress) => {
              if (options.onProgress) {
                options.onProgress({
                  ...progress,
                  phase: 'workflow-command-execution',
                  progress: commandProgress + 3 // Small increment for command progress
                });
              }
            }
          });
          
          commandResults.push({ command, result: commandResult });
        }
        
        workflowResult.steps.commandExecution = commandResults;
      }

      // Step 4: Run Tests (if enabled)
      if (options.runTests !== false) {
        if (options.onProgress) {
          options.onProgress({
            taskId: task.id,
            phase: 'workflow-test-execution',
            progress: 65,
            message: 'Running tests...',
            data: { step: 'test-execution' }
          });
        }

        try {
          workflowResult.steps.testExecution = await this.runTaskTests(task, {
            ...options,
            onProgress: (progress) => {
              if (options.onProgress) {
                options.onProgress({
                  ...progress,
                  phase: 'workflow-test-execution',
                  progress: 65 + (progress.progress || 0) * 0.15 // 65-80%
                });
              }
            }
          });
        } catch (testError) {
          // Log test failure but don't stop workflow unless specified
          if (options.failOnTestFailure !== false) {
            throw new Error(`Test execution failed: ${testError.message}`);
          } else {
            workflowResult.steps.testExecution = {
              success: false,
              error: testError.message,
              exitCode: 1
            };
            
            if (options.onProgress) {
              options.onProgress({
                taskId: task.id,
                phase: 'workflow-test-failed',
                progress: 80,
                message: 'Tests failed but continuing workflow...',
                data: { step: 'test-execution', error: testError.message }
              });
            }
          }
        }
      }

      // Step 5A: Push to Branch (if specified instead of PR)
      if (options.pushToBranch && !options.createPullRequest) {
        if (options.onProgress) {
          options.onProgress({
            taskId: task.id,
            phase: 'workflow-branch-push',
            progress: 80,
            message: `Pushing to branch: ${options.branch || 'default'}`,
            data: { step: 'branch-push', branch: options.branch }
          });
        }

        workflowResult.steps.branchPush = await this.pushToBranch(options.branch);
        
        if (options.onProgress) {
          options.onProgress({
            taskId: task.id,
            phase: 'workflow-branch-pushed',
            progress: 95,
            message: `Successfully pushed to branch: ${options.branch || 'default'}`,
            data: { step: 'branch-push', result: workflowResult.steps.branchPush }
          });
        }
      }
      
      // Step 5B: Create Pull Request (if enabled and not pushing directly)
      else if (options.createPullRequest !== false && this.config.github?.token && !options.pushToBranch) {
        if (options.onProgress) {
          options.onProgress({
            taskId: task.id,
            phase: 'workflow-pull-request',
            progress: 80,
            message: 'Creating pull request...',
            data: { step: 'pull-request-creation' }
          });
        }

        workflowResult.steps.pullRequestCreation = await this.createTaskPullRequest(task, {
          ...options,
          onProgress: (progress) => {
            if (options.onProgress) {
              options.onProgress({
                ...progress,
                phase: 'workflow-pull-request',
                progress: 80 + (progress.progress || 0) * 0.15 // 80-95%
              });
            }
          }
        });
      }

      // Step 6: Cleanup Sandbox (if enabled and using Codex agent)
      if (options.cleanupSandbox !== false && this.config.agent?.type === 'codex') {
        try {
          if (options.onProgress) {
            options.onProgress({
              taskId: task.id,
              phase: 'workflow-cleanup',
              progress: 97,
              message: 'Cleaning up sandbox resources...',
              data: { step: 'sandbox-cleanup' }
            });
          }

          await this.kill();
          workflowResult.steps.sandboxCleanup = {
            success: true,
            message: 'Sandbox terminated successfully'
          };
          
          if (options.onProgress) {
            options.onProgress({
              taskId: task.id,
              phase: 'workflow-cleanup-complete',
              progress: 99,
              message: 'Sandbox cleanup completed',
              data: { step: 'sandbox-cleanup' }
            });
          }
        } catch (cleanupError) {
          // Don't fail the entire workflow for cleanup errors
          workflowResult.steps.sandboxCleanup = {
            success: false,
            error: cleanupError.message
          };
          
          console.warn('Sandbox cleanup failed (non-critical):', cleanupError.message);
          
          if (options.onProgress) {
            options.onProgress({
              taskId: task.id,
              phase: 'workflow-cleanup-warning',
              progress: 99,
              message: 'Sandbox cleanup failed but workflow completed',
              data: { step: 'sandbox-cleanup', warning: cleanupError.message }
            });
          }
        }
      }

      // Workflow completed successfully
      workflowResult.success = true;
      
      if (options.onProgress) {
        options.onProgress({
          taskId: task.id,
          phase: 'workflow-complete',
          progress: 100,
          message: 'Development workflow completed successfully!',
          data: { 
            workflowId,
            summary: {
              codeGenerated: !!workflowResult.steps.codeGeneration,
              commandsExecuted: workflowResult.steps.commandExecution?.length || 0,
              testsRan: !!workflowResult.steps.testExecution,
              testsPassed: workflowResult.steps.testExecution?.exitCode === 0,
              pullRequestCreated: !!workflowResult.steps.pullRequestCreation,
              branchPushed: !!workflowResult.steps.branchPush,
              sandboxCleaned: workflowResult.steps.sandboxCleanup?.success === true,
              pullRequestNumber: workflowResult.steps.pullRequestCreation?.number,
              branchName: workflowResult.steps.branchPush?.branch
            }
          }
        });
      }

      // Save complete workflow session
      if (this.config.sessionManagement.enabled && this.config.sessionManagement.persistSessions) {
        await this.saveSession(workflowId, {
          type: 'completeWorkflow',
          taskId: task.id,
          result: workflowResult
        });
      }

      return workflowResult;

    } catch (error) {
      // Attempt cleanup on error if enabled and using Codex agent
      if (options.cleanupOnError !== false && this.config.agent?.type === 'codex') {
        try {
          if (options.onProgress) {
            options.onProgress({
              taskId: task.id,
              phase: 'workflow-error-cleanup',
              progress: 0,
              message: 'Attempting sandbox cleanup after error...',
              data: { error: error.message, step: 'error-cleanup' }
            });
          }
          
          await this.kill();
          console.log('Sandbox cleaned up successfully after workflow error');
        } catch (cleanupError) {
          console.warn('Failed to cleanup sandbox after workflow error:', cleanupError.message);
        }
      }

      workflowResult.success = false;
      workflowResult.error = error.message;
      
      if (options.onProgress) {
        options.onProgress({
          taskId: task.id,
          phase: 'workflow-error',
          progress: 0,
          message: `Workflow failed: ${error.message}`,
          data: { error: error.message, workflowId }
        });
      }

      throw error;
    }
  }

  /**
   * Push code changes to a Git branch
   * Follows official VibeKit pushToBranch API specification
   */
  async pushToBranch(branch) {
    try {
      // Validate branch parameter if provided
      if (branch !== undefined && typeof branch !== 'string') {
        throw new Error('branch must be a string');
      }
      
      // Ensure GitHub configuration is available
      if (!this.config.github?.token) {
        throw new Error('GitHub token is required for pushToBranch. Please configure github.token in your VibeKit settings.');
      }
      
      if (!this.config.github?.repository) {
        throw new Error('GitHub repository is required for pushToBranch. Please configure github.repository in your VibeKit settings.');
      }

      // Create VibeKit instance and push to branch
      const vibeKit = this.createVibeKit();
      
      // The official API returns Promise<void>
      await vibeKit.pushToBranch(branch);
      
      // Save session if enabled
      if (this.config.sessionManagement.enabled && this.config.sessionManagement.persistSessions) {
        await this.saveSession(`push-${branch || 'default'}-${Date.now()}`, {
          type: 'pushToBranch',
          branch: branch || 'default',
          timestamp: new Date().toISOString()
        });
      }
      
      // Return success indication since official API returns void
      return {
        success: true,
        branch: branch || 'default',
        message: `Successfully pushed changes to branch: ${branch || 'default'}`
      };
    } catch (error) {
      // Enhanced error handling for pushToBranch
      console.error('VibeKit pushToBranch error:', error);
      
      // Check if this is a validation error first (these should be re-thrown as-is)
      if (error.message?.includes('must be a string') || 
          error.message?.includes('is required')) {
        throw error; // Re-throw validation errors unchanged
      }
      
      // Check for specific Git/branch error types
      if (error.message?.includes('Agent not initialized')) {
        throw new Error('Agent not initialized. Please ensure your VibeKit configuration is complete and valid.');
      } else if (error.message?.includes('GitHub token')) {
        throw new Error('GitHub authentication failed. Please verify your GitHub token has the necessary permissions.');
      } else if (error.message?.includes('repository not found') || error.message?.includes('404')) {
        throw new Error('Repository not found. Please verify the repository URL and ensure the token has access.');
      } else if (error.message?.includes('branch') && error.message?.includes('not found')) {
        throw new Error(`Branch not found. Please ensure the branch exists or the token has permissions to create it.`);
      } else if (error.message?.includes('permission') || error.message?.includes('403')) {
        throw new Error('Insufficient permissions. Please ensure your GitHub token can push to this repository and branch.');
      } else if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        throw new Error('GitHub API rate limit exceeded. Please wait and try again later.');
      } else if (error.message?.includes('network') || error.message?.includes('ENOTFOUND')) {
        throw new Error('Network error. Please check your internet connection and GitHub API availability.');
      } else if (error.message?.includes('merge conflict') || error.message?.includes('conflict')) {
        throw new Error('Push failed due to conflicts. Please resolve conflicts or use a different branch.');
      }
      
      throw error;
    }
  }

  /**
   * Execute tests in the sandbox environment with automatic test runner detection
   * Follows official VibeKit runTests API specification
   */
  async runTests({ branch, history, callbacks } = {}) {
    try {
      // Validate parameters
      if (branch !== undefined && typeof branch !== 'string') {
        throw new Error('branch must be a string');
      }
      
      if (history !== undefined && !Array.isArray(history)) {
        throw new Error('history must be an array of conversation objects');
      }
      
      if (callbacks !== undefined && typeof callbacks !== 'object') {
        throw new Error('callbacks must be an object');
      }
      
      if (callbacks) {
        if (callbacks.onUpdate !== undefined && typeof callbacks.onUpdate !== 'function') {
          throw new Error('callbacks.onUpdate must be a function');
        }
        if (callbacks.onError !== undefined && typeof callbacks.onError !== 'function') {
          throw new Error('callbacks.onError must be a function');
        }
      }

      // Create VibeKit instance and run tests
      const vibeKit = this.createVibeKit();
      
      // Call the official runTests API
      const result = await vibeKit.runTests({ branch, history, callbacks });
      
      // Save session if enabled
      if (this.config.sessionManagement.enabled && this.config.sessionManagement.persistSessions) {
        await this.saveSession(`tests-${branch || 'current'}-${Date.now()}`, {
          type: 'runTests',
          branch: branch || 'current',
          exitCode: result.exitCode,
          timestamp: new Date().toISOString(),
          success: result.exitCode === 0
        });
      }
      
      return result;
    } catch (error) {
      // Enhanced error handling for runTests
      console.error('VibeKit runTests error:', error);
      
      // Check if this is a validation error first (these should be re-thrown as-is)
      if (error.message?.includes('must be a string') || 
          error.message?.includes('must be an array') ||
          error.message?.includes('must be an object') ||
          error.message?.includes('must be a function')) {
        throw error; // Re-throw validation errors unchanged
      }
      
      // Check for specific test execution error types
      if (error.message?.includes('Agent not initialized')) {
        throw new Error('Agent not initialized. Please ensure your VibeKit configuration is complete and valid.');
      } else if (error.message?.includes('sandbox')) {
        throw new Error('Sandbox error. Please ensure the sandbox environment is properly configured and accessible.');
      } else if (error.message?.includes('test runner') || error.message?.includes('no tests found')) {
        throw new Error('Test runner detection failed. Please ensure your project has a valid test configuration.');
      } else if (error.message?.includes('dependencies') || error.message?.includes('package')) {
        throw new Error('Dependency installation failed. Please check your project dependencies and package configuration.');
      } else if (error.message?.includes('permission') || error.message?.includes('403')) {
        throw new Error('Insufficient permissions. Please ensure the agent has access to run tests in the sandbox.');
      } else if (error.message?.includes('timeout')) {
        throw new Error('Test execution timed out. Consider breaking down large test suites or increasing timeout limits.');
      } else if (error.message?.includes('network') || error.message?.includes('ENOTFOUND')) {
        throw new Error('Network error. Please check your internet connection and sandbox accessibility.');
      }
      
      throw error;
    }
  }

  /**
   * Run tests for a specific task with enhanced context and progress tracking
   */
  async runTaskTests(task, options = {}) {
    const taskContext = {
      taskId: task.id,
      projectRoot: options.projectRoot,
      branch: options.branch,
      agent: options.agent,
      sessionId: options.sessionId || `task-${task.id}-tests-${Date.now()}`,
      workingDirectory: options.workingDirectory,
      modelConfig: options.modelConfig
    };

    // Create callbacks that integrate with TUI progress tracking
    const callbacks = {
      onUpdate: (message) => {
        // Emit progress updates for TUI
        if (options.onProgress) {
          options.onProgress({
            taskId: task.id,
            phase: 'running-tests',
            progress: 50, // Test execution progress
            message: message || 'Running tests...',
            data: { 
              testOutput: message,
              taskContext
            }
          });
        }
        
        // Call original callback if provided
        if (options.callbacks?.onUpdate) {
          options.callbacks.onUpdate(message);
        }
      },
      onError: (error) => {
        // Emit error updates for TUI
        if (options.onProgress) {
          options.onProgress({
            taskId: task.id,
            phase: 'test-error',
            progress: 0,
            message: `Test execution failed: ${error.message || error}`,
            data: { 
              error: error.message || error,
              taskContext
            }
          });
        }
        
        // Call original callback if provided
        if (options.callbacks?.onError) {
          options.callbacks.onError(error);
        }
      }
    };

    // Emit start progress
    if (options.onProgress) {
      options.onProgress({
        taskId: task.id,
        phase: 'starting-tests',
        progress: 10,
        message: 'Initializing test execution...',
        data: { taskContext }
      });
    }

    try {
      const result = await this.runTests({
        branch: options.branch,
        history: options.history,
        callbacks
      });
      
      // Emit completion progress
      const testsPassed = result.exitCode === 0;
      if (options.onProgress) {
        options.onProgress({
          taskId: task.id,
          phase: testsPassed ? 'tests-passed' : 'tests-failed',
          progress: 100,
          message: testsPassed ? 'All tests passed!' : `Tests failed with exit code ${result.exitCode}`,
          data: { 
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            testsPassed,
            result
          }
        });
      }
      
      return result;
    } catch (error) {
      // Emit error progress
      if (options.onProgress) {
        options.onProgress({
          taskId: task.id,
          phase: 'test-execution-error',
          progress: 0,
          message: `Test execution failed: ${error.message}`,
          data: { error: error.message }
        });
      }
      
      throw error;
    }
  }

  /**
   * Terminate the active sandbox
   * Follows official VibeKit kill API specification
   */
  async kill() {
    try {
      // Validate that we're using a Codex agent
      if (this.config.agent?.type !== 'codex') {
        throw new Error('Sandbox management is only supported for the Codex agent');
      }
      
      // Create VibeKit instance to access the agent
      const vibeKit = this.createVibeKit();
      
      // Check if the agent is initialized
      if (!vibeKit || !vibeKit.agent) {
        throw new Error('CodexAgent not initialized');
      }
      
      // Call the underlying kill method
      await vibeKit.kill();
      
      // Save session if enabled
      if (this.config.sessionManagement.enabled && this.config.sessionManagement.persistSessions) {
        await this.saveSession(`sandbox-kill-${Date.now()}`, {
          type: 'kill',
          timestamp: new Date().toISOString(),
          success: true
        });
      }
      
      // Method returns void as per API specification
      return;
    } catch (error) {
      // Enhanced error handling for kill operation
      console.error('VibeKit kill error:', error);
      
      // Check if this is a validation error first (these should be re-thrown as-is)
      if (error.message?.includes('only supported for the Codex agent') ||
          error.message?.includes('not initialized')) {
        throw error; // Re-throw validation errors unchanged
      }
      
      // Check for specific sandbox termination error types
      if (error.message?.includes('sandbox not found') || error.message?.includes('already terminated')) {
        throw new Error('Sandbox not found or already terminated. No action needed.');
      } else if (error.message?.includes('permission') || error.message?.includes('403')) {
        throw new Error('Insufficient permissions to terminate the sandbox.');
      } else if (error.message?.includes('network') || error.message?.includes('ENOTFOUND')) {
        throw new Error('Network error. Please check your internet connection and sandbox service availability.');
      } else if (error.message?.includes('timeout')) {
        throw new Error('Sandbox termination timed out. The sandbox may still be terminating.');
      }
      
      throw error;
    }
  }

  /**
   * Pause the active sandbox
   * Follows official VibeKit pause API specification
   */
  async pause() {
    try {
      // Validate that we're using a Codex agent
      if (this.config.agent?.type !== 'codex') {
        throw new Error('Sandbox management is only supported for the Codex agent');
      }
      
      // Create VibeKit instance to access the agent
      const vibeKit = this.createVibeKit();
      
      // Check if the agent is initialized
      if (!vibeKit || !vibeKit.agent) {
        throw new Error('CodexAgent not initialized');
      }
      
      // Call the underlying pause method
      await vibeKit.pause();
      
      // Save session if enabled
      if (this.config.sessionManagement.enabled && this.config.sessionManagement.persistSessions) {
        await this.saveSession(`sandbox-pause-${Date.now()}`, {
          type: 'pause',
          timestamp: new Date().toISOString(),
          success: true
        });
      }
      
      // Method returns void as per API specification
      return;
    } catch (error) {
      // Enhanced error handling for pause operation
      console.error('VibeKit pause error:', error);
      
      // Check if this is a validation error first (these should be re-thrown as-is)
      if (error.message?.includes('only supported for the Codex agent') ||
          error.message?.includes('not initialized')) {
        throw error; // Re-throw validation errors unchanged
      }
      
      // Check for specific sandbox pause error types
      if (error.message?.includes('sandbox not found') || error.message?.includes('already paused')) {
        throw new Error('Sandbox not found or already paused.');
      } else if (error.message?.includes('permission') || error.message?.includes('403')) {
        throw new Error('Insufficient permissions to pause the sandbox.');
      } else if (error.message?.includes('network') || error.message?.includes('ENOTFOUND')) {
        throw new Error('Network error. Please check your internet connection and sandbox service availability.');
      } else if (error.message?.includes('timeout')) {
        throw new Error('Sandbox pause operation timed out. Please try again.');
      } else if (error.message?.includes('resource') || error.message?.includes('limit')) {
        throw new Error('Resource limit reached. Unable to pause sandbox at this time.');
      }
      
      throw error;
    }
  }

  /**
   * Resume the paused sandbox
   * Follows official VibeKit resume API specification
   */
  async resume() {
    try {
      // Validate that we're using a Codex agent
      if (this.config.agent?.type !== 'codex') {
        throw new Error('Sandbox management is only supported for the Codex agent');
      }
      
      // Create VibeKit instance to access the agent
      const vibeKit = this.createVibeKit();
      
      // Check if the agent is initialized
      if (!vibeKit || !vibeKit.agent) {
        throw new Error('CodexAgent not initialized');
      }
      
      // Call the underlying resume method
      await vibeKit.resume();
      
      // Save session if enabled
      if (this.config.sessionManagement.enabled && this.config.sessionManagement.persistSessions) {
        await this.saveSession(`sandbox-resume-${Date.now()}`, {
          type: 'resume',
          timestamp: new Date().toISOString(),
          success: true
        });
      }
      
      // Method returns void as per API specification
      return;
    } catch (error) {
      // Enhanced error handling for resume operation
      console.error('VibeKit resume error:', error);
      
      // Check if this is a validation error first (these should be re-thrown as-is)
      if (error.message?.includes('only supported for the Codex agent') ||
          error.message?.includes('not initialized')) {
        throw error; // Re-throw validation errors unchanged
      }
      
      // Check for specific sandbox resume error types
      if (error.message?.includes('sandbox not found') || error.message?.includes('not paused')) {
        throw new Error('Sandbox not found or not in paused state.');
      } else if (error.message?.includes('permission') || error.message?.includes('403')) {
        throw new Error('Insufficient permissions to resume the sandbox.');
      } else if (error.message?.includes('network') || error.message?.includes('ENOTFOUND')) {
        throw new Error('Network error. Please check your internet connection and sandbox service availability.');
      } else if (error.message?.includes('timeout')) {
        throw new Error('Sandbox resume operation timed out. Please try again.');
      } else if (error.message?.includes('resource') || error.message?.includes('limit')) {
        throw new Error('Resource limit reached. Unable to resume sandbox at this time.');
      }
      
      throw error;
    }
  }

  /**
   * Get the current session ID for the sandbox environment
   * Follows official VibeKit getSession API specification
   */
  async getSession() {
    try {
      // Create VibeKit instance to access the getSession method
      const vibeKit = this.createVibeKit();
      
      // Check if the VibeKit instance is properly initialized
      if (!vibeKit) {
        throw new Error('Agent not initialized');
      }
      
      // Check if the agent is properly initialized
      if (!vibeKit.agent) {
        throw new Error('Agent not initialized');
      }
      
      // Call the underlying getSession method
      const sessionId = await vibeKit.getSession();
      
      // Save session tracking if enabled and sessionId exists
      if (sessionId && this.config.sessionManagement.enabled && this.config.sessionManagement.persistSessions) {
        await this.saveSession(`session-get-${Date.now()}`, {
          type: 'getSession',
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
          success: true
        });
      }
      
      // Return the session ID (string) or null
      return sessionId;
    } catch (error) {
      // Enhanced error handling for getSession operation
      console.error('VibeKit getSession error:', error);
      
      // Check if this is an initialization error (should be re-thrown as-is)
      if (error.message?.includes('not initialized')) {
        throw error; // Re-throw initialization errors unchanged
      }
      
      // Check for specific session retrieval error types
      if (error.message?.includes('permission') || error.message?.includes('403')) {
        throw new Error('Insufficient permissions to access session information.');
      } else if (error.message?.includes('network') || error.message?.includes('ENOTFOUND')) {
        throw new Error('Network error. Please check your internet connection and sandbox service availability.');
      } else if (error.message?.includes('timeout')) {
        throw new Error('Session retrieval operation timed out. Please try again.');
      }
      
      throw error;
    }
  }

  /**
   * Set the session ID for the sandbox environment
   * Follows official VibeKit setSession API specification
   */
  async setSession(sessionId) {
    try {
      // Validate sessionId parameter
      if (typeof sessionId !== 'string') {
        throw new Error('sessionId must be a string');
      }
      
      if (!sessionId || sessionId.trim() === '') {
        throw new Error('sessionId cannot be empty');
      }
      
      // Create VibeKit instance to access the setSession method
      const vibeKit = this.createVibeKit();
      
      // Check if the VibeKit instance is properly initialized
      if (!vibeKit) {
        throw new Error('Agent not initialized');
      }
      
      // Check if the agent is properly initialized
      if (!vibeKit.agent) {
        throw new Error('Agent not initialized');
      }
      
      // Call the underlying setSession method
      await vibeKit.setSession(sessionId);
      
      // Save session tracking if enabled
      if (this.config.sessionManagement.enabled && this.config.sessionManagement.persistSessions) {
        await this.saveSession(`session-set-${Date.now()}`, {
          type: 'setSession',
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
          success: true
        });
      }
      
      // Method returns void as per specification
      return;
    } catch (error) {
      // Enhanced error handling for setSession operation
      console.error('VibeKit setSession error:', error);
      
      // Check if this is a validation error first (these should be re-thrown as-is)
      if (error.message?.includes('must be a string') || 
          error.message?.includes('cannot be empty')) {
        throw error; // Re-throw validation errors unchanged
      }
      
      // Check if this is an initialization error (should be re-thrown as-is)
      if (error.message?.includes('not initialized')) {
        throw error; // Re-throw initialization errors unchanged
      }
      
      // Check for specific session setting error types
      if (error.message?.includes('invalid session') || error.message?.includes('session not found')) {
        throw new Error('Invalid or expired session ID. Please verify the session exists and is accessible.');
      } else if (error.message?.includes('permission') || error.message?.includes('403')) {
        throw new Error('Insufficient permissions to set session. Please verify your authentication and access rights.');
      } else if (error.message?.includes('network') || error.message?.includes('ENOTFOUND')) {
        throw new Error('Network error. Please check your internet connection and sandbox service availability.');
      } else if (error.message?.includes('timeout')) {
        throw new Error('Session setting operation timed out. Please try again.');
      } else if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        throw new Error('Rate limit exceeded. Please wait before attempting to set session again.');
      }
      
      throw error;
    }
  }

  /**
   * Get the host URL for a specific port in the sandbox environment
   * Follows official VibeKit getHost API specification
   */
  getHost(port) {
    try {
      // Validate port parameter
      if (typeof port !== 'number') {
        throw new Error('port must be a number');
      }
      
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('port must be a valid integer between 1 and 65535');
      }
      
      // Create VibeKit instance to access the getHost method
      const vibeKit = this.createVibeKit();
      
      // Check if the VibeKit instance is properly initialized
      if (!vibeKit) {
        throw new Error('VibeKit instance not initialized');
      }
      
      // Check for supported sandbox environments
      const activeEnvironments = this.getActiveEnvironmentConfig();
      const supportedEnvironments = ['e2b', 'daytona', 'northflank'];
      const hasSupportedEnvironment = supportedEnvironments.some(env => 
        activeEnvironments[env] && activeEnvironments[env].apiKey
      );
      
      if (!hasSupportedEnvironment) {
        throw new Error('getHost requires an active sandbox environment (E2B, Daytona, or Northflank). FlyIO and Modal are not supported.');
      }
      
      // Call the underlying getHost method
      const hostUrl = vibeKit.getHost(port);
      
      // Validate that we got a valid URL back
      if (!hostUrl || typeof hostUrl !== 'string') {
        throw new Error('Failed to generate host URL. Sandbox may not be active.');
      }
      
      return hostUrl;
    } catch (error) {
      // Enhanced error handling for getHost operation
      console.error('VibeKit getHost error:', error);
      
      // Check if this is a validation error first (these should be re-thrown as-is)
      if (error.message?.includes('must be a number') ||
          error.message?.includes('must be a valid integer') ||
          error.message?.includes('not initialized') ||
          error.message?.includes('requires an active sandbox')) {
        throw error; // Re-throw validation errors unchanged
      }
      
      // Check for specific getHost error types
      if (error.message?.includes('sandbox not active') || error.message?.includes('no active sandbox')) {
        throw new Error('Sandbox not active. Please ensure a sandbox environment is running before calling getHost.');
      } else if (error.message?.includes('unsupported') || error.message?.includes('not supported')) {
        throw new Error('Unsupported sandbox environment. getHost is only available for E2B, Daytona, and Northflank sandboxes.');
      } else if (error.message?.includes('port') && (error.message?.includes('invalid') || error.message?.includes('range'))) {
        throw new Error('Invalid port number. Port must be a valid integer between 1 and 65535.');
      } else if (error.message?.includes('network') || error.message?.includes('ENOTFOUND')) {
        throw new Error('Network error. Please check your internet connection and sandbox service availability.');
      } else if (error.message?.includes('permission') || error.message?.includes('403')) {
        throw new Error('Insufficient permissions to access sandbox host information.');
      }
      
      throw error;
    }
  }

  /**
   * Get host URL for a specific task context
   * Convenience method that integrates with task-based workflows
   */
  getTaskHost(task, port, options = {}) {
    try {
      // Validate task parameter
      if (!task || !task.id) {
        throw new Error('task parameter is required and must have an id');
      }
      
      // Create task context for better error reporting
      const taskContext = {
        taskId: task.id,
        projectRoot: options.projectRoot,
        branch: options.branch,
        agent: options.agent,
        workingDirectory: options.workingDirectory
      };
      
      // Get the host URL using the main getHost method
      const hostUrl = this.getHost(port);
      
      // Log task-specific host access if verbose mode enabled
      if (options.verbose) {
        console.log(`Task ${task.id}: Host URL for port ${port} - ${hostUrl}`);
      }
      
      return hostUrl;
    } catch (error) {
      // Add task context to error for better debugging
      const taskError = new Error(`Task ${task?.id || 'unknown'}: ${error.message}`);
      taskError.originalError = error;
      throw taskError;
    }
  }

  /**
   * Get model name based on agent type and context
   */
  getModelNameForAgent(agentType, context = {}) {
    const modelMap = {
      'claude-code': context.modelName || 'claude-3-opus-20240229',
      'codex': context.modelName || 'gpt-4-turbo-preview',
      'gemini-cli': context.modelName || 'gemini-1.5-pro',
      'opencode': context.modelName || 'deepseek-coder-v2'
    };
    
    return modelMap[agentType] || modelMap['claude-code'];
  }

  /**
   * Get provider based on agent type
   */
  getProviderForAgent(agentType) {
    const providerMap = {
      'claude-code': 'anthropic',
      'codex': 'openai',
      'gemini-cli': 'gemini',
      'opencode': 'opencode'
    };
    
    return providerMap[agentType] || 'anthropic';
  }

  /**
   * Get only configured environment providers
   */
  getActiveEnvironmentConfig() {
    const activeConfig = {};
    
    // Only include E2B if API key is present
    if (this.config.environments.e2b?.apiKey) {
      activeConfig.e2b = this.config.environments.e2b;
    }
    
    // Only include Northflank if configured
    if (this.config.environments.northflank?.apiKey) {
      activeConfig.northflank = this.config.environments.northflank;
    }
    
    // Only include Daytona if configured
    if (this.config.environments.daytona?.apiKey) {
      activeConfig.daytona = this.config.environments.daytona;
    }
    
    return activeConfig;
  }

  /**
   * Detect Git repository from current directory
   */
  detectGitRepository() {
    try {
      const gitConfigPath = path.join(this.config.workingDirectory, '.git', 'config');
      if (fs.existsSync(gitConfigPath)) {
        const gitConfig = fs.readFileSync(gitConfigPath, 'utf-8');
        const match = gitConfig.match(/url = (.+)/);
        if (match) {
          return match[1].trim();
        }
      }
    } catch (error) {
      // Silently fail if unable to detect
    }
    return null;
  }

  /**
   * Generate session ID for tracking
   */
  generateSessionId(context = {}) {
    const timestamp = Date.now();
    const taskId = context.taskId || 'general';
    const agent = context.agent || this.config.defaultAgent;
    return `${agent}-${taskId}-${timestamp}`;
  }

  /**
   * Save session data for persistence
   */
  async saveSession(sessionId, result) {
    if (!sessionId) return;
    
    const sessionPath = path.join(
      this.config.workingDirectory,
      this.config.sessionManagement.sessionDir,
      `${sessionId}.json`
    );
    
    try {
      const sessionData = {
        sessionId,
        timestamp: new Date().toISOString(),
        result: {
          // Save relevant result data, not the entire object
          success: result.success,
          filesGenerated: result.filesGenerated,
          summary: result.summary
        }
      };
      
      await fs.promises.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));
    } catch (error) {
      console.warn('Failed to save session:', error.message);
    }
  }

  enhancePromptWithContext(prompt, context = {}) {
    if (!context.taskId) return prompt;

    return `
# Task Context
- Task ID: ${context.taskId}
- Project: ${context.projectRoot || 'Unknown'}
- Branch: ${context.branch || 'main'}
- Working Directory: ${context.workingDirectory || this.config.workingDirectory}

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
      case 'claude-code':
        return process.env.ANTHROPIC_API_KEY;
      case 'codex':
        return process.env.OPENAI_API_KEY;
      case 'gemini-cli':
        return process.env.GOOGLE_API_KEY;
      case 'opencode':
        return process.env.OPENCODE_API_KEY;
      default:
        return process.env.ANTHROPIC_API_KEY; // Default to Claude
    }
  }
}