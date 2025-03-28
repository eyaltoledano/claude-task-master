/**
 * Simple test for the progress indicator module
 */

import { jest } from '@jest/globals';

// We need to mock the dependencies to load the module
jest.mock('ora', () => ({}), { virtual: true });
jest.mock('../../scripts/modules/display-utils.js', () => ({}), { virtual: true });

// Import the module
import progressIndicator from '../../scripts/modules/progress-indicator.js';

describe('Progress Indicator Module', () => {
  test('should export expected functions and classes', () => {
    expect(progressIndicator).toBeDefined();
    expect(typeof progressIndicator.ProgressIndicator).toBe('function');
    expect(typeof progressIndicator.withProgress).toBe('function');
  });
}); 