import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KimiCliLanguageModel } from './kimi-cli-language-model.js';
import type { KimiCliLanguageModelOptions } from './types.js';

// Mock the child_process module for testing
vi.mock('child_process', () => ({
  exec: vi.fn((command, callback) => {
    // Mock different responses based on the command
    if (command === 'kimi --version') {
      callback(null, { stdout: 'Kimi CLI v1.0.0\n', stderr: '' });
    } else {
      callback(null, { stdout: '{"role": "assistant", "content": "Hello from Kimi"}\n', stderr: '', status: 0 });
    }
  }),
  spawn: vi.fn(() => {
    // Mock spawn
    const child = {
      stdout: {
        on: vi.fn((event, handler) => {
          if (event === 'data') {
            // Simulate data emission
            setTimeout(() => handler('{"role": "assistant", "content": "Hello from Kimi"}\n'), 10);
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

describe('KimiCliLanguageModel', () => {
  let modelOptions: KimiCliLanguageModelOptions;

  beforeEach(() => {
    modelOptions = {
      modelId: 'kimi-k2-instruct',
      settings: {
        timeout: 30000
      }
    };
  });

  it('should initialize with correct model ID and settings', () => {
    const model = new KimiCliLanguageModel(modelOptions);
    
    expect(model.modelId).toBe('kimi-k2-instruct');
    expect(model.settings.timeout).toBe(30000);
  });

  it('should return correct provider name', () => {
    const model = new KimiCliLanguageModel(modelOptions);
    
    expect(model.provider).toBe('kimi-cli');
  });

  // Add more tests as needed
});