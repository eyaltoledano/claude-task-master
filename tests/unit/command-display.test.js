/**
 * Simple test for the command display integration module
 */

import { jest } from '@jest/globals';

// Mock dependencies
const mockDisplayUtils = {
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  success: jest.fn(),
  sectionHeader: jest.fn(),
  formatList: jest.fn(),
  divider: jest.fn()
};

const mockDisplayTemplates = {
  conceptSummary: jest.fn(),
  commandHelp: jest.fn(),
  errorMessage: jest.fn(),
  successMessage: jest.fn(),
  taskDetails: jest.fn(),
  jsonDisplay: jest.fn()
};

jest.mock('../../scripts/modules/display-utils.js', () => mockDisplayUtils, { virtual: true });
jest.mock('../../scripts/modules/display-templates.js', () => mockDisplayTemplates, { virtual: true });
jest.mock('../../scripts/modules/progress-indicator.js', () => ({
  ProgressIndicator: jest.fn(function() { return {}; }),
  withProgress: jest.fn()
}), { virtual: true });
jest.mock('../../scripts/modules/json-storage.js', () => ({
  getConceptResponse: jest.fn(),
  saveConceptResponse: jest.fn()
}), { virtual: true });

// Import module under test after mocks are set up
import { CommandDisplay, withDisplay } from '../../scripts/modules/command-display.js';

describe('Command Display Module', () => {
  test('should export CommandDisplay class', () => {
    expect(CommandDisplay).toBeDefined();
    expect(typeof CommandDisplay).toBe('function');
    
    const instance = new CommandDisplay();
    expect(instance).toBeInstanceOf(CommandDisplay);
  });
  
  test('should export withDisplay function', () => {
    expect(withDisplay).toBeDefined();
    expect(typeof withDisplay).toBe('function');
  });
}); 