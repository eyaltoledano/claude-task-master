/**
 * Integration tests for the MCP server 'rules' tool (add/remove brand rules)
 */

import { rulesDirect } from '../../../mcp-server/src/core/direct-functions/rules.js';
import fs from 'fs';
import path from 'path';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Use a temp directory for testing (simulate a project root)
const tempProjectRoot = path.join(__dirname, '../../fixtures/temp-rules-project');

beforeAll(() => {
  if (!fs.existsSync(tempProjectRoot)) fs.mkdirSync(tempProjectRoot, { recursive: true });
});

afterAll(() => {
  if (fs.existsSync(tempProjectRoot)) fs.rmSync(tempProjectRoot, { recursive: true, force: true });
});

describe('rulesDirect (integration)', () => {
  it('should add brand rules successfully', async () => {
    const args = {
      action: 'add',
      rules: ['roo'],
      projectRoot: tempProjectRoot,
      yes: true
    };
    const result = await rulesDirect(args, mockLogger, {});
    expect(result.success).toBe(true);
    expect(result.data.output).toMatch(/add|roo/i);
  });

  it('should remove brand rules successfully', async () => {
    const args = {
      action: 'remove',
      rules: ['roo'],
      projectRoot: tempProjectRoot,
      yes: true
    };
    const result = await rulesDirect(args, mockLogger, {});
    expect(result.success).toBe(true);
    expect(result.data.output).toMatch(/remove|roo/i);
  });

  it('should fail if missing required arguments', async () => {
    const args = {
      action: 'add',
      rules: [], // missing brands
      projectRoot: tempProjectRoot
    };
    const result = await rulesDirect(args, mockLogger, {});
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('MISSING_ARGUMENT');
  });

  it('should fail if projectRoot is missing', async () => {
    const args = {
      action: 'add',
      rules: ['roo']
    };
    const result = await rulesDirect(args, mockLogger, {});
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('MISSING_ARGUMENT');
  });
});
