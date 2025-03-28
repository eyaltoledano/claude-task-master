/**
 * Unit tests for the interactive ideate command validators
 * 
 * Note: These tests focus specifically on the validators used in the 
 * interactive ideate command to ensure proper validation behavior.
 */

import { validators } from '../../scripts/modules/prompt-manager.js';

describe('Interactive Prompt Validators', () => {
  test('required validator should validate non-empty input', () => {
    expect(validators.required('Test')).toBe(true);
    expect(validators.required('')).toBe('This field is required');
    expect(validators.required('   ')).toBe('This field is required');
  });
  
  test('minLength validator should validate minimum length', () => {
    const minLength5 = validators.minLength(5);
    expect(minLength5('12345')).toBe(true);
    expect(minLength5('1234')).toBe('Input must be at least 5 characters');
  });
}); 