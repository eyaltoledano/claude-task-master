/**
 * Unit tests for the ideate command functionality
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Mock the ai-services module
jest.mock('../../scripts/modules/ai-services.js', () => ({
  generateProductConcept: jest.fn().mockResolvedValue('Mocked product concept content'),
}));

// Import after mocking dependencies
import { ideateProductConcept } from '../../scripts/modules/task-manager.js';

// Set up test environment
const TEST_DIR = './test-temp';
const TEST_FILE = path.join(TEST_DIR, 'test-concept.txt');

describe('ideateProductConcept', () => {
  // Setup before each test
  beforeEach(() => {
    // Ensure test directory exists
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    
    // Clean up any existing test files
    if (fs.existsSync(TEST_FILE)) {
      fs.unlinkSync(TEST_FILE);
    }
    
    // Clear mocks before each test
    jest.clearAllMocks();

    // Mock console.log to prevent output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  // Clean up after tests
  afterAll(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    
    // Restore console.log
    jest.restoreAllMocks();
  });
  
  test('should generate a concept and save to file', async () => {
    // Test data
    const testIdea = 'A task management system for developers';
    
    // Run the function
    await ideateProductConcept(testIdea, TEST_FILE);
    
    // Verify file was created
    expect(fs.existsSync(TEST_FILE)).toBeTruthy();
    
    // Verify file content
    const fileContent = fs.readFileSync(TEST_FILE, 'utf8');
    expect(fileContent).toBe('Mocked product concept content');
    
    // Verify AI service was called with correct parameters
    const { generateProductConcept } = await import('../../scripts/modules/ai-services.js');
    expect(generateProductConcept).toHaveBeenCalledWith(testIdea);
    expect(generateProductConcept).toHaveBeenCalledTimes(1);
  });
  
  test('should handle errors gracefully', async () => {
    // Mock AI service to throw an error
    const { generateProductConcept } = await import('../../scripts/modules/ai-services.js');
    generateProductConcept.mockRejectedValueOnce(new Error('Test error'));
    
    // Run the function and expect it to throw
    await expect(ideateProductConcept('test', TEST_FILE)).rejects.toThrow('Test error');
    
    // Verify file was not created
    expect(fs.existsSync(TEST_FILE)).toBeFalsy();
  });
  
  test('should create directory structure if it does not exist', async () => {
    // Test with nested directory that doesn't exist
    const nestedDir = path.join(TEST_DIR, 'nested', 'dir');
    const nestedFile = path.join(nestedDir, 'concept.txt');
    
    // Ensure directory doesn't exist
    if (fs.existsSync(nestedDir)) {
      fs.rmSync(nestedDir, { recursive: true, force: true });
    }
    
    // Run the function
    await ideateProductConcept('test idea', nestedFile);
    
    // Verify directories and file were created
    expect(fs.existsSync(nestedDir)).toBeTruthy();
    expect(fs.existsSync(nestedFile)).toBeTruthy();
  });
}); 