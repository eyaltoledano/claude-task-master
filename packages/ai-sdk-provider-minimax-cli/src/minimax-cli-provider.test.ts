import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MinimaxCliLanguageModel } from './minimax-cli-language-model.js';
import type { MinimaxCliLanguageModelOptions } from './types.js';

// Mock the child_process module for testing
vi.mock('child_process', () => ({
  exec: vi.fn((command, callback) => {
    // Mock different responses based on the command
    if (command === 'mini-agent --version') {
      callback(null, { stdout: 'Mini-agent CLI v1.0.0\n', stderr: '' });
    } else {
      callback(null, { stdout: '{"role": "assistant", "content": "Hello from Minimax"}\n', stderr: '', status: 0 });
    }
  }),
  spawn: vi.fn(() => {
    // Mock spawn
    const child = {
      stdout: {
        on: vi.fn((event, handler) => {
          if (event === 'data') {
            // Simulate data emission
            setTimeout(() => handler('{"role": "assistant", "content": "Hello from Minimax"}\n'), 10);
          }
        })
      },
      stderr: {
        on: vi.fn()
      },
      on: vi.fn((event, handler) => {
        if (event === 'close') {
          // Simulate process completion
          setTimeout(() => handler(0), 20);
        }
      }),
      kill: vi.fn()
    };
    return child;
  })
}));

// Mock fs module
vi.mock('fs/promises', async () => ({
  default: {
    readFile: vi.fn().mockResolvedValue('{"apiKey": "test-api-key"}')
  }
}));

describe('MinimaxCliLanguageModel', () => {
  let modelOptions: MinimaxCliLanguageModelOptions;

  beforeEach(() => {
    modelOptions = {
      modelId: 'MiniMax-M2',
      settings: {
        timeout: 30000
      }
    };
  });

  it('should initialize with correct model ID and settings', () => {
    const model = new MinimaxCliLanguageModel(modelOptions);
    
    expect(model.modelId).toBe('MiniMax-M2');
    expect(model.settings.timeout).toBe(30000);
  });

  it('should return correct provider name', () => {
    const model = new MinimaxCliLanguageModel(modelOptions);
    
    expect(model.provider).toBe('minimax-cli');
  });

  // Add more tests as needed
});