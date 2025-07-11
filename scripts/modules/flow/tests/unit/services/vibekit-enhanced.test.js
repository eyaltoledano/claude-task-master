/**
 * Tests for Enhanced VibeKit Service Integration
 * Validates full configuration support and all features
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { VibeKitService } from '../../../services/vibekit.service.js';

// Mock the VibeKit SDK
jest.mock('@vibe-kit/sdk', () => ({
  VibeKit: jest.fn().mockImplementation(() => ({
    generateCode: jest.fn().mockResolvedValue({
      success: true,
      filesGenerated: ['test.js'],
      summary: 'Code generated successfully'
    })
  }))
}));

// Mock file system operations
jest.mock('node:fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  promises: {
    writeFile: jest.fn()
  }
}));

describe('Enhanced VibeKit Service', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set up test environment
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.E2B_API_KEY = 'test-e2b-key';
    process.env.GITHUB_TOKEN = 'test-github-token';
    process.env.NORTHFLANK_API_KEY = 'test-northflank-key';
    process.env.DAYTONA_API_KEY = 'test-daytona-key';
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Configuration', () => {
    test('should initialize with complete default configuration', () => {
      const service = new VibeKitService();
      
      expect(service.config).toMatchObject({
        defaultAgent: 'claude-code',
        environment: {
          e2b: {
            apiKey: 'test-e2b-key'
          },
          northflank: {
            apiKey: 'test-northflank-key'
          },
          daytona: {
            apiKey: 'test-daytona-key'
          }
        },
        github: {
          token: 'test-github-token'
        },
        telemetry: {
          enabled: false
        },
        sessionManagement: {
          enabled: true,
          persistSessions: true
        }
      });
    });

    test('should merge custom configuration', () => {
      const customConfig = {
        defaultAgent: 'codex',
        telemetry: {
          enabled: true,
          endpoint: 'https://custom-telemetry.com'
        }
      };
      
      const service = new VibeKitService(customConfig);
      
      expect(service.config.defaultAgent).toBe('codex');
      expect(service.config.telemetry.enabled).toBe(true);
      expect(service.config.telemetry.endpoint).toBe('https://custom-telemetry.com');
    });

    test('should create session directory if enabled', () => {
      const fs = require('node:fs');
      
      new VibeKitService({
        sessionManagement: {
          enabled: true,
          persistSessions: true
        }
      });
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.taskmaster/flow/sessions'),
        { recursive: true }
      );
    });
  });

  describe('VibeKit Instance Creation', () => {
    test('should create instance with full agent configuration', () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const service = new VibeKitService();
      
      service.createVibeKit({
        agent: 'claude-code',
        modelConfig: {
          temperature: 0.2
        }
      });
      
      expect(VibeKit).toHaveBeenCalledWith({
        agent: {
          type: 'claude-code',
          model: {
            apiKey: 'test-anthropic-key',
            name: 'claude-3-opus-20240229',
            provider: 'anthropic',
            temperature: 0.2
          }
        },
        environment: {
          e2b: { apiKey: 'test-e2b-key' },
          northflank: { apiKey: 'test-northflank-key' },
          daytona: { apiKey: 'test-daytona-key' }
        },
        github: {
          token: 'test-github-token',
          repository: null
        },
        workingDirectory: expect.any(String)
      });
    });

    test('should only include configured environment providers', () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      
      // Remove some environment keys
      process.env.NORTHFLANK_API_KEY = undefined;
      process.env.DAYTONA_API_KEY = undefined;
      
      const service = new VibeKitService();
      service.createVibeKit();
      
      const callArgs = VibeKit.mock.calls[0][0];
      expect(callArgs.environment).toEqual({
        e2b: { apiKey: 'test-e2b-key' }
      });
      expect(callArgs.environment.northflank).toBeUndefined();
      expect(callArgs.environment.daytona).toBeUndefined();
    });

    test('should add telemetry if enabled', () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      
      const service = new VibeKitService({
        telemetry: {
          enabled: true,
          endpoint: 'https://telemetry.test',
          apiKey: 'telemetry-key'
        }
      });
      
      service.createVibeKit();
      
      const callArgs = VibeKit.mock.calls[0][0];
      expect(callArgs.telemetry).toEqual({
        enabled: true,
        endpoint: 'https://telemetry.test',
        apiKey: 'telemetry-key',
        samplingRate: 0.1
      });
    });

    test('should generate session ID if session management enabled', () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const service = new VibeKitService();
      
      service.createVibeKit({
        taskId: 'test-task-1'
      });
      
      const callArgs = VibeKit.mock.calls[0][0];
      expect(callArgs.sessionId).toMatch(/claude-code-test-task-1-\d+/);
    });
  });

  describe('Code Generation', () => {
    test('should handle successful code generation with new API', async () => {
      const service = new VibeKitService();
      
      const result = await service.generateCode({
        prompt: 'Create a test',
        mode: 'code',
        taskContext: {
          taskId: 'test-1'
        },
        callbacks: {
          onUpdate: jest.fn(),
          onError: jest.fn()
        }
      });
      
      expect(result).toEqual({
        success: true,
        filesGenerated: ['test.js'],
        summary: 'Code generated successfully'
      });
    });

    test('should validate required parameters', async () => {
      const service = new VibeKitService();
      
      // Missing prompt
      await expect(
        service.generateCode({ mode: 'code' })
      ).rejects.toThrow('prompt parameter is required and must be a string');
      
      // Missing mode
      await expect(
        service.generateCode({ prompt: 'test' })
      ).rejects.toThrow('mode parameter is required and must be "ask" or "code"');
      
      // Invalid mode
      await expect(
        service.generateCode({ prompt: 'test', mode: 'invalid' })
      ).rejects.toThrow('mode parameter is required and must be "ask" or "code"');
    });

    test('should support branch parameter', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockGenerateCode = jest.fn().mockResolvedValue({ success: true });
      
      VibeKit.mockImplementation(() => ({
        generateCode: mockGenerateCode
      }));
      
      const service = new VibeKitService();
      
      await service.generateCode({
        prompt: 'test',
        mode: 'code',
        branch: 'feature/test-branch'
      });
      
      expect(mockGenerateCode).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'feature/test-branch'
        })
      );
    });

    test('should support history parameter', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockGenerateCode = jest.fn().mockResolvedValue({ success: true });
      
      VibeKit.mockImplementation(() => ({
        generateCode: mockGenerateCode
      }));
      
      const service = new VibeKitService();
      
      const conversation = [
        { role: 'user', content: 'Previous message' },
        { role: 'assistant', content: 'Previous response' }
      ];
      
      await service.generateCode({
        prompt: 'test',
        mode: 'ask',
        history: conversation
      });
      
      expect(mockGenerateCode).toHaveBeenCalledWith(
        expect.objectContaining({
          history: conversation
        })
      );
    });

    test('should support callbacks parameter', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockGenerateCode = jest.fn().mockResolvedValue({ success: true });
      
      VibeKit.mockImplementation(() => ({
        generateCode: mockGenerateCode
      }));
      
      const service = new VibeKitService();
      const callbacks = {
        onUpdate: jest.fn(),
        onError: jest.fn()
      };
      
      await service.generateCode({
        prompt: 'test',
        mode: 'code',
        callbacks
      });
      
      expect(mockGenerateCode).toHaveBeenCalledWith(
        expect.objectContaining({
          callbacks
        })
      );
    });

    test('should only include optional parameters when provided', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockGenerateCode = jest.fn().mockResolvedValue({ success: true });
      
      VibeKit.mockImplementation(() => ({
        generateCode: mockGenerateCode
      }));
      
      const service = new VibeKitService();
      
      await service.generateCode({
        prompt: 'test',
        mode: 'code'
        // No branch, history, or callbacks
      });
      
      const callArgs = mockGenerateCode.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('branch');
      expect(callArgs).not.toHaveProperty('history');
      expect(callArgs).not.toHaveProperty('callbacks');
    });

    test('should enhance error messages for missing API keys', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      
      // Mock API key error
      VibeKit.mockImplementation(() => ({
        generateCode: jest.fn().mockRejectedValue(new Error('Invalid API key'))
      }));
      
      const service = new VibeKitService();
      
      await expect(
        service.generateCode({ 
          prompt: 'test', 
          mode: 'code',
          taskContext: { agent: 'codex' } 
        })
      ).rejects.toThrow('Missing or invalid API key for codex');
    });

    test('should handle network errors gracefully', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      
      // Mock network error
      VibeKit.mockImplementation(() => ({
        generateCode: jest.fn().mockRejectedValue(new Error('network timeout'))
      }));
      
      const service = new VibeKitService();
      
      await expect(
        service.generateCode({ prompt: 'test', mode: 'code' })
      ).rejects.toThrow('Network error: Unable to connect to VibeKit service');
    });

    test('should handle rate limit errors', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      
      // Mock rate limit error
      VibeKit.mockImplementation(() => ({
        generateCode: jest.fn().mockRejectedValue(new Error('rate limit exceeded'))
      }));
      
      const service = new VibeKitService();
      
      await expect(
        service.generateCode({ prompt: 'test', mode: 'code' })
      ).rejects.toThrow('Rate limit exceeded. Please try again in a few moments.');
    });

    test('should handle agent not initialized errors', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      
      // Mock not initialized error
      VibeKit.mockImplementation(() => ({
        generateCode: jest.fn().mockRejectedValue(new Error('Agent not initialized'))
      }));
      
      const service = new VibeKitService();
      
      await expect(
        service.generateCode({ prompt: 'test', mode: 'code' })
      ).rejects.toThrow('Agent not initialized: Agent not initialized');
    });

    test('should save session if enabled', async () => {
      const fs = require('node:fs');
      const service = new VibeKitService({
        sessionManagement: {
          enabled: true,
          persistSessions: true
        }
      });
      
      await service.generateCode({
        prompt: 'test',
        mode: 'code',
        taskContext: {
          sessionId: 'test-session-123'
        }
      });
      
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-session-123.json'),
        expect.stringContaining('"sessionId":"test-session-123"')
      );
    });
  });

  describe('Backward Compatibility', () => {
    test('should provide legacy generateCode method', async () => {
      const service = new VibeKitService();
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = await service.generateCodeLegacy('Create a test', {
        mode: 'code',
        taskContext: {
          taskId: 'test-1'
        },
        onUpdate: jest.fn()
      });
      
      expect(result).toEqual({
        success: true,
        filesGenerated: ['test.js'],
        summary: 'Code generated successfully'
      });
      
      expect(consoleWarn).toHaveBeenCalledWith(
        'generateCodeLegacy is deprecated. Use generateCode({ prompt, mode, ... }) instead.'
      );
      
      consoleWarn.mockRestore();
    });
  });

  describe('Command Execution', () => {
    test('should handle successful command execution', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockExecuteCommand = jest.fn().mockResolvedValue({
        sandboxId: 'test-sandbox-123',
        stdout: 'Command executed successfully',
        stderr: '',
        exitCode: 0
      });
      
      VibeKit.mockImplementation(() => ({
        executeCommand: mockExecuteCommand
      }));
      
      const service = new VibeKitService();
      
      const result = await service.executeCommand('ls -la');
      
      expect(result).toEqual({
        sandboxId: 'test-sandbox-123',
        stdout: 'Command executed successfully',
        stderr: '',
        exitCode: 0
      });
      
      expect(mockExecuteCommand).toHaveBeenCalledWith('ls -la', {});
    });

    test('should validate required command parameter', async () => {
      const service = new VibeKitService();
      
      // Missing command
      await expect(
        service.executeCommand()
      ).rejects.toThrow('command parameter is required and must be a string');
      
      // Non-string command
      await expect(
        service.executeCommand(123)
      ).rejects.toThrow('command parameter is required and must be a string');
      
      // Empty command
      await expect(
        service.executeCommand('')
      ).rejects.toThrow('command parameter is required and must be a string');
    });

    test('should validate options parameters', async () => {
      const service = new VibeKitService();
      
      // Invalid timeoutMs
      await expect(
        service.executeCommand('ls', { timeoutMs: -1 })
      ).rejects.toThrow('timeoutMs must be a positive number');
      
      await expect(
        service.executeCommand('ls', { timeoutMs: 'invalid' })
      ).rejects.toThrow('timeoutMs must be a positive number');
      
      // Invalid background
      await expect(
        service.executeCommand('ls', { background: 'invalid' })
      ).rejects.toThrow('background must be a boolean');
      
      // Invalid callbacks
      await expect(
        service.executeCommand('ls', { callbacks: 'invalid' })
      ).rejects.toThrow('callbacks must be an object');
    });

    test('should support all command options', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockExecuteCommand = jest.fn().mockResolvedValue({
        sandboxId: 'test-sandbox-123',
        stdout: 'Success',
        stderr: '',
        exitCode: 0
      });
      
      VibeKit.mockImplementation(() => ({
        executeCommand: mockExecuteCommand
      }));
      
      const service = new VibeKitService();
      const callbacks = {
        onUpdate: jest.fn(),
        onError: jest.fn()
      };
      
      await service.executeCommand('npm test', {
        timeoutMs: 30000,
        background: true,
        callbacks
      });
      
      expect(mockExecuteCommand).toHaveBeenCalledWith('npm test', {
        timeoutMs: 30000,
        background: true,
        callbacks
      });
    });

    test('should remove undefined options', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockExecuteCommand = jest.fn().mockResolvedValue({
        sandboxId: 'test-sandbox-123',
        stdout: 'Success',
        stderr: '',
        exitCode: 0
      });
      
      VibeKit.mockImplementation(() => ({
        executeCommand: mockExecuteCommand
      }));
      
      const service = new VibeKitService();
      
      await service.executeCommand('echo "hello"', {
        // timeoutMs is undefined
        background: false,
        // callbacks is undefined
      });
      
      const callArgs = mockExecuteCommand.mock.calls[0][1];
      expect(callArgs).not.toHaveProperty('timeoutMs');
      expect(callArgs).not.toHaveProperty('callbacks');
      expect(callArgs).toHaveProperty('background', false);
    });

    test('should handle command execution errors', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      
      const testCases = [
        {
          error: new Error('timeout exceeded'),
          expectedMessage: 'Command execution timed out: npm install'
        },
        {
          error: new Error('permission denied'),
          expectedMessage: 'Permission denied for command: npm install'
        },
        {
          error: new Error('sandbox not available'),
          expectedMessage: 'Sandbox environment not available. Please check your environment configuration.'
        },
        {
          error: new Error('command not found: invalid-command'),
          expectedMessage: 'Command not found: npm install'
        },
        {
          error: new Error('resource limit exceeded'),
          expectedMessage: 'Command exceeded resource limits: npm install'
        }
      ];

      for (const testCase of testCases) {
        VibeKit.mockImplementation(() => ({
          executeCommand: jest.fn().mockRejectedValue(testCase.error)
        }));
        
        const service = new VibeKitService();
        
        await expect(
          service.executeCommand('npm install')
        ).rejects.toThrow(testCase.expectedMessage);
      }
    });

    test('should save session if enabled for commands', async () => {
      const fs = require('node:fs');
      const service = new VibeKitService({
        sessionManagement: {
          enabled: true,
          persistSessions: true
        }
      });
      
      await service.executeCommand('echo "test"', {
        taskContext: {
          sessionId: 'test-command-session-123'
        }
      });
      
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-command-session-123.json'),
        expect.stringContaining('"type":"executeCommand"')
      );
    });
  });

  describe('Task Command Execution', () => {
    test('should execute commands for specific tasks', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockExecuteCommand = jest.fn().mockResolvedValue({
        sandboxId: 'test-sandbox-123',
        stdout: 'Tests passed',
        stderr: '',
        exitCode: 0
      });
      
      VibeKit.mockImplementation(() => ({
        executeCommand: mockExecuteCommand
      }));
      
      const service = new VibeKitService();
      const task = {
        id: 'task-15',
        title: 'Run tests',
        description: 'Execute test suite'
      };
      
      const onProgress = jest.fn();
      
      const result = await service.executeTaskCommand(task, 'npm test', {
        timeoutMs: 60000,
        onProgress
      });
      
      expect(result).toEqual({
        sandboxId: 'test-sandbox-123',
        stdout: 'Tests passed',
        stderr: '',
        exitCode: 0
      });
      
      expect(mockExecuteCommand).toHaveBeenCalledWith('npm test', {
        timeoutMs: 60000,
        background: false,
        callbacks: expect.objectContaining({
          onUpdate: expect.any(Function),
          onError: expect.any(Function)
        }),
        taskContext: expect.objectContaining({
          taskId: 'task-15'
        })
      });
    });

    test('should handle progress callbacks for task commands', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockExecuteCommand = jest.fn().mockImplementation(async (command, options) => {
        // Simulate progress update
        if (options.callbacks?.onUpdate) {
          options.callbacks.onUpdate('Running command...');
        }
        return {
          sandboxId: 'test-sandbox-123',
          stdout: 'Success',
          stderr: '',
          exitCode: 0
        };
      });
      
      VibeKit.mockImplementation(() => ({
        executeCommand: mockExecuteCommand
      }));
      
      const service = new VibeKitService();
      const task = {
        id: 'task-20',
        title: 'Build project'
      };
      
      const onProgress = jest.fn();
      
      await service.executeTaskCommand(task, 'npm run build', {
        onProgress
      });
      
      expect(onProgress).toHaveBeenCalledWith({
        taskId: 'task-20',
        phase: 'executing-command',
        progress: 50,
        message: 'Running command...',
        data: {
          command: 'npm run build',
          message: 'Running command...'
        }
      });
    });
  });

  describe('Task Execution', () => {
    test('should execute task with full context', async () => {
      const service = new VibeKitService();
      const onProgress = jest.fn();
      
      const task = {
        id: '1',
        title: 'Test Task',
        description: 'A test task',
        details: 'Detailed implementation',
        testStrategy: 'Unit tests'
      };
      
      await service.executeTask(task, {
        projectRoot: '/test/project',
        branch: 'feature/test',
        agent: 'codex',
        onProgress
      });
      
      // Verify progress callback
      expect(onProgress).toHaveBeenCalledWith({
        taskId: '1',
        phase: 'executing',
        progress: expect.any(Number),
        message: expect.any(String),
        data: expect.any(Object)
      });
    });
  });

  describe('Agent Configuration', () => {
    test('should get correct model names for agents', () => {
      const service = new VibeKitService();
      
      expect(service.getModelNameForAgent('claude-code')).toBe('claude-3-opus-20240229');
      expect(service.getModelNameForAgent('codex')).toBe('gpt-4-turbo-preview');
      expect(service.getModelNameForAgent('gemini-cli')).toBe('gemini-1.5-pro');
      expect(service.getModelNameForAgent('opencode')).toBe('deepseek-coder-v2');
    });

    test('should allow custom model names', () => {
      const service = new VibeKitService();
      
      expect(
        service.getModelNameForAgent('claude-code', { modelName: 'claude-3-sonnet' })
      ).toBe('claude-3-sonnet');
    });

    test('should get correct providers for agents', () => {
      const service = new VibeKitService();
      
      expect(service.getProviderForAgent('claude-code')).toBe('anthropic');
      expect(service.getProviderForAgent('codex')).toBe('openai');
      expect(service.getProviderForAgent('gemini-cli')).toBe('gemini');
      expect(service.getProviderForAgent('opencode')).toBe('opencode');
    });

    test('should get correct API keys for agents', () => {
      const service = new VibeKitService();
      
      expect(service.getApiKeyForAgent('claude-code')).toBe('test-anthropic-key');
      expect(service.getApiKeyForAgent('unknown')).toBe('test-anthropic-key'); // Default
    });
  });

  describe('Git Repository Detection', () => {
    test('should detect git repository from .git/config', () => {
      const fs = require('node:fs');
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`
[remote "origin"]
  url = https://github.com/user/repo.git
`);
      
      const service = new VibeKitService();
      const repo = service.detectGitRepository();
      
      expect(repo).toBe('https://github.com/user/repo.git');
    });

    test('should handle missing git config gracefully', () => {
      const fs = require('node:fs');
      fs.existsSync.mockReturnValue(false);
      
      const service = new VibeKitService();
      const repo = service.detectGitRepository();
      
      expect(repo).toBeNull();
    });
  });

  describe('Session Management', () => {
    test('should generate unique session IDs', () => {
      const service = new VibeKitService();
      
      const session1 = service.generateSessionId({ taskId: 'task-1', agent: 'codex' });
      const session2 = service.generateSessionId({ taskId: 'task-1', agent: 'codex' });
      
      expect(session1).toMatch(/^codex-task-1-\d+$/);
      expect(session2).toMatch(/^codex-task-1-\d+$/);
      expect(session1).not.toBe(session2); // Different timestamps
    });

    test('should save session data correctly', async () => {
      const fs = require('node:fs');
      const service = new VibeKitService();
      
      const result = {
        success: true,
        filesGenerated: ['file1.js', 'file2.js'],
        summary: 'Task completed'
      };
      
      await service.saveSession('test-session-123', result);
      
      const savedData = JSON.parse(
        fs.promises.writeFile.mock.calls[0][1]
      );
      
      expect(savedData).toMatchObject({
        sessionId: 'test-session-123',
        timestamp: expect.any(String),
        result: {
          success: true,
          filesGenerated: ['file1.js', 'file2.js'],
          summary: 'Task completed'
        }
      });
    });

    test('should handle session save errors gracefully', async () => {
      const fs = require('node:fs');
      fs.promises.writeFile.mockRejectedValue(new Error('Write failed'));
      
      const service = new VibeKitService();
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
      
      await service.saveSession('test-session', { success: true });
      
      expect(consoleWarn).toHaveBeenCalledWith(
        'Failed to save session:',
        'Write failed'
      );
      
      consoleWarn.mockRestore();
    });
  });

  describe('Context Enhancement', () => {
    test('should enhance prompt with full context', () => {
      const service = new VibeKitService({ workingDirectory: '/project' });
      
      const enhanced = service.enhancePromptWithContext('Do something', {
        taskId: 'task-1',
        projectRoot: '/my-project',
        branch: 'feature/test',
        workingDirectory: '/custom/dir'
      });
      
      expect(enhanced).toContain('Task ID: task-1');
      expect(enhanced).toContain('Project: /my-project');
      expect(enhanced).toContain('Branch: feature/test');
      expect(enhanced).toContain('Working Directory: /custom/dir');
      expect(enhanced).toContain('Do something');
    });

    test('should return original prompt if no context', () => {
      const service = new VibeKitService();
      const prompt = 'Simple prompt';
      
      expect(service.enhancePromptWithContext(prompt)).toBe(prompt);
    });
  });

  describe('Environment Configuration', () => {
    test('should only return active environment configurations', () => {
      const service = new VibeKitService();
      
      // Remove some API keys
      process.env.NORTHFLANK_API_KEY = undefined;
      process.env.DAYTONA_API_KEY = undefined;
      
      const activeConfig = service.getActiveEnvironmentConfig();
      
      expect(activeConfig).toEqual({
        e2b: { apiKey: 'test-e2b-key' }
      });
      expect(activeConfig.northflank).toBeUndefined();
      expect(activeConfig.daytona).toBeUndefined();
    });

    test('should include all environments when API keys present', () => {
      process.env.NORTHFLANK_PROJECT_ID = 'project-123';
      process.env.DAYTONA_WORKSPACE_ID = 'workspace-456';
      
      const service = new VibeKitService();
      const activeConfig = service.getActiveEnvironmentConfig();
      
      expect(activeConfig).toEqual({
        e2b: { apiKey: 'test-e2b-key' },
        northflank: { 
          apiKey: 'test-northflank-key',
          projectId: 'project-123'
        },
        daytona: {
          apiKey: 'test-daytona-key',
          workspaceId: 'workspace-456'
        }
      });
    });
  });

  describe('Pull Request Creation', () => {
    test('should handle successful pull request creation', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockCreatePullRequest = jest.fn().mockResolvedValue({
        number: 42,
        id: 12345,
        url: 'https://github.com/user/repo/pull/42',
        title: 'AI Generated: Task implementation',
        body: 'Automated pull request created by VibeKit',
        state: 'open',
        head: {
          ref: 'task-1-feature-branch',
          sha: 'abc123def456'
        },
        base: {
          ref: 'main',
          sha: 'def456abc123'
        }
      });
      
      VibeKit.mockImplementation(() => ({
        createPullRequest: mockCreatePullRequest
      }));
      
      const service = new VibeKitService({
        github: {
          token: 'test-github-token',
          repository: 'https://github.com/user/repo.git'
        }
      });
      
      const labelOptions = {
        name: 'task-1',
        color: '0e8a16',
        description: 'Task 1: Test implementation'
      };
      
      const result = await service.createPullRequest(labelOptions, 'task-1');
      
      expect(result.number).toBe(42);
      expect(result.url).toBe('https://github.com/user/repo/pull/42');
      expect(mockCreatePullRequest).toHaveBeenCalledWith(labelOptions, 'task-1');
    });

    test('should validate labelOptions parameters', async () => {
      const service = new VibeKitService({
        github: {
          token: 'test-github-token',
          repository: 'https://github.com/user/repo.git'
        }
      });
      
      // Invalid labelOptions type
      await expect(
        service.createPullRequest('invalid')
      ).rejects.toThrow('labelOptions must be an object');
      
      // Missing name
      await expect(
        service.createPullRequest({
          color: '0e8a16',
          description: 'Test'
        })
      ).rejects.toThrow('labelOptions.name is required and must be a string');
      
      // Missing color
      await expect(
        service.createPullRequest({
          name: 'test',
          description: 'Test'
        })
      ).rejects.toThrow('labelOptions.color is required and must be a string');
      
      // Invalid color format
      await expect(
        service.createPullRequest({
          name: 'test',
          color: '#0e8a16', // Invalid: includes #
          description: 'Test'
        })
      ).rejects.toThrow('labelOptions.color must be a 6-character hex color code without # (e.g., "0e8a16")');
      
      // Invalid color length
      await expect(
        service.createPullRequest({
          name: 'test',
          color: '0e8a1', // Invalid: too short
          description: 'Test'
        })
      ).rejects.toThrow('labelOptions.color must be a 6-character hex color code without # (e.g., "0e8a16")');
      
      // Missing description
      await expect(
        service.createPullRequest({
          name: 'test',
          color: '0e8a16'
        })
      ).rejects.toThrow('labelOptions.description is required and must be a string');
    });

    test('should validate branchPrefix parameter', async () => {
      const service = new VibeKitService({
        github: {
          token: 'test-github-token',
          repository: 'https://github.com/user/repo.git'
        }
      });
      
      // Invalid branchPrefix type
      await expect(
        service.createPullRequest(undefined, 123)
      ).rejects.toThrow('branchPrefix must be a string');
    });

    test('should require GitHub configuration', async () => {
      const service = new VibeKitService(); // No GitHub config
      
      // Missing token
      await expect(
        service.createPullRequest()
      ).rejects.toThrow('GitHub token is required for createPullRequest');
      
      // Missing repository
      const serviceWithToken = new VibeKitService({
        github: { token: 'test-token' }
      });
      
      await expect(
        serviceWithToken.createPullRequest()
      ).rejects.toThrow('GitHub repository is required for createPullRequest');
    });

    test('should handle GitHub API errors', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      
      const testCases = [
        {
          error: new Error('404: repository not found'),
          expectedMessage: 'Repository not found. Please verify the repository URL and ensure the token has access.'
        },
        {
          error: new Error('403: permission denied'),
          expectedMessage: 'Insufficient permissions. Please ensure your GitHub token can create pull requests in this repository.'
        },
        {
          error: new Error('429: rate limit exceeded'),
          expectedMessage: 'GitHub API rate limit exceeded. Please wait and try again later.'
        },
        {
          error: new Error('ENOTFOUND: network error'),
          expectedMessage: 'Network error. Please check your internet connection and GitHub API availability.'
        }
      ];

      for (const testCase of testCases) {
        VibeKit.mockImplementation(() => ({
          createPullRequest: jest.fn().mockRejectedValue(testCase.error)
        }));
        
        const service = new VibeKitService({
          github: {
            token: 'test-token',
            repository: 'https://github.com/user/repo.git'
          }
        });
        
        await expect(
          service.createPullRequest()
        ).rejects.toThrow(testCase.expectedMessage);
      }
    });

    test('should save session if enabled for pull requests', async () => {
      const fs = require('node:fs');
      const service = new VibeKitService({
        github: {
          token: 'test-token',
          repository: 'https://github.com/user/repo.git'
        },
        sessionManagement: {
          enabled: true,
          persistSessions: true
        }
      });
      
      await service.createPullRequest();
      
      // Check that session was saved with PR prefix
      const savedCalls = fs.promises.writeFile.mock.calls;
      const prSessionCall = savedCalls.find(call => 
        call[0].includes('pr-') && call[1].includes('"type":"createPullRequest"')
      );
      
      expect(prSessionCall).toBeDefined();
    });
  });

  describe('Task Pull Request Creation', () => {
    test('should create pull request for specific tasks', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockCreatePullRequest = jest.fn().mockResolvedValue({
        number: 123,
        url: 'https://github.com/user/repo/pull/123'
      });
      
      VibeKit.mockImplementation(() => ({
        createPullRequest: mockCreatePullRequest
      }));
      
      const service = new VibeKitService({
        github: {
          token: 'test-token',
          repository: 'https://github.com/user/repo.git'
        }
      });
      
      const task = {
        id: 'task-25',
        title: 'Implement user authentication',
        description: 'Add OAuth login functionality'
      };
      
      const onProgress = jest.fn();
      
      const result = await service.createTaskPullRequest(task, {
        onProgress
      });
      
      expect(result.number).toBe(123);
      
      // Verify default label options were created
      expect(mockCreatePullRequest).toHaveBeenCalledWith(
        {
          name: 'task-task-25',
          color: '0e8a16',
          description: 'Task task-25: Implement user authentication'
        },
        'task-task-25'
      );
      
      // Verify progress callbacks
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-25',
          phase: 'creating-pull-request'
        })
      );
      
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-25',
          phase: 'pull-request-created',
          progress: 100
        })
      );
    });

    test('should handle custom label options and branch prefix', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockCreatePullRequest = jest.fn().mockResolvedValue({
        number: 456,
        url: 'https://github.com/user/repo/pull/456'
      });
      
      VibeKit.mockImplementation(() => ({
        createPullRequest: mockCreatePullRequest
      }));
      
      const service = new VibeKitService({
        github: {
          token: 'test-token',
          repository: 'https://github.com/user/repo.git'
        }
      });
      
      const task = {
        id: 'task-30',
        title: 'Add database migration'
      };
      
      const customLabelOptions = {
        name: 'database-migration',
        color: 'ff0000',
        description: 'Database schema updates'
      };
      
      await service.createTaskPullRequest(task, {
        labelOptions: customLabelOptions,
        branchPrefix: 'feature/db-migration'
      });
      
      expect(mockCreatePullRequest).toHaveBeenCalledWith(
        customLabelOptions,
        'feature/db-migration'
      );
    });
  });

  describe('Complete Workflow', () => {
    test('should execute complete workflow with all steps including tests', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockGenerateCode = jest.fn().mockResolvedValue({
        success: true,
        filesGenerated: ['component.jsx'],
        summary: 'React component created'
      });
      const mockExecuteCommand = jest.fn().mockResolvedValue({
        sandboxId: 'test-sandbox',
        stdout: 'Command executed',
        stderr: '',
        exitCode: 0
      });
      const mockRunTests = jest.fn().mockResolvedValue({
        sandboxId: 'test-sandbox',
        stdout: 'All tests passed',
        stderr: '',
        exitCode: 0
      });
      const mockCreatePullRequest = jest.fn().mockResolvedValue({
        number: 789,
        url: 'https://github.com/user/repo/pull/789'
      });
      
      VibeKit.mockImplementation(() => ({
        generateCode: mockGenerateCode,
        executeCommand: mockExecuteCommand,
        runTests: mockRunTests,
        createPullRequest: mockCreatePullRequest
      }));
      
      const service = new VibeKitService({
        github: {
          token: 'test-token',
          repository: 'https://github.com/user/repo.git'
        }
      });
      
      const task = {
        id: 'task-200',
        title: 'Build and test React component',
        description: 'Create a todo list component with full testing',
        details: 'Use functional components with hooks and comprehensive tests'
      };
      
      const onProgress = jest.fn();
      
      const result = await service.executeCompleteWorkflow(task, {
        commands: ['npm install', 'npm run lint'],
        runTests: true, // Enable test execution
        onProgress
      });
      
      expect(result.success).toBe(true);
      expect(result.steps.codeGeneration).toBeDefined();
      expect(result.steps.commandExecution).toHaveLength(2);
      expect(result.steps.testExecution).toBeDefined();
      expect(result.steps.testExecution.exitCode).toBe(0);
      expect(result.steps.pullRequestCreation).toBeDefined();
      
      // Verify all APIs were called
      expect(mockGenerateCode).toHaveBeenCalled();
      expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
      expect(mockRunTests).toHaveBeenCalled();
      expect(mockCreatePullRequest).toHaveBeenCalled();
      
      // Verify progress was reported for all phases including tests
      const progressPhases = onProgress.mock.calls.map(call => call[0].phase);
      expect(progressPhases).toContain('workflow-start');
      expect(progressPhases).toContain('workflow-code-generation');
      expect(progressPhases).toContain('workflow-command-execution');
      expect(progressPhases).toContain('workflow-test-execution');
      expect(progressPhases).toContain('workflow-pull-request');
      expect(progressPhases).toContain('workflow-complete');
    });

    test('should handle workflow with push to branch instead of PR', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockGenerateCode = jest.fn().mockResolvedValue({
        success: true,
        filesGenerated: ['component.jsx'],
        summary: 'Component created'
      });
      const mockPushToBranch = jest.fn().mockResolvedValue(undefined);
      
      VibeKit.mockImplementation(() => ({
        generateCode: mockGenerateCode,
        pushToBranch: mockPushToBranch
      }));
      
      const service = new VibeKitService({
        github: {
          token: 'test-token',
          repository: 'https://github.com/user/repo.git'
        }
      });
      
      const task = {
        id: 'task-201',
        title: 'Direct push workflow'
      };
      
      const result = await service.executeCompleteWorkflow(task, {
        pushToBranch: true, // Push directly instead of creating PR
        branch: 'feature/direct-push',
        runTests: false // Skip tests
      });
      
      expect(result.success).toBe(true);
      expect(result.steps.branchPush).toBeDefined();
      expect(result.steps.branchPush.branch).toBe('feature/direct-push');
      expect(result.steps.pullRequestCreation).toBeNull();
      expect(result.steps.testExecution).toBeNull();
      
      expect(mockGenerateCode).toHaveBeenCalled();
      expect(mockPushToBranch).toHaveBeenCalledWith('feature/direct-push');
    });

    test('should handle test failures with continue option', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockGenerateCode = jest.fn().mockResolvedValue({
        success: true,
        filesGenerated: ['component.jsx'],
        summary: 'Component created'
      });
      const mockRunTests = jest.fn().mockRejectedValue(new Error('Tests failed'));
      const mockCreatePullRequest = jest.fn().mockResolvedValue({
        number: 999,
        url: 'https://github.com/user/repo/pull/999'
      });
      
      VibeKit.mockImplementation(() => ({
        generateCode: mockGenerateCode,
        runTests: mockRunTests,
        createPullRequest: mockCreatePullRequest
      }));
      
      const service = new VibeKitService({
        github: {
          token: 'test-token',
          repository: 'https://github.com/user/repo.git'
        }
      });
      
      const task = {
        id: 'task-202',
        title: 'Workflow with test failures'
      };
      
      const onProgress = jest.fn();
      
      const result = await service.executeCompleteWorkflow(task, {
        runTests: true,
        failOnTestFailure: false, // Continue workflow even if tests fail
        onProgress
      });
      
      expect(result.success).toBe(true);
      expect(result.steps.testExecution.success).toBe(false);
      expect(result.steps.testExecution.error).toBe('Tests failed');
      expect(result.steps.pullRequestCreation).toBeDefined(); // PR still created
      
      // Verify test failure was reported but workflow continued
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'workflow-test-failed',
          message: 'Tests failed but continuing workflow...'
        })
      );
    });

    test('should fail workflow on test failures when failOnTestFailure is true', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockGenerateCode = jest.fn().mockResolvedValue({
        success: true,
        filesGenerated: ['component.jsx'],
        summary: 'Component created'
      });
      const mockRunTests = jest.fn().mockRejectedValue(new Error('Tests failed'));
      
      VibeKit.mockImplementation(() => ({
        generateCode: mockGenerateCode,
        runTests: mockRunTests
      }));
      
      const service = new VibeKitService();
      
      const task = {
        id: 'task-203',
        title: 'Workflow that fails on test errors'
      };
      
      const onProgress = jest.fn();
      
      await expect(
        service.executeCompleteWorkflow(task, {
          runTests: true,
          failOnTestFailure: true, // Fail workflow if tests fail (default behavior)
          onProgress
        })
      ).rejects.toThrow('Test execution failed: Tests failed');
      
      // Verify error progress was reported
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'workflow-error'
        })
      );
    });

    test('should handle workflow with selective steps including tests', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockRunTests = jest.fn().mockResolvedValue({
        sandboxId: 'test-sandbox',
        stdout: 'Tests passed',
        stderr: '',
        exitCode: 0
      });
      
      VibeKit.mockImplementation(() => ({
        runTests: mockRunTests
      }));
      
      const service = new VibeKitService();
      
      const task = {
        id: 'task-204',
        title: 'Tests only workflow'
      };
      
      const result = await service.executeCompleteWorkflow(task, {
        generateCode: false, // Skip code generation
        runTests: true, // Only run tests
        createPullRequest: false // Skip PR creation
      });
      
      expect(result.success).toBe(true);
      expect(result.steps.codeGeneration).toBeNull();
      expect(result.steps.testExecution).toBeDefined();
      expect(result.steps.testExecution.exitCode).toBe(0);
      expect(result.steps.pullRequestCreation).toBeNull();
      expect(result.steps.branchPush).toBeNull();
      expect(result.steps.sandboxCleanup).toBeNull(); // Not Codex agent
      
      expect(mockRunTests).toHaveBeenCalled();
    });

    test('should handle sandbox cleanup in workflow for Codex agent', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockGenerateCode = jest.fn().mockResolvedValue({
        success: true,
        filesGenerated: ['component.jsx'],
        summary: 'Component created'
      });
      const mockKill = jest.fn().mockResolvedValue(undefined);
      
      VibeKit.mockImplementation(() => ({
        generateCode: mockGenerateCode,
        kill: mockKill,
        agent: { type: 'codex' }
      }));
      
      const service = new VibeKitService({
        agent: {
          type: 'codex' // Use Codex agent for sandbox cleanup
        }
      });
      
      const task = {
        id: 'task-205',
        title: 'Workflow with sandbox cleanup'
      };
      
      const onProgress = jest.fn();
      
      const result = await service.executeCompleteWorkflow(task, {
        cleanupSandbox: true, // Enable sandbox cleanup
        createPullRequest: false,
        runTests: false,
        onProgress
      });
      
      expect(result.success).toBe(true);
      expect(result.steps.sandboxCleanup).toBeDefined();
      expect(result.steps.sandboxCleanup.success).toBe(true);
      expect(result.steps.sandboxCleanup.message).toBe('Sandbox terminated successfully');
      
      expect(mockKill).toHaveBeenCalled();
      
      // Verify cleanup progress was reported
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'workflow-cleanup',
          message: 'Cleaning up sandbox resources...'
        })
      );
      
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'workflow-cleanup-complete',
          message: 'Sandbox cleanup completed'
        })
      );
    });

    test('should skip sandbox cleanup for non-Codex agents', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockGenerateCode = jest.fn().mockResolvedValue({
        success: true,
        filesGenerated: ['component.jsx'],
        summary: 'Component created'
      });
      
      VibeKit.mockImplementation(() => ({
        generateCode: mockGenerateCode
      }));
      
      const service = new VibeKitService({
        agent: {
          type: 'claude-code' // Non-Codex agent
        }
      });
      
      const task = {
        id: 'task-206',
        title: 'Workflow without sandbox cleanup'
      };
      
      const result = await service.executeCompleteWorkflow(task, {
        cleanupSandbox: true, // Attempt cleanup but should skip
        createPullRequest: false,
        runTests: false
      });
      
      expect(result.success).toBe(true);
      expect(result.steps.sandboxCleanup).toBeNull(); // Should be null for non-Codex
    });

    test('should handle sandbox cleanup errors gracefully', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockGenerateCode = jest.fn().mockResolvedValue({
        success: true,
        filesGenerated: ['component.jsx'],
        summary: 'Component created'
      });
      const mockKill = jest.fn().mockRejectedValue(new Error('Cleanup failed'));
      
      VibeKit.mockImplementation(() => ({
        generateCode: mockGenerateCode,
        kill: mockKill,
        agent: { type: 'codex' }
      }));
      
      const service = new VibeKitService({
        agent: {
          type: 'codex'
        }
      });
      
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
      
      const task = {
        id: 'task-207',
        title: 'Workflow with cleanup failure'
      };
      
      const onProgress = jest.fn();
      
      const result = await service.executeCompleteWorkflow(task, {
        cleanupSandbox: true,
        createPullRequest: false,
        runTests: false,
        onProgress
      });
      
      // Workflow should still succeed despite cleanup failure
      expect(result.success).toBe(true);
      expect(result.steps.sandboxCleanup.success).toBe(false);
      expect(result.steps.sandboxCleanup.error).toBe('Cleanup failed');
      
      expect(consoleWarn).toHaveBeenCalledWith(
        'Sandbox cleanup failed (non-critical):',
        'Cleanup failed'
      );
      
      // Verify cleanup warning was reported
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'workflow-cleanup-warning',
          message: 'Sandbox cleanup failed but workflow completed'
        })
      );
      
      consoleWarn.mockRestore();
    });

    test('should attempt cleanup on workflow error for Codex agent', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockGenerateCode = jest.fn().mockRejectedValue(new Error('Generation failed'));
      const mockKill = jest.fn().mockResolvedValue(undefined);
      
      VibeKit.mockImplementation(() => ({
        generateCode: mockGenerateCode,
        kill: mockKill,
        agent: { type: 'codex' }
      }));
      
      const service = new VibeKitService({
        agent: {
          type: 'codex'
        }
      });
      
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();
      
      const task = {
        id: 'task-208',
        title: 'Workflow with error cleanup'
      };
      
      const onProgress = jest.fn();
      
      await expect(
        service.executeCompleteWorkflow(task, {
          cleanupOnError: true, // Enable cleanup on error
          onProgress
        })
      ).rejects.toThrow('Generation failed');
      
      // Verify cleanup was attempted on error
      expect(mockKill).toHaveBeenCalled();
      expect(consoleLog).toHaveBeenCalledWith(
        'Sandbox cleaned up successfully after workflow error'
      );
      
      // Verify error cleanup progress was reported
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'workflow-error-cleanup',
          message: 'Attempting sandbox cleanup after error...'
        })
      );
      
      consoleLog.mockRestore();
    });
  });

  describe('Test Execution', () => {
    test('should handle successful test execution', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockRunTests = jest.fn().mockResolvedValue({
        sandboxId: 'test-sandbox',
        stdout: 'All tests passed\n✓ 15 tests completed',
        stderr: '',
        exitCode: 0
      });
      
      VibeKit.mockImplementation(() => ({
        runTests: mockRunTests
      }));
      
      const service = new VibeKitService();
      
      const result = await service.runTests({
        branch: 'feature/tests',
        history: [
          { role: 'user', content: 'Run the tests' }
        ],
        callbacks: {
          onUpdate: jest.fn(),
          onError: jest.fn()
        }
      });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('All tests passed');
      expect(mockRunTests).toHaveBeenCalledWith({
        branch: 'feature/tests',
        history: [{ role: 'user', content: 'Run the tests' }],
        callbacks: expect.objectContaining({
          onUpdate: expect.any(Function),
          onError: expect.any(Function)
        })
      });
    });

    test('should validate runTests parameters', async () => {
      const service = new VibeKitService();
      
      // Invalid branch type
      await expect(
        service.runTests({ branch: 123 })
      ).rejects.toThrow('branch must be a string');
      
      // Invalid history type
      await expect(
        service.runTests({ history: 'invalid' })
      ).rejects.toThrow('history must be an array of conversation objects');
      
      // Invalid callbacks type
      await expect(
        service.runTests({ callbacks: 'invalid' })
      ).rejects.toThrow('callbacks must be an object');
      
      // Invalid callback function types
      await expect(
        service.runTests({ 
          callbacks: { 
            onUpdate: 'not-a-function' 
          } 
        })
      ).rejects.toThrow('callbacks.onUpdate must be a function');
      
      await expect(
        service.runTests({ 
          callbacks: { 
            onError: 'not-a-function' 
          } 
        })
      ).rejects.toThrow('callbacks.onError must be a function');
    });

    test('should handle test execution errors', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      
      const testCases = [
        {
          error: new Error('test runner detection failed'),
          expectedMessage: 'Test runner detection failed. Please ensure your project has a valid test configuration.'
        },
        {
          error: new Error('dependencies installation failed'),
          expectedMessage: 'Dependency installation failed. Please check your project dependencies and package configuration.'
        },
        {
          error: new Error('timeout exceeded'),
          expectedMessage: 'Test execution timed out. Consider breaking down large test suites or increasing timeout limits.'
        },
        {
          error: new Error('permission denied'),
          expectedMessage: 'Insufficient permissions. Please ensure the agent has access to run tests in the sandbox.'
        }
      ];

      for (const testCase of testCases) {
        VibeKit.mockImplementation(() => ({
          runTests: jest.fn().mockRejectedValue(testCase.error)
        }));
        
        const service = new VibeKitService();
        
        await expect(
          service.runTests()
        ).rejects.toThrow(testCase.expectedMessage);
      }
    });

    test('should save session if enabled for test runs', async () => {
      const fs = require('node:fs');
      const service = new VibeKitService({
        sessionManagement: {
          enabled: true,
          persistSessions: true
        }
      });
      
      await service.runTests({ branch: 'feature/tests' });
      
      // Check that session was saved with tests prefix
      const savedCalls = fs.promises.writeFile.mock.calls;
      const testSessionCall = savedCalls.find(call => 
        call[0].includes('tests-') && call[1].includes('"type":"runTests"')
      );
      
      expect(testSessionCall).toBeDefined();
    });
  });

  describe('Task Test Execution', () => {
    test('should run tests for specific tasks with progress tracking', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockRunTests = jest.fn().mockResolvedValue({
        sandboxId: 'test-sandbox',
        stdout: 'Tests completed successfully',
        stderr: '',
        exitCode: 0
      });
      
      VibeKit.mockImplementation(() => ({
        runTests: mockRunTests
      }));
      
      const service = new VibeKitService();
      
      const task = {
        id: 'task-50',
        title: 'Implement feature X',
        description: 'Build and test feature X'
      };
      
      const onProgress = jest.fn();
      
      const result = await service.runTaskTests(task, {
        branch: 'feature/x',
        onProgress
      });
      
      expect(result.exitCode).toBe(0);
      expect(mockRunTests).toHaveBeenCalled();
      
      // Verify progress callbacks
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-50',
          phase: 'starting-tests'
        })
      );
      
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-50',
          phase: 'tests-passed',
          progress: 100
        })
      );
    });

    test('should handle test failures in task context', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockRunTests = jest.fn().mockResolvedValue({
        sandboxId: 'test-sandbox',
        stdout: 'Some tests failed',
        stderr: 'Error: Test suite failed',
        exitCode: 1
      });
      
      VibeKit.mockImplementation(() => ({
        runTests: mockRunTests
      }));
      
      const service = new VibeKitService();
      
      const task = {
        id: 'task-51',
        title: 'Test failing feature'
      };
      
      const onProgress = jest.fn();
      
      const result = await service.runTaskTests(task, { onProgress });
      
      expect(result.exitCode).toBe(1);
      
      // Verify failure progress was reported
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-51',
          phase: 'tests-failed',
          progress: 100
        })
      );
    });
  });

  describe('Branch Push Operations', () => {
    test('should handle successful branch push', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      const mockPushToBranch = jest.fn().mockResolvedValue(undefined); // Returns void
      
      VibeKit.mockImplementation(() => ({
        pushToBranch: mockPushToBranch
      }));
      
      const service = new VibeKitService({
        github: {
          token: 'test-token',
          repository: 'https://github.com/user/repo.git'
        }
      });
      
      const result = await service.pushToBranch('feature/new-feature');
      
      expect(result.success).toBe(true);
      expect(result.branch).toBe('feature/new-feature');
      expect(result.message).toContain('Successfully pushed changes to branch: feature/new-feature');
      expect(mockPushToBranch).toHaveBeenCalledWith('feature/new-feature');
    });

    test('should validate pushToBranch parameters', async () => {
      const service = new VibeKitService({
        github: {
          token: 'test-token',
          repository: 'https://github.com/user/repo.git'
        }
      });
      
      // Invalid branch type
      await expect(
        service.pushToBranch(123)
      ).rejects.toThrow('branch must be a string');
    });

    test('should require GitHub configuration for push', async () => {
      const service = new VibeKitService(); // No GitHub config
      
      // Missing token
      await expect(
        service.pushToBranch('feature/test')
      ).rejects.toThrow('GitHub token is required for pushToBranch');
      
      // Missing repository
      const serviceWithToken = new VibeKitService({
        github: { token: 'test-token' }
      });
      
      await expect(
        serviceWithToken.pushToBranch('feature/test')
      ).rejects.toThrow('GitHub repository is required for pushToBranch');
    });

    test('should handle push errors gracefully', async () => {
      const { VibeKit } = require('@vibe-kit/sdk');
      
      const testCases = [
        {
          error: new Error('branch not found'),
          expectedMessage: 'Branch not found. Please ensure the branch exists or the token has permissions to create it.'
        },
        {
          error: new Error('permission denied'),
          expectedMessage: 'Insufficient permissions. Please ensure your GitHub token can push to this repository and branch.'
        },
        {
          error: new Error('merge conflict detected'),
          expectedMessage: 'Push failed due to conflicts. Please resolve conflicts or use a different branch.'
        }
      ];

      for (const testCase of testCases) {
        VibeKit.mockImplementation(() => ({
          pushToBranch: jest.fn().mockRejectedValue(testCase.error)
        }));
        
        const service = new VibeKitService({
          github: {
            token: 'test-token',
            repository: 'https://github.com/user/repo.git'
          }
        });
        
        await expect(
          service.pushToBranch('feature/test')
        ).rejects.toThrow(testCase.expectedMessage);
      }
    });

    test('should save session if enabled for pushes', async () => {
      const fs = require('node:fs');
      const service = new VibeKitService({
        github: {
          token: 'test-token',
          repository: 'https://github.com/user/repo.git'
        },
        sessionManagement: {
          enabled: true,
          persistSessions: true
        }
      });
      
      await service.pushToBranch('feature/test');
      
      // Check that session was saved with push prefix
      const savedCalls = fs.promises.writeFile.mock.calls;
      const pushSessionCall = savedCalls.find(call => 
        call[0].includes('push-') && call[1].includes('"type":"pushToBranch"')
      );
      
      expect(pushSessionCall).toBeDefined();
    });
  });

  describe('Sandbox Management', () => {
    describe('Kill Method', () => {
      test('should successfully terminate sandbox for Codex agent', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockKill = jest.fn().mockResolvedValue(undefined); // Returns void
        
        VibeKit.mockImplementation(() => ({
          kill: mockKill,
          agent: { type: 'codex' } // Mock agent property
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        const result = await service.kill();
        
        expect(result).toBeUndefined(); // Method returns void
        expect(mockKill).toHaveBeenCalledWith();
      });

      test('should validate agent type for kill operation', async () => {
        const service = new VibeKitService({
          agent: {
            type: 'claude-code' // Non-Codex agent
          }
        });
        
        await expect(
          service.kill()
        ).rejects.toThrow('Sandbox management is only supported for the Codex agent');
      });

      test('should handle missing agent configuration', async () => {
        const service = new VibeKitService(); // Default agent is claude-code
        
        await expect(
          service.kill()
        ).rejects.toThrow('Sandbox management is only supported for the Codex agent');
      });

      test('should handle uninitialized agent', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => ({
          // No agent property or null agent
          agent: null
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.kill()
        ).rejects.toThrow('CodexAgent not initialized');
      });

      test('should handle missing VibeKit instance', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => null);
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.kill()
        ).rejects.toThrow('CodexAgent not initialized');
      });

      test('should handle sandbox termination errors gracefully', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        const testCases = [
          {
            error: new Error('sandbox not found'),
            expectedMessage: 'Sandbox not found or already terminated. No action needed.'
          },
          {
            error: new Error('already terminated'),
            expectedMessage: 'Sandbox not found or already terminated. No action needed.'
          },
          {
            error: new Error('permission denied'),
            expectedMessage: 'Insufficient permissions to terminate the sandbox.'
          },
          {
            error: new Error('network timeout'),
            expectedMessage: 'Network error. Please check your internet connection and sandbox service availability.'
          },
          {
            error: new Error('operation timeout'),
            expectedMessage: 'Sandbox termination timed out. The sandbox may still be terminating.'
          }
        ];

        for (const testCase of testCases) {
          VibeKit.mockImplementation(() => ({
            kill: jest.fn().mockRejectedValue(testCase.error),
            agent: { type: 'codex' }
          }));
          
          const service = new VibeKitService({
            agent: {
              type: 'codex'
            }
          });
          
          await expect(
            service.kill()
          ).rejects.toThrow(testCase.expectedMessage);
        }
      });

      test('should save session if enabled for kill operation', async () => {
        const fs = require('node:fs');
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockKill = jest.fn().mockResolvedValue(undefined);
        
        VibeKit.mockImplementation(() => ({
          kill: mockKill,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          },
          sessionManagement: {
            enabled: true,
            persistSessions: true
          }
        });
        
        await service.kill();
        
        // Check that session was saved with sandbox-kill prefix
        const savedCalls = fs.promises.writeFile.mock.calls;
        const killSessionCall = savedCalls.find(call => 
          call[0].includes('sandbox-kill-') && call[1].includes('"type":"kill"')
        );
        
        expect(killSessionCall).toBeDefined();
        
        // Verify session data structure
        const sessionData = JSON.parse(killSessionCall[1]);
        expect(sessionData.result.success).toBe(true);
        expect(sessionData.result.type).toBe('kill');
      });

      test('should pass through unknown errors unchanged', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const unknownError = new Error('Unknown sandbox error');
        
        VibeKit.mockImplementation(() => ({
          kill: jest.fn().mockRejectedValue(unknownError),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.kill()
        ).rejects.toThrow('Unknown sandbox error');
      });

      test('should log errors to console', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const consoleError = jest.spyOn(console, 'error').mockImplementation();
        
        VibeKit.mockImplementation(() => ({
          kill: jest.fn().mockRejectedValue(new Error('Test error')),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        try {
          await service.kill();
        } catch (error) {
          // Expected to throw
        }
        
        expect(consoleError).toHaveBeenCalledWith(
          'VibeKit kill error:',
          expect.any(Error)
        );
        
        consoleError.mockRestore();
      });

      test('should not save session on error', async () => {
        const fs = require('node:fs');
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => ({
          kill: jest.fn().mockRejectedValue(new Error('Kill failed')),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          },
          sessionManagement: {
            enabled: true,
            persistSessions: true
          }
        });
        
        try {
          await service.kill();
        } catch (error) {
          // Expected to throw
        }
        
        // Check that no kill session was saved
        const savedCalls = fs.promises.writeFile.mock.calls;
        const killSessionCall = savedCalls.find(call => 
          call[0].includes('sandbox-kill-')
        );
        
        expect(killSessionCall).toBeUndefined();
      });

      test('should validate agent type before creating VibeKit instance', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        // Ensure VibeKit is never called for invalid agent types
        const mockVibeKit = jest.fn();
        VibeKit.mockImplementation(mockVibeKit);
        
        const service = new VibeKitService({
          agent: {
            type: 'claude-code' // Invalid for kill operation
          }
        });
        
        await expect(
          service.kill()
        ).rejects.toThrow('Sandbox management is only supported for the Codex agent');
        
        // VibeKit should not have been instantiated for invalid agent type
        expect(mockVibeKit).not.toHaveBeenCalled();
      });
    });

    describe('Pause Method', () => {
      test('should successfully pause sandbox for Codex agent', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockPause = jest.fn().mockResolvedValue(undefined); // Returns void
        
        VibeKit.mockImplementation(() => ({
          pause: mockPause,
          agent: { type: 'codex' } // Mock agent property
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        const result = await service.pause();
        
        expect(result).toBeUndefined(); // Method returns void
        expect(mockPause).toHaveBeenCalledWith();
      });

      test('should validate agent type for pause operation', async () => {
        const service = new VibeKitService({
          agent: {
            type: 'claude-code' // Non-Codex agent
          }
        });
        
        await expect(
          service.pause()
        ).rejects.toThrow('Sandbox management is only supported for the Codex agent');
      });

      test('should handle missing agent configuration', async () => {
        const service = new VibeKitService(); // Default agent is claude-code
        
        await expect(
          service.pause()
        ).rejects.toThrow('Sandbox management is only supported for the Codex agent');
      });

      test('should handle uninitialized agent', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => ({
          // No agent property or null agent
          agent: null
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.pause()
        ).rejects.toThrow('CodexAgent not initialized');
      });

      test('should handle missing VibeKit instance', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => null);
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.pause()
        ).rejects.toThrow('CodexAgent not initialized');
      });

      test('should handle sandbox pause errors gracefully', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        const testCases = [
          {
            error: new Error('sandbox not found'),
            expectedMessage: 'Sandbox not found or already paused.'
          },
          {
            error: new Error('already paused'),
            expectedMessage: 'Sandbox not found or already paused.'
          },
          {
            error: new Error('permission denied'),
            expectedMessage: 'Insufficient permissions to pause the sandbox.'
          },
          {
            error: new Error('network timeout'),
            expectedMessage: 'Network error. Please check your internet connection and sandbox service availability.'
          },
          {
            error: new Error('operation timeout'),
            expectedMessage: 'Sandbox pause operation timed out. Please try again.'
          },
          {
            error: new Error('resource limit exceeded'),
            expectedMessage: 'Resource limit reached. Unable to pause sandbox at this time.'
          }
        ];

        for (const testCase of testCases) {
          VibeKit.mockImplementation(() => ({
            pause: jest.fn().mockRejectedValue(testCase.error),
            agent: { type: 'codex' }
          }));
          
          const service = new VibeKitService({
            agent: {
              type: 'codex'
            }
          });
          
          await expect(
            service.pause()
          ).rejects.toThrow(testCase.expectedMessage);
        }
      });

      test('should save session if enabled for pause operation', async () => {
        const fs = require('node:fs');
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockPause = jest.fn().mockResolvedValue(undefined);
        
        VibeKit.mockImplementation(() => ({
          pause: mockPause,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          },
          sessionManagement: {
            enabled: true,
            persistSessions: true
          }
        });
        
        await service.pause();
        
        // Check that session was saved with sandbox-pause prefix
        const savedCalls = fs.promises.writeFile.mock.calls;
        const pauseSessionCall = savedCalls.find(call => 
          call[0].includes('sandbox-pause-') && call[1].includes('"type":"pause"')
        );
        
        expect(pauseSessionCall).toBeDefined();
        
        // Verify session data structure
        const sessionData = JSON.parse(pauseSessionCall[1]);
        expect(sessionData.result.success).toBe(true);
        expect(sessionData.result.type).toBe('pause');
      });

      test('should pass through unknown errors unchanged', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const unknownError = new Error('Unknown sandbox error');
        
        VibeKit.mockImplementation(() => ({
          pause: jest.fn().mockRejectedValue(unknownError),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.pause()
        ).rejects.toThrow('Unknown sandbox error');
      });

      test('should log errors to console', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const consoleError = jest.spyOn(console, 'error').mockImplementation();
        
        VibeKit.mockImplementation(() => ({
          pause: jest.fn().mockRejectedValue(new Error('Test error')),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        try {
          await service.pause();
        } catch (error) {
          // Expected to throw
        }
        
        expect(consoleError).toHaveBeenCalledWith(
          'VibeKit pause error:',
          expect.any(Error)
        );
        
        consoleError.mockRestore();
      });

      test('should not save session on error', async () => {
        const fs = require('node:fs');
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => ({
          pause: jest.fn().mockRejectedValue(new Error('Pause failed')),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          },
          sessionManagement: {
            enabled: true,
            persistSessions: true
          }
        });
        
        try {
          await service.pause();
        } catch (error) {
          // Expected to throw
        }
        
        // Check that no pause session was saved
        const savedCalls = fs.promises.writeFile.mock.calls;
        const pauseSessionCall = savedCalls.find(call => 
          call[0].includes('sandbox-pause-')
        );
        
        expect(pauseSessionCall).toBeUndefined();
      });

      test('should validate agent type before creating VibeKit instance', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        // Ensure VibeKit is never called for invalid agent types
        const mockVibeKit = jest.fn();
        VibeKit.mockImplementation(mockVibeKit);
        
        const service = new VibeKitService({
          agent: {
            type: 'claude-code' // Invalid for pause operation
          }
        });
        
        await expect(
          service.pause()
        ).rejects.toThrow('Sandbox management is only supported for the Codex agent');
        
        // VibeKit should not have been instantiated for invalid agent type
        expect(mockVibeKit).not.toHaveBeenCalled();
      });

      test('should handle different agent types correctly', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        const invalidAgentTypes = ['claude-code', 'gemini-cli', 'opencode', undefined, null];
        
        for (const agentType of invalidAgentTypes) {
          const service = new VibeKitService({
            agent: {
              type: agentType
            }
          });
          
          await expect(
            service.pause()
          ).rejects.toThrow('Sandbox management is only supported for the Codex agent');
        }
      });

      test('should work with minimal Codex configuration', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockPause = jest.fn().mockResolvedValue(undefined);
        
        VibeKit.mockImplementation(() => ({
          pause: mockPause,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
          // Minimal configuration
        });
        
        const result = await service.pause();
        
        expect(result).toBeUndefined();
        expect(mockPause).toHaveBeenCalledWith();
      });
    });

    describe('Resume Method', () => {
      test('should successfully resume sandbox for Codex agent', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockResume = jest.fn().mockResolvedValue(undefined); // Returns void
        
        VibeKit.mockImplementation(() => ({
          resume: mockResume,
          agent: { type: 'codex' } // Mock agent property
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        const result = await service.resume();
        
        expect(result).toBeUndefined(); // Method returns void
        expect(mockResume).toHaveBeenCalledWith();
      });

      test('should validate agent type for resume operation', async () => {
        const service = new VibeKitService({
          agent: {
            type: 'claude-code' // Non-Codex agent
          }
        });
        
        await expect(
          service.resume()
        ).rejects.toThrow('Sandbox management is only supported for the Codex agent');
      });

      test('should handle missing agent configuration', async () => {
        const service = new VibeKitService(); // Default agent is claude-code
        
        await expect(
          service.resume()
        ).rejects.toThrow('Sandbox management is only supported for the Codex agent');
      });

      test('should handle uninitialized agent', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => ({
          // No agent property or null agent
          agent: null
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.resume()
        ).rejects.toThrow('CodexAgent not initialized');
      });

      test('should handle missing VibeKit instance', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => null);
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.resume()
        ).rejects.toThrow('CodexAgent not initialized');
      });

      test('should handle sandbox resume errors gracefully', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        const testCases = [
          {
            error: new Error('sandbox not found'),
            expectedMessage: 'Sandbox not found or not in paused state.'
          },
          {
            error: new Error('not paused'),
            expectedMessage: 'Sandbox not found or not in paused state.'
          },
          {
            error: new Error('permission denied'),
            expectedMessage: 'Insufficient permissions to resume the sandbox.'
          },
          {
            error: new Error('network timeout'),
            expectedMessage: 'Network error. Please check your internet connection and sandbox service availability.'
          },
          {
            error: new Error('operation timeout'),
            expectedMessage: 'Sandbox resume operation timed out. Please try again.'
          },
          {
            error: new Error('resource limit exceeded'),
            expectedMessage: 'Resource limit reached. Unable to resume sandbox at this time.'
          }
        ];

        for (const testCase of testCases) {
          VibeKit.mockImplementation(() => ({
            resume: jest.fn().mockRejectedValue(testCase.error),
            agent: { type: 'codex' }
          }));
          
          const service = new VibeKitService({
            agent: {
              type: 'codex'
            }
          });
          
          await expect(
            service.resume()
          ).rejects.toThrow(testCase.expectedMessage);
        }
      });

      test('should save session if enabled for resume operation', async () => {
        const fs = require('node:fs');
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockResume = jest.fn().mockResolvedValue(undefined);
        
        VibeKit.mockImplementation(() => ({
          resume: mockResume,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          },
          sessionManagement: {
            enabled: true,
            persistSessions: true
          }
        });
        
        await service.resume();
        
        // Check that session was saved with sandbox-resume prefix
        const savedCalls = fs.promises.writeFile.mock.calls;
        const resumeSessionCall = savedCalls.find(call => 
          call[0].includes('sandbox-resume-') && call[1].includes('"type":"resume"')
        );
        
        expect(resumeSessionCall).toBeDefined();
        
        // Verify session data structure
        const sessionData = JSON.parse(resumeSessionCall[1]);
        expect(sessionData.result.success).toBe(true);
        expect(sessionData.result.type).toBe('resume');
      });

      test('should pass through unknown errors unchanged', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const unknownError = new Error('Unknown sandbox error');
        
        VibeKit.mockImplementation(() => ({
          resume: jest.fn().mockRejectedValue(unknownError),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.resume()
        ).rejects.toThrow('Unknown sandbox error');
      });

      test('should log errors to console', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const consoleError = jest.spyOn(console, 'error').mockImplementation();
        
        VibeKit.mockImplementation(() => ({
          resume: jest.fn().mockRejectedValue(new Error('Test error')),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        try {
          await service.resume();
        } catch (error) {
          // Expected to throw
        }
        
        expect(consoleError).toHaveBeenCalledWith(
          'VibeKit resume error:',
          expect.any(Error)
        );
        
        consoleError.mockRestore();
      });

      test('should not save session on error', async () => {
        const fs = require('node:fs');
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => ({
          resume: jest.fn().mockRejectedValue(new Error('Resume failed')),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          },
          sessionManagement: {
            enabled: true,
            persistSessions: true
          }
        });
        
        try {
          await service.resume();
        } catch (error) {
          // Expected to throw
        }
        
        // Check that no resume session was saved
        const savedCalls = fs.promises.writeFile.mock.calls;
        const resumeSessionCall = savedCalls.find(call => 
          call[0].includes('sandbox-resume-')
        );
        
        expect(resumeSessionCall).toBeUndefined();
      });

      test('should validate agent type before creating VibeKit instance', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        // Ensure VibeKit is never called for invalid agent types
        const mockVibeKit = jest.fn();
        VibeKit.mockImplementation(mockVibeKit);
        
        const service = new VibeKitService({
          agent: {
            type: 'claude-code' // Invalid for resume operation
          }
        });
        
        await expect(
          service.resume()
        ).rejects.toThrow('Sandbox management is only supported for the Codex agent');
        
        // VibeKit should not have been instantiated for invalid agent type
        expect(mockVibeKit).not.toHaveBeenCalled();
      });

      test('should handle different agent types correctly', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        const invalidAgentTypes = ['claude-code', 'gemini-cli', 'opencode', undefined, null];
        
        for (const agentType of invalidAgentTypes) {
          const service = new VibeKitService({
            agent: {
              type: agentType
            }
          });
          
          await expect(
            service.resume()
          ).rejects.toThrow('Sandbox management is only supported for the Codex agent');
        }
      });

      test('should work with minimal Codex configuration', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockResume = jest.fn().mockResolvedValue(undefined);
        
        VibeKit.mockImplementation(() => ({
          resume: mockResume,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
          // Minimal configuration
        });
        
        const result = await service.resume();
        
        expect(result).toBeUndefined();
        expect(mockResume).toHaveBeenCalledWith();
      });

      test('should handle pause/resume cycle correctly', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockPause = jest.fn().mockResolvedValue(undefined);
        const mockResume = jest.fn().mockResolvedValue(undefined);
        
        VibeKit.mockImplementation(() => ({
          pause: mockPause,
          resume: mockResume,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        // Test pause followed by resume
        await service.pause();
        expect(mockPause).toHaveBeenCalledWith();
        
        await service.resume();
        expect(mockResume).toHaveBeenCalledWith();
        
        // Verify both methods were called once
        expect(mockPause).toHaveBeenCalledTimes(1);
        expect(mockResume).toHaveBeenCalledTimes(1);
      });

      test('should handle state restoration after resume', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockResume = jest.fn().mockResolvedValue(undefined);
        const mockGenerateCode = jest.fn().mockResolvedValue({
          sandboxId: 'test-sandbox',
          response: 'console.log("State restored");'
        });
        
        VibeKit.mockImplementation(() => ({
          resume: mockResume,
          generateCode: mockGenerateCode,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        // Resume sandbox
        await service.resume();
        expect(mockResume).toHaveBeenCalledWith();
        
        // Should be able to generate code after resume
        const result = await service.generateCode({
          prompt: 'Test state restoration',
          mode: 'code'
        });
        
        expect(mockGenerateCode).toHaveBeenCalledWith({
          prompt: 'Test state restoration',
          mode: 'code'
        });
        expect(result.response).toBe('console.log("State restored");');
      });

      test('should track resume performance', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        // Mock resume with artificial delay
        const mockResume = jest.fn().mockImplementation(() => {
          return new Promise(resolve => setTimeout(resolve, 100));
        });
        
        VibeKit.mockImplementation(() => ({
          resume: mockResume,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        const startTime = Date.now();
        await service.resume();
        const resumeTime = Date.now() - startTime;
        
        expect(mockResume).toHaveBeenCalledWith();
        expect(resumeTime).toBeGreaterThanOrEqual(100);
      });
    });

    describe('getSession Method', () => {
      test('should successfully get session ID when session exists', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockGetSession = jest.fn().mockResolvedValue('session-123-abc');
        
        VibeKit.mockImplementation(() => ({
          getSession: mockGetSession,
          agent: { type: 'codex' } // Mock agent property
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        const result = await service.getSession();
        
        expect(result).toBe('session-123-abc');
        expect(mockGetSession).toHaveBeenCalledWith();
      });

      test('should return null when no session is active', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockGetSession = jest.fn().mockResolvedValue(null);
        
        VibeKit.mockImplementation(() => ({
          getSession: mockGetSession,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        const result = await service.getSession();
        
        expect(result).toBeNull();
        expect(mockGetSession).toHaveBeenCalledWith();
      });

      test('should work with Claude agent configuration', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockGetSession = jest.fn().mockResolvedValue('claude-session-456');
        
        VibeKit.mockImplementation(() => ({
          getSession: mockGetSession,
          agent: { type: 'claude-code' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'claude-code'
          }
        });
        
        const result = await service.getSession();
        
        expect(result).toBe('claude-session-456');
        expect(mockGetSession).toHaveBeenCalledWith();
      });

      test('should handle uninitialized VibeKit instance', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => null);
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.getSession()
        ).rejects.toThrow('Agent not initialized');
      });

      test('should handle uninitialized agent', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => ({
          // No agent property or null agent
          agent: null
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.getSession()
        ).rejects.toThrow('Agent not initialized');
      });

      test('should handle missing agent property', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => ({
          getSession: jest.fn()
          // Missing agent property
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.getSession()
        ).rejects.toThrow('Agent not initialized');
      });

      test('should handle session retrieval errors gracefully', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        const testCases = [
          {
            error: new Error('permission denied'),
            expectedMessage: 'Insufficient permissions to access session information.'
          },
          {
            error: new Error('network ENOTFOUND'),
            expectedMessage: 'Network error. Please check your internet connection and sandbox service availability.'
          },
          {
            error: new Error('operation timeout'),
            expectedMessage: 'Session retrieval operation timed out. Please try again.'
          }
        ];

        for (const testCase of testCases) {
          VibeKit.mockImplementation(() => ({
            getSession: jest.fn().mockRejectedValue(testCase.error),
            agent: { type: 'codex' }
          }));
          
          const service = new VibeKitService({
            agent: {
              type: 'codex'
            }
          });
          
          await expect(
            service.getSession()
          ).rejects.toThrow(testCase.expectedMessage);
        }
      });

      test('should save session tracking when enabled and session exists', async () => {
        const fs = require('node:fs');
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockGetSession = jest.fn().mockResolvedValue('tracked-session-789');
        
        VibeKit.mockImplementation(() => ({
          getSession: mockGetSession,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          },
          sessionManagement: {
            enabled: true,
            persistSessions: true
          }
        });
        
        const result = await service.getSession();
        
        expect(result).toBe('tracked-session-789');
        
        // Check that session was tracked with session-get prefix
        const savedCalls = fs.promises.writeFile.mock.calls;
        const sessionTrackCall = savedCalls.find(call => 
          call[0].includes('session-get-') && call[1].includes('"type":"getSession"')
        );
        
        expect(sessionTrackCall).toBeDefined();
        
        // Verify session data structure
        const sessionData = JSON.parse(sessionTrackCall[1]);
        expect(sessionData.result.success).toBe(true);
        expect(sessionData.result.type).toBe('getSession');
        expect(sessionData.result.sessionId).toBe('tracked-session-789');
      });

      test('should not save session tracking when session is null', async () => {
        const fs = require('node:fs');
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockGetSession = jest.fn().mockResolvedValue(null);
        
        VibeKit.mockImplementation(() => ({
          getSession: mockGetSession,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          },
          sessionManagement: {
            enabled: true,
            persistSessions: true
          }
        });
        
        const result = await service.getSession();
        
        expect(result).toBeNull();
        
        // Check that no session tracking was saved for null session
        const savedCalls = fs.promises.writeFile.mock.calls;
        const sessionTrackCall = savedCalls.find(call => 
          call[0].includes('session-get-')
        );
        
        expect(sessionTrackCall).toBeUndefined();
      });

      test('should not save session tracking when disabled', async () => {
        const fs = require('node:fs');
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockGetSession = jest.fn().mockResolvedValue('no-track-session');
        
        VibeKit.mockImplementation(() => ({
          getSession: mockGetSession,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          },
          sessionManagement: {
            enabled: false,
            persistSessions: false
          }
        });
        
        const result = await service.getSession();
        
        expect(result).toBe('no-track-session');
        
        // Check that no session tracking was saved when disabled
        const savedCalls = fs.promises.writeFile.mock.calls;
        const sessionTrackCall = savedCalls.find(call => 
          call[0].includes('session-get-')
        );
        
        expect(sessionTrackCall).toBeUndefined();
      });

      test('should pass through unknown errors unchanged', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const unknownError = new Error('Unknown session error');
        
        VibeKit.mockImplementation(() => ({
          getSession: jest.fn().mockRejectedValue(unknownError),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.getSession()
        ).rejects.toThrow('Unknown session error');
      });

      test('should log errors to console', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const consoleError = jest.spyOn(console, 'error').mockImplementation();
        
        VibeKit.mockImplementation(() => ({
          getSession: jest.fn().mockRejectedValue(new Error('Test error')),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        try {
          await service.getSession();
        } catch (error) {
          // Expected to throw
        }
        
        expect(consoleError).toHaveBeenCalledWith(
          'VibeKit getSession error:',
          expect.any(Error)
        );
        
        consoleError.mockRestore();
      });

      test('should not save session tracking on error', async () => {
        const fs = require('node:fs');
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => ({
          getSession: jest.fn().mockRejectedValue(new Error('Get session failed')),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          },
          sessionManagement: {
            enabled: true,
            persistSessions: true
          }
        });
        
        try {
          await service.getSession();
        } catch (error) {
          // Expected to throw
        }
        
        // Check that no session tracking was saved on error
        const savedCalls = fs.promises.writeFile.mock.calls;
        const sessionTrackCall = savedCalls.find(call => 
          call[0].includes('session-get-')
        );
        
        expect(sessionTrackCall).toBeUndefined();
      });

      test('should work with various agent types', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        const agentTypes = ['codex', 'claude-code', 'gemini-cli'];
        
        for (const agentType of agentTypes) {
          const mockGetSession = jest.fn().mockResolvedValue(`${agentType}-session-id`);
          
          VibeKit.mockImplementation(() => ({
            getSession: mockGetSession,
            agent: { type: agentType }
          }));
          
          const service = new VibeKitService({
            agent: {
              type: agentType
            }
          });
          
          const result = await service.getSession();
          
          expect(result).toBe(`${agentType}-session-id`);
          expect(mockGetSession).toHaveBeenCalledWith();
        }
      });

      test('should handle session ID format variations', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        const sessionIdFormats = [
          'session-123-abc',
          'sess_456def789',
          'sb-xyz-999',
          'long-session-id-with-many-parts-123456789',
          '12345',
          'a1b2c3d4e5f6'
        ];
        
        for (const sessionId of sessionIdFormats) {
          const mockGetSession = jest.fn().mockResolvedValue(sessionId);
          
          VibeKit.mockImplementation(() => ({
            getSession: mockGetSession,
            agent: { type: 'codex' }
          }));
          
          const service = new VibeKitService({
            agent: {
              type: 'codex'
            }
          });
          
          const result = await service.getSession();
          
          expect(result).toBe(sessionId);
          expect(typeof result).toBe('string');
        }
      });

      test('should maintain session ID type consistency', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        // Test with string session ID
        const mockGetSessionString = jest.fn().mockResolvedValue('string-session');
        VibeKit.mockImplementation(() => ({
          getSession: mockGetSessionString,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: { type: 'codex' }
        });
        
        const stringResult = await service.getSession();
        expect(typeof stringResult).toBe('string');
        expect(stringResult).toBe('string-session');
        
        // Test with null session ID
        const mockGetSessionNull = jest.fn().mockResolvedValue(null);
        VibeKit.mockImplementation(() => ({
          getSession: mockGetSessionNull,
          agent: { type: 'codex' }
        }));
        
        const nullResult = await service.getSession();
        expect(nullResult).toBeNull();
      });
    });

    describe('setSession Method', () => {
      test('should successfully set session ID with valid string', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockSetSession = jest.fn().mockResolvedValue(undefined);
        
        VibeKit.mockImplementation(() => ({
          setSession: mockSetSession,
          agent: { type: 'codex' } // Mock agent property
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        const result = await service.setSession('session-123-abc');
        
        expect(result).toBeUndefined(); // Should return void
        expect(mockSetSession).toHaveBeenCalledWith('session-123-abc');
      });

      test('should work with Claude agent configuration', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockSetSession = jest.fn().mockResolvedValue(undefined);
        
        VibeKit.mockImplementation(() => ({
          setSession: mockSetSession,
          agent: { type: 'claude-code' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'claude-code'
          }
        });
        
        const result = await service.setSession('claude-session-456');
        
        expect(result).toBeUndefined();
        expect(mockSetSession).toHaveBeenCalledWith('claude-session-456');
      });

      test('should validate sessionId parameter type', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => ({
          setSession: jest.fn(),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        // Test various invalid types
        const invalidInputs = [
          null,
          undefined,
          123,
          true,
          [],
          {},
          () => {}
        ];

        for (const input of invalidInputs) {
          await expect(
            service.setSession(input)
          ).rejects.toThrow('sessionId must be a string');
        }
      });

      test('should validate sessionId is not empty', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => ({
          setSession: jest.fn(),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        // Test empty strings
        const emptyInputs = ['', '   ', '\t', '\n'];

        for (const input of emptyInputs) {
          await expect(
            service.setSession(input)
          ).rejects.toThrow('sessionId cannot be empty');
        }
      });

      test('should handle uninitialized VibeKit instance', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => null);
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.setSession('session-123')
        ).rejects.toThrow('Agent not initialized');
      });

      test('should handle uninitialized agent', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => ({
          setSession: jest.fn(),
          agent: null // No agent property or null agent
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.setSession('session-123')
        ).rejects.toThrow('Agent not initialized');
      });

      test('should handle missing agent property', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => ({
          setSession: jest.fn()
          // Missing agent property
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.setSession('session-123')
        ).rejects.toThrow('Agent not initialized');
      });

      test('should handle session setting errors gracefully', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        const testCases = [
          {
            error: new Error('invalid session not found'),
            expectedMessage: 'Invalid or expired session ID. Please verify the session exists and is accessible.'
          },
          {
            error: new Error('session not found in database'),
            expectedMessage: 'Invalid or expired session ID. Please verify the session exists and is accessible.'
          },
          {
            error: new Error('permission denied for session'),
            expectedMessage: 'Insufficient permissions to set session. Please verify your authentication and access rights.'
          },
          {
            error: new Error('network ENOTFOUND error'),
            expectedMessage: 'Network error. Please check your internet connection and sandbox service availability.'
          },
          {
            error: new Error('operation timeout'),
            expectedMessage: 'Session setting operation timed out. Please try again.'
          },
          {
            error: new Error('rate limit exceeded 429'),
            expectedMessage: 'Rate limit exceeded. Please wait before attempting to set session again.'
          }
        ];

        for (const testCase of testCases) {
          VibeKit.mockImplementation(() => ({
            setSession: jest.fn().mockRejectedValue(testCase.error),
            agent: { type: 'codex' }
          }));
          
          const service = new VibeKitService({
            agent: {
              type: 'codex'
            }
          });
          
          await expect(
            service.setSession('session-123')
          ).rejects.toThrow(testCase.expectedMessage);
        }
      });

      test('should save session tracking when enabled', async () => {
        const fs = require('node:fs');
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockSetSession = jest.fn().mockResolvedValue(undefined);
        
        VibeKit.mockImplementation(() => ({
          setSession: mockSetSession,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          },
          sessionManagement: {
            enabled: true,
            persistSessions: true
          }
        });
        
        await service.setSession('tracked-session-789');
        
        // Check that session was tracked with session-set prefix
        const savedCalls = fs.promises.writeFile.mock.calls;
        const sessionTrackCall = savedCalls.find(call => 
          call[0].includes('session-set-') && call[1].includes('"type":"setSession"')
        );
        
        expect(sessionTrackCall).toBeDefined();
        
        // Verify session data structure
        const sessionData = JSON.parse(sessionTrackCall[1]);
        expect(sessionData.result.success).toBe(true);
        expect(sessionData.result.type).toBe('setSession');
        expect(sessionData.result.sessionId).toBe('tracked-session-789');
      });

      test('should not save session tracking when disabled', async () => {
        const fs = require('node:fs');
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockSetSession = jest.fn().mockResolvedValue(undefined);
        
        VibeKit.mockImplementation(() => ({
          setSession: mockSetSession,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          },
          sessionManagement: {
            enabled: false,
            persistSessions: false
          }
        });
        
        await service.setSession('no-track-session');
        
        // Check that no session tracking was saved when disabled
        const savedCalls = fs.promises.writeFile.mock.calls;
        const sessionTrackCall = savedCalls.find(call => 
          call[0].includes('session-set-')
        );
        
        expect(sessionTrackCall).toBeUndefined();
      });

      test('should pass through unknown errors unchanged', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const unknownError = new Error('Unknown session setting error');
        
        VibeKit.mockImplementation(() => ({
          setSession: jest.fn().mockRejectedValue(unknownError),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        await expect(
          service.setSession('session-123')
        ).rejects.toThrow('Unknown session setting error');
      });

      test('should log errors to console', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const consoleError = jest.spyOn(console, 'error').mockImplementation();
        
        VibeKit.mockImplementation(() => ({
          setSession: jest.fn().mockRejectedValue(new Error('Test error')),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          }
        });
        
        try {
          await service.setSession('session-123');
        } catch (error) {
          // Expected to throw
        }
        
        expect(consoleError).toHaveBeenCalledWith(
          'VibeKit setSession error:',
          expect.any(Error)
        );
        
        consoleError.mockRestore();
      });

      test('should not save session tracking on error', async () => {
        const fs = require('node:fs');
        const { VibeKit } = require('@vibe-kit/sdk');
        
        VibeKit.mockImplementation(() => ({
          setSession: jest.fn().mockRejectedValue(new Error('Set session failed')),
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: {
            type: 'codex'
          },
          sessionManagement: {
            enabled: true,
            persistSessions: true
          }
        });
        
        try {
          await service.setSession('session-123');
        } catch (error) {
          // Expected to throw
        }
        
        // Check that no session tracking was saved on error
        const savedCalls = fs.promises.writeFile.mock.calls;
        const sessionTrackCall = savedCalls.find(call => 
          call[0].includes('session-set-')
        );
        
        expect(sessionTrackCall).toBeUndefined();
      });

      test('should work with various agent types', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        const agentTypes = ['codex', 'claude-code', 'gemini-cli'];
        
        for (const agentType of agentTypes) {
          const mockSetSession = jest.fn().mockResolvedValue(undefined);
          
          VibeKit.mockImplementation(() => ({
            setSession: mockSetSession,
            agent: { type: agentType }
          }));
          
          const service = new VibeKitService({
            agent: {
              type: agentType
            }
          });
          
          const result = await service.setSession(`${agentType}-session-id`);
          
          expect(result).toBeUndefined();
          expect(mockSetSession).toHaveBeenCalledWith(`${agentType}-session-id`);
        }
      });

      test('should handle various session ID formats', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        
        const sessionIdFormats = [
          'session-123-abc',
          'sess_456def789',
          'sb-xyz-999',
          'long-session-id-with-many-parts-123456789',
          '12345',
          'a1b2c3d4e5f6',
          'project-a-session',
          'user-123-workspace-456'
        ];
        
        for (const sessionId of sessionIdFormats) {
          const mockSetSession = jest.fn().mockResolvedValue(undefined);
          
          VibeKit.mockImplementation(() => ({
            setSession: mockSetSession,
            agent: { type: 'codex' }
          }));
          
          const service = new VibeKitService({
            agent: {
              type: 'codex'
            }
          });
          
          const result = await service.setSession(sessionId);
          
          expect(result).toBeUndefined();
          expect(mockSetSession).toHaveBeenCalledWith(sessionId);
        }
      });

      test('should maintain void return type consistently', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockSetSession = jest.fn().mockResolvedValue(undefined);
        
        VibeKit.mockImplementation(() => ({
          setSession: mockSetSession,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: { type: 'codex' }
        });
        
        const result = await service.setSession('test-session');
        
        expect(result).toBeUndefined();
        expect(typeof result).toBe('undefined');
      });

      test('should handle session switching scenarios', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockSetSession = jest.fn().mockResolvedValue(undefined);
        
        VibeKit.mockImplementation(() => ({
          setSession: mockSetSession,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: { type: 'codex' }
        });
        
        // Switch between multiple sessions
        await service.setSession('session-1');
        await service.setSession('session-2');
        await service.setSession('session-3');
        
        expect(mockSetSession).toHaveBeenCalledTimes(3);
        expect(mockSetSession).toHaveBeenNthCalledWith(1, 'session-1');
        expect(mockSetSession).toHaveBeenNthCalledWith(2, 'session-2');
        expect(mockSetSession).toHaveBeenNthCalledWith(3, 'session-3');
      });

      test('should handle rapid session switching', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockSetSession = jest.fn().mockResolvedValue(undefined);
        
        VibeKit.mockImplementation(() => ({
          setSession: mockSetSession,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: { type: 'codex' }
        });
        
        // Rapid session switching
        const sessionSwitches = [
          service.setSession('session-a'),
          service.setSession('session-b'),
          service.setSession('session-c')
        ];
        
        await Promise.all(sessionSwitches);
        
        expect(mockSetSession).toHaveBeenCalledTimes(3);
      });

      test('should handle special characters in session IDs', async () => {
        const { VibeKit } = require('@vibe-kit/sdk');
        const mockSetSession = jest.fn().mockResolvedValue(undefined);
        
        VibeKit.mockImplementation(() => ({
          setSession: mockSetSession,
          agent: { type: 'codex' }
        }));
        
        const service = new VibeKitService({
          agent: { type: 'codex' }
        });
        
        const specialSessions = [
          'session-with-dashes',
          'session_with_underscores',
          'session.with.dots',
          'session:with:colons',
          'session@with@symbols'
        ];
        
        for (const sessionId of specialSessions) {
          await service.setSession(sessionId);
          expect(mockSetSession).toHaveBeenCalledWith(sessionId);
        }
      });
    });

    describe('Host URL Management', () => {
      describe('getHost Method', () => {
        test('should successfully get host URL for valid port', () => {
          const { VibeKit } = require('@vibe-kit/sdk');
          const mockGetHost = jest.fn().mockReturnValue('https://3000-sandbox-id.e2b.dev');
          
          VibeKit.mockImplementation(() => ({
            getHost: mockGetHost
          }));
          
          const service = new VibeKitService({
            environments: {
              e2b: {
                apiKey: 'test-e2b-key'
              }
            }
          });
          
          const result = service.getHost(3000);
          
          expect(result).toBe('https://3000-sandbox-id.e2b.dev');
          expect(mockGetHost).toHaveBeenCalledWith(3000);
        });

        test('should validate port parameter type', () => {
          const service = new VibeKitService({
            environments: {
              e2b: { apiKey: 'test-key' }
            }
          });
          
          // Invalid port types
          expect(() => service.getHost('3000')).toThrow('port must be a number');
          expect(() => service.getHost(null)).toThrow('port must be a number');
          expect(() => service.getHost(undefined)).toThrow('port must be a number');
          expect(() => service.getHost({})).toThrow('port must be a number');
          expect(() => service.getHost([])).toThrow('port must be a number');
        });

        test('should validate port parameter range', () => {
          const service = new VibeKitService({
            environments: {
              e2b: { apiKey: 'test-key' }
            }
          });
          
          // Invalid port ranges
          expect(() => service.getHost(0)).toThrow('port must be a valid integer between 1 and 65535');
          expect(() => service.getHost(-1)).toThrow('port must be a valid integer between 1 and 65535');
          expect(() => service.getHost(65536)).toThrow('port must be a valid integer between 1 and 65535');
          expect(() => service.getHost(100000)).toThrow('port must be a valid integer between 1 and 65535');
          
          // Non-integer ports
          expect(() => service.getHost(3000.5)).toThrow('port must be a valid integer between 1 and 65535');
          expect(() => service.getHost(NaN)).toThrow('port must be a valid integer between 1 and 65535');
          expect(() => service.getHost(Infinity)).toThrow('port must be a valid integer between 1 and 65535');
        });

        test('should validate supported sandbox environments', () => {
          // Service with no supported environments
          const service = new VibeKitService({
            environments: {
              // No E2B, Daytona, or Northflank configuration
              unsupported: { apiKey: 'test-key' }
            }
          });
          
          expect(() => service.getHost(3000)).toThrow(
            'getHost requires an active sandbox environment (E2B, Daytona, or Northflank). FlyIO and Modal are not supported.'
          );
        });

        test('should support E2B sandbox environment', () => {
          const { VibeKit } = require('@vibe-kit/sdk');
          const mockGetHost = jest.fn().mockReturnValue('https://8080-e2b-sandbox.e2b.dev');
          
          VibeKit.mockImplementation(() => ({
            getHost: mockGetHost
          }));
          
          const service = new VibeKitService({
            environments: {
              e2b: {
                apiKey: 'test-e2b-key'
              }
            }
          });
          
          const result = service.getHost(8080);
          expect(result).toBe('https://8080-e2b-sandbox.e2b.dev');
        });

        test('should support Daytona sandbox environment', () => {
          const { VibeKit } = require('@vibe-kit/sdk');
          const mockGetHost = jest.fn().mockReturnValue('https://27017-daytona-workspace.daytona.io');
          
          VibeKit.mockImplementation(() => ({
            getHost: mockGetHost
          }));
          
          const service = new VibeKitService({
            environments: {
              daytona: {
                apiKey: 'test-daytona-key',
                workspaceId: 'test-workspace'
              }
            }
          });
          
          const result = service.getHost(27017);
          expect(result).toBe('https://27017-daytona-workspace.daytona.io');
        });

        test('should support Northflank sandbox environment', () => {
          const { VibeKit } = require('@vibe-kit/sdk');
          const mockGetHost = jest.fn().mockReturnValue('https://5432-northflank-project.northflank.app');
          
          VibeKit.mockImplementation(() => ({
            getHost: mockGetHost
          }));
          
          const service = new VibeKitService({
            environments: {
              northflank: {
                apiKey: 'test-northflank-key',
                projectId: 'test-project'
              }
            }
          });
          
          const result = service.getHost(5432);
          expect(result).toBe('https://5432-northflank-project.northflank.app');
        });

        test('should support multiple sandbox environments', () => {
          const { VibeKit } = require('@vibe-kit/sdk');
          const mockGetHost = jest.fn().mockReturnValue('https://9000-multi-env.example.com');
          
          VibeKit.mockImplementation(() => ({
            getHost: mockGetHost
          }));
          
          const service = new VibeKitService({
            environments: {
              e2b: { apiKey: 'test-e2b-key' },
              daytona: { apiKey: 'test-daytona-key' },
              northflank: { apiKey: 'test-northflank-key' }
            }
          });
          
          const result = service.getHost(9000);
          expect(result).toBe('https://9000-multi-env.example.com');
        });

        test('should handle VibeKit instance not initialized', () => {
          const { VibeKit } = require('@vibe-kit/sdk');
          
          VibeKit.mockImplementation(() => null);
          
          const service = new VibeKitService({
            environments: {
              e2b: { apiKey: 'test-key' }
            }
          });
          
          expect(() => service.getHost(3000)).toThrow('VibeKit instance not initialized');
        });

        test('should handle invalid URL response from VibeKit', () => {
          const { VibeKit } = require('@vibe-kit/sdk');
          const mockGetHost = jest.fn().mockReturnValue(null); // Invalid response
          
          VibeKit.mockImplementation(() => ({
            getHost: mockGetHost
          }));
          
          const service = new VibeKitService({
            environments: {
              e2b: { apiKey: 'test-key' }
            }
          });
          
          expect(() => service.getHost(3000)).toThrow('Failed to generate host URL. Sandbox may not be active.');
        });

        test('should handle sandbox-specific errors gracefully', () => {
          const { VibeKit } = require('@vibe-kit/sdk');
          
          const testCases = [
            {
              error: new Error('sandbox not active'),
              expectedMessage: 'Sandbox not active. Please ensure a sandbox environment is running before calling getHost.'
            },
            {
              error: new Error('unsupported sandbox type'),
              expectedMessage: 'Unsupported sandbox environment. getHost is only available for E2B, Daytona, and Northflank sandboxes.'
            },
            {
              error: new Error('invalid port range'),
              expectedMessage: 'Invalid port number. Port must be a valid integer between 1 and 65535.'
            },
            {
              error: new Error('network timeout'),
              expectedMessage: 'Network error. Please check your internet connection and sandbox service availability.'
            },
            {
              error: new Error('permission denied'),
              expectedMessage: 'Insufficient permissions to access sandbox host information.'
            }
          ];

          for (const testCase of testCases) {
            VibeKit.mockImplementation(() => ({
              getHost: jest.fn().mockImplementation(() => {
                throw testCase.error;
              })
            }));
            
            const service = new VibeKitService({
              environments: {
                e2b: { apiKey: 'test-key' }
              }
            });
            
            expect(() => service.getHost(3000)).toThrow(testCase.expectedMessage);
          }
        });

        test('should validate edge case port numbers', () => {
          const { VibeKit } = require('@vibe-kit/sdk');
          const mockGetHost = jest.fn().mockReturnValue('https://port-test.example.com');
          
          VibeKit.mockImplementation(() => ({
            getHost: mockGetHost
          }));
          
          const service = new VibeKitService({
            environments: {
              e2b: { apiKey: 'test-key' }
            }
          });
          
          // Valid edge cases
          expect(service.getHost(1)).toBe('https://port-test.example.com');
          expect(service.getHost(65535)).toBe('https://port-test.example.com');
          expect(service.getHost(80)).toBe('https://port-test.example.com');
          expect(service.getHost(443)).toBe('https://port-test.example.com');
          expect(service.getHost(8080)).toBe('https://port-test.example.com');
        });
      });

      describe('getTaskHost Method', () => {
        test('should successfully get host URL for task with valid parameters', () => {
          const { VibeKit } = require('@vibe-kit/sdk');
          const mockGetHost = jest.fn().mockReturnValue('https://4000-task-host.e2b.dev');
          
          VibeKit.mockImplementation(() => ({
            getHost: mockGetHost
          }));
          
          const service = new VibeKitService({
            environments: {
              e2b: { apiKey: 'test-key' }
            }
          });
          
          const task = {
            id: 'task-123',
            title: 'Test task'
          };
          
          const result = service.getTaskHost(task, 4000);
          
          expect(result).toBe('https://4000-task-host.e2b.dev');
          expect(mockGetHost).toHaveBeenCalledWith(4000);
        });

        test('should validate task parameter', () => {
          const service = new VibeKitService({
            environments: {
              e2b: { apiKey: 'test-key' }
            }
          });
          
          // Invalid task parameters
          expect(() => service.getTaskHost(null, 3000)).toThrow('task parameter is required and must have an id');
          expect(() => service.getTaskHost(undefined, 3000)).toThrow('task parameter is required and must have an id');
          expect(() => service.getTaskHost({}, 3000)).toThrow('task parameter is required and must have an id');
          expect(() => service.getTaskHost({ title: 'No ID' }, 3000)).toThrow('task parameter is required and must have an id');
        });

        test('should support verbose logging', () => {
          const { VibeKit } = require('@vibe-kit/sdk');
          const mockGetHost = jest.fn().mockReturnValue('https://5000-verbose-test.e2b.dev');
          const consoleLog = jest.spyOn(console, 'log').mockImplementation();
          
          VibeKit.mockImplementation(() => ({
            getHost: mockGetHost
          }));
          
          const service = new VibeKitService({
            environments: {
              e2b: { apiKey: 'test-key' }
            }
          });
          
          const task = {
            id: 'task-verbose',
            title: 'Verbose test task'
          };
          
          const result = service.getTaskHost(task, 5000, { verbose: true });
          
          expect(result).toBe('https://5000-verbose-test.e2b.dev');
          expect(consoleLog).toHaveBeenCalledWith(
            'Task task-verbose: Host URL for port 5000 - https://5000-verbose-test.e2b.dev'
          );
          
          consoleLog.mockRestore();
        });

        test('should add task context to errors', () => {
          const { VibeKit } = require('@vibe-kit/sdk');
          
          VibeKit.mockImplementation(() => ({
            getHost: jest.fn().mockImplementation(() => {
              throw new Error('Sandbox error');
            })
          }));
          
          const service = new VibeKitService({
            environments: {
              e2b: { apiKey: 'test-key' }
            }
          });
          
          const task = {
            id: 'task-error',
            title: 'Error test task'
          };
          
          try {
            service.getTaskHost(task, 3000);
            expect(true).toBe(false); // Should not reach here
          } catch (error) {
            expect(error.message).toBe('Task task-error: Sandbox error');
            expect(error.originalError).toBeDefined();
            expect(error.originalError.message).toBe('Sandbox error');
          }
        });
      });
    });
  });
}); 