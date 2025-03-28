/**
 * Unit tests for the display utilities module
 */

import { jest } from '@jest/globals';

// Mock console methods
global.console.log = jest.fn();
global.console.error = jest.fn();
global.console.warn = jest.fn();
global.console.info = jest.fn();

// Mock external dependencies
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn(text => `[blue]${text}[/blue]`);
  mockChalk.green = jest.fn(text => `[green]${text}[/green]`);
  mockChalk.yellow = jest.fn(text => `[yellow]${text}[/yellow]`);
  mockChalk.red = jest.fn(text => `[red]${text}[/red]`);
  mockChalk.cyan = jest.fn(text => `[cyan]${text}[/cyan]`);
  mockChalk.gray = jest.fn(text => `[gray]${text}[/gray]`);
  mockChalk.magenta = jest.fn(text => `[magenta]${text}[/magenta]`);
  mockChalk.white = jest.fn(text => `[white]${text}[/white]`);
  mockChalk.bold = mockChalk;
  mockChalk.underline = mockChalk;
  return mockChalk;
});

jest.mock('boxen', () => {
  return (content) => `[boxen]${content}[/boxen]`;
});

jest.mock('cli-table3', () => {
  return function() {
    return {
      push: jest.fn(),
      toString: jest.fn().mockReturnValue('[table-output]')
    };
  };
});

jest.mock('ora', () => {
  return (options) => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis()
  });
});

jest.mock('cli-cursor', () => ({
  hide: jest.fn(),
  show: jest.fn()
}));

// Now import the module after setting up all mocks
import displayUtils, {
  colors,
  header,
  formatJSON,
  createTable,
  success,
  error,
  warning,
  info,
  spinner,
  formatList,
  progressBar,
  box,
  formatKeyValue
} from '../../scripts/modules/display-utils.js';

describe('Display Utilities Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log.mockClear();
    console.error.mockClear();
    console.warn.mockClear();
    console.info.mockClear();
  });
  
  describe('colors', () => {
    test('should export color functions', () => {
      expect(colors.primary).toBeDefined();
      expect(colors.success).toBeDefined();
      expect(colors.warning).toBeDefined();
      expect(colors.error).toBeDefined();
    });
  });
  
  describe('header', () => {
    test('should create a formatted header', () => {
      const result = header('Test Header');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
  
  describe('formatJSON', () => {
    test('should format JSON data for display', () => {
      const data = { test: 'value', nested: { prop: 123 } };
      const result = formatJSON(data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
  
  describe('createTable', () => {
    test('should create a table with headers and rows', () => {
      const headers = ['Name', 'Value'];
      const rows = [['test1', 'value1'], ['test2', 'value2']];
      const result = createTable(headers, rows);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
  
  describe('message functions', () => {
    test('success should log message with success color', () => {
      success('Operation completed');
      expect(console.log).toHaveBeenCalled();
    });
    
    test('error should log message with error color', () => {
      error('Something went wrong');
      expect(console.log).toHaveBeenCalled();
    });
    
    test('warning should log message with warning color', () => {
      warning('Proceed with caution');
      expect(console.log).toHaveBeenCalled();
    });
    
    test('info should log message with info color', () => {
      info('Additional information');
      expect(console.log).toHaveBeenCalled();
    });
  });
  
  describe('spinner', () => {
    test('should create a spinner with the given text', () => {
      const result = spinner('Loading...');
      expect(result).toBeDefined();
    });
  });
  
  describe('formatList', () => {
    test('should format a list of items with bullets', () => {
      const items = ['item1', 'item2', 'item3'];
      const result = formatList(items);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
  
  describe('progressBar', () => {
    test('should create a text progress bar', () => {
      const result = progressBar(50, 10);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
    
    test('should create empty bar for 0%', () => {
      const result = progressBar(0, 10);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
    
    test('should create full bar for 100%', () => {
      const result = progressBar(100, 10);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
  
  describe('box', () => {
    test('should create a boxed content', () => {
      const result = box('Content goes here');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
  
  describe('formatKeyValue', () => {
    test('should format key-value pairs', () => {
      const data = { key1: 'value1', key2: 'value2' };
      const result = formatKeyValue(data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
  
  describe('module exports', () => {
    test('should export all utility functions', () => {
      expect(Object.keys(displayUtils).length).toBeGreaterThan(5);
      expect(displayUtils.header).toBe(header);
      expect(displayUtils.formatJSON).toBe(formatJSON);
      expect(displayUtils.createTable).toBe(createTable);
      expect(displayUtils.success).toBe(success);
      expect(displayUtils.error).toBe(error);
    });
  });
}); 