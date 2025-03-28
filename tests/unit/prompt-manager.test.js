/**
 * Unit tests for the validators in the prompt-manager module
 */

import { validators } from '../../scripts/modules/prompt-manager.js';

describe('Prompt Manager Validators', () => {
  test('required validator should validate non-empty input', () => {
    expect(validators.required('Test')).toBe(true);
    expect(validators.required('')).toBe('This field is required');
    expect(validators.required('   ')).toBe('This field is required');
  });
  
  test('filePath validator should validate valid file paths', () => {
    expect(validators.filePath('path/to/file.txt')).toBe(true);
    expect(validators.filePath('path/to/file?')).toBe('Please enter a valid file path');
    expect(validators.filePath('path/to/file*')).toBe('Please enter a valid file path');
  });
  
  test('minLength validator should validate minimum length', () => {
    const minLength5 = validators.minLength(5);
    expect(minLength5('12345')).toBe(true);
    expect(minLength5('1234')).toBe('Input must be at least 5 characters');
  });
  
  test('pattern validator should validate against pattern', () => {
    const dateValidator = validators.pattern(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format');
    expect(dateValidator('2023-04-15')).toBe(true);
    expect(dateValidator('15-04-2023')).toBe('Invalid date format');
  });
}); 