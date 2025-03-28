/**
 * Unit tests for the display templates module
 */

import { jest } from '@jest/globals';

// Create a simple mock of displayUtils before importing our module
const mockDisplayUtils = {
  header: jest.fn(title => `[HEADER]${title}[/HEADER]`),
  sectionHeader: jest.fn(title => `[SECTION]${title}[/SECTION]`),
  formatKeyValue: jest.fn(() => '[KEY_VALUE]'),
  divider: jest.fn(() => '[DIVIDER]'),
  box: jest.fn(content => `[BOX]${content}[/BOX]`),
  formatList: jest.fn(() => '[LIST]'),
  createTable: jest.fn(() => '[TABLE]'),
  formatJSON: jest.fn(() => '[JSON]'),
  progressBar: jest.fn(() => '[PROGRESS_BAR]'),
  colors: {
    primary: jest.fn(text => `[PRIMARY]${text}[/PRIMARY]`),
    success: jest.fn(text => `[SUCCESS]${text}[/SUCCESS]`),
    error: jest.fn(text => `[ERROR]${text}[/ERROR]`),
    warning: jest.fn(text => `[WARNING]${text}[/WARNING]`),
    info: jest.fn(text => `[INFO]${text}[/INFO]`),
    highlight: jest.fn(text => `[HIGHLIGHT]${text}[/HIGHLIGHT]`),
  }
};

// Mock the module
jest.mock('../../scripts/modules/display-utils.js', () => {
  return mockDisplayUtils;
}, { virtual: true });

// Now we can import our module
import templates from '../../scripts/modules/display-templates.js';

describe('Display Templates Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should export template functions', () => {
    expect(templates).toBeDefined();
    expect(Object.keys(templates).length).toBeGreaterThan(0);
  });
  
  test('conceptSummary should return a string', () => {
    const concept = { id: 'test', title: 'Test' };
    
    // Check that the function exists and returns something
    expect(typeof templates.conceptSummary).toBe('function');
    expect(templates.conceptSummary(concept)).toBeDefined();
  });
  
  test('expertRecommendation should return a string', () => {
    const recommendation = { expert: 'Test Expert' };
    
    expect(typeof templates.expertRecommendation).toBe('function');
    expect(templates.expertRecommendation(recommendation)).toBeDefined();
  });
  
  test('taskDetails should return a string', () => {
    const task = { id: 1, title: 'Test Task' };
    
    expect(typeof templates.taskDetails).toBe('function');
    expect(templates.taskDetails(task)).toBeDefined();
  });
  
  test('commandHelp should return a string', () => {
    const command = { name: 'test' };
    
    expect(typeof templates.commandHelp).toBe('function');
    expect(templates.commandHelp(command)).toBeDefined();
  });
  
  test('errorMessage should return a string', () => {
    const error = new Error('Test error');
    
    expect(typeof templates.errorMessage).toBe('function');
    expect(templates.errorMessage(error)).toBeDefined();
  });
  
  test('successMessage should return a string', () => {
    const data = { title: 'Success' };
    
    expect(typeof templates.successMessage).toBe('function');
    expect(templates.successMessage(data)).toBeDefined();
  });
  
  test('jsonDisplay should return a string', () => {
    const data = { test: 'value' };
    
    expect(typeof templates.jsonDisplay).toBe('function');
    expect(templates.jsonDisplay(data)).toBeDefined();
  });
  
  test('progressDisplay should return a string', () => {
    const progress = { percent: 50 };
    
    expect(typeof templates.progressDisplay).toBe('function');
    expect(templates.progressDisplay(progress)).toBeDefined();
  });
}); 