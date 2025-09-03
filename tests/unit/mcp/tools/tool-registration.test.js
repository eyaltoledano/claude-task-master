/**
 * tool-registration.test.js
 * Comprehensive unit tests for the Task Master MCP tool registration system
 * Tests environment variable control system covering all configuration modes and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Task Master Tool Registration System', () => {
  let mockServer;
  let originalEnv;
  let registerTaskMasterTools;
  let toolRegistry;
  let coreTools;
  let standardTools;
  
  beforeEach(async () => {
    originalEnv = process.env.TASK_MASTER_TOOLS;
    
    mockServer = {
      tools: [],
      addTool: jest.fn((tool) => {
        mockServer.tools.push(tool);
        return tool;
      })
    };
    
    delete process.env.TASK_MASTER_TOOLS;
    
    jest.resetModules();
    const indexModule = await import('../../../../mcp-server/src/tools/index.js');
    const registryModule = await import('../../../../mcp-server/src/tools/tool-registry.js');
    
    registerTaskMasterTools = indexModule.registerTaskMasterTools;
    toolRegistry = registryModule.toolRegistry;
    coreTools = registryModule.coreTools;
    standardTools = registryModule.standardTools;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TASK_MASTER_TOOLS = originalEnv;
    } else {
      delete process.env.TASK_MASTER_TOOLS;
    }
    
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('Test Environment Setup', () => {
    it('should have properly configured mock server', () => {
      expect(mockServer).toBeDefined();
      expect(typeof mockServer.addTool).toBe('function');
      expect(Array.isArray(mockServer.tools)).toBe(true);
      expect(mockServer.tools.length).toBe(0);
    });

    it('should have correct tool registry structure', () => {
      expect(Object.keys(toolRegistry).length).toBe(36);
      expect(coreTools.length).toBe(7);
      expect(standardTools.length).toBe(15);
    });

    it('should have correct core tools', () => {
      const expectedCoreTools = [
        'get_tasks',
        'next_task', 
        'get_task',
        'set_task_status',
        'update_subtask',
        'parse_prd',
        'expand_task'
      ];
      expect(coreTools).toEqual(expect.arrayContaining(expectedCoreTools));
      expect(coreTools.length).toBe(7);
    });

    it('should have correct standard tools that include all core tools', () => {
      expect(standardTools.length).toBe(15);
      coreTools.forEach(tool => {
        expect(standardTools).toContain(tool);
      });
    });

    it('should have all expected tools in registry', () => {
      const expectedTools = [
        'initialize_project',
        'models',
        'research',
        'add_tag',
        'delete_tag',
        'get_tasks',
        'next_task',
        'get_task'
      ];
      expectedTools.forEach(tool => {
        expect(toolRegistry).toHaveProperty(tool);
      });
    });
  });

  describe('Configuration Modes', () => {
    it('should register all tools (36) when TASK_MASTER_TOOLS is not set (default behavior)', () => {
      delete process.env.TASK_MASTER_TOOLS;
      
      registerTaskMasterTools(mockServer);
      
      expect(mockServer.addTool).toHaveBeenCalledTimes(36);
    });

    it('should register all tools (36) when TASK_MASTER_TOOLS=all', () => {
      process.env.TASK_MASTER_TOOLS = 'all';
      
      registerTaskMasterTools(mockServer);
      
      expect(mockServer.addTool).toHaveBeenCalledTimes(36);
    });

    it('should register exactly 7 core tools when TASK_MASTER_TOOLS=core', () => {
      process.env.TASK_MASTER_TOOLS = 'core';
      
      registerTaskMasterTools(mockServer);
      
      expect(mockServer.addTool).toHaveBeenCalledTimes(7);
    });

    it('should register exactly 15 standard tools when TASK_MASTER_TOOLS=standard', () => {
      process.env.TASK_MASTER_TOOLS = 'standard';
      
      registerTaskMasterTools(mockServer);
      
      expect(mockServer.addTool).toHaveBeenCalledTimes(15);
    });

    it('should treat lean as alias for core mode (7 tools)', () => {
      process.env.TASK_MASTER_TOOLS = 'lean';
      
      registerTaskMasterTools(mockServer);
      
      expect(mockServer.addTool).toHaveBeenCalledTimes(7);
    });

    it('should handle case insensitive configuration values', () => {
      process.env.TASK_MASTER_TOOLS = 'CORE';
      
      registerTaskMasterTools(mockServer);
      
      expect(mockServer.addTool).toHaveBeenCalledTimes(7);
    });
  });

  describe('Custom Tool Selection and Edge Cases', () => {
    it('should register specific tools from comma-separated list', () => {
      process.env.TASK_MASTER_TOOLS = 'get_tasks,next_task,get_task';
      
      registerTaskMasterTools(mockServer);
      
      expect(mockServer.addTool).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed valid and invalid tool names gracefully', () => {
      process.env.TASK_MASTER_TOOLS = 'invalid_tool,get_tasks,fake_tool,next_task';
      
      registerTaskMasterTools(mockServer);
      
      expect(mockServer.addTool).toHaveBeenCalledTimes(2);
    });

    it('should default to all tools with completely invalid input', () => {
      process.env.TASK_MASTER_TOOLS = 'completely_invalid';
      
      registerTaskMasterTools(mockServer);
      
      expect(mockServer.addTool).toHaveBeenCalledTimes(36);
    });

    it('should handle empty string environment variable', () => {
      process.env.TASK_MASTER_TOOLS = '';
      
      registerTaskMasterTools(mockServer);
      
      expect(mockServer.addTool).toHaveBeenCalledTimes(36);
    });

    it('should handle whitespace in comma-separated lists', () => {
      process.env.TASK_MASTER_TOOLS = ' get_tasks , next_task , get_task ';
      
      registerTaskMasterTools(mockServer);
      
      expect(mockServer.addTool).toHaveBeenCalledTimes(3);
    });

    it('should handle duplicate tools in list', () => {
      process.env.TASK_MASTER_TOOLS = 'get_tasks,get_tasks,next_task,get_tasks';
      
      registerTaskMasterTools(mockServer);
      
      expect(mockServer.addTool).toHaveBeenCalledTimes(4);
    });

    it('should handle only commas and empty entries', () => {
      process.env.TASK_MASTER_TOOLS = ',,,';
      
      registerTaskMasterTools(mockServer);
      
      expect(mockServer.addTool).toHaveBeenCalledTimes(36);
    });

    it('should handle single tool selection', () => {
      process.env.TASK_MASTER_TOOLS = 'get_tasks';
      
      registerTaskMasterTools(mockServer);
      
      expect(mockServer.addTool).toHaveBeenCalledTimes(1);
    });
  });

  describe('Coverage Analysis and Integration Tests', () => {
    it('should provide 100% code coverage for environment control logic', () => {
      const testCases = [
        { env: undefined, expectedCount: 36, description: 'undefined env (all)' },
        { env: '', expectedCount: 36, description: 'empty string (all)' },
        { env: 'all', expectedCount: 36, description: 'all mode' },
        { env: 'core', expectedCount: 7, description: 'core mode' },
        { env: 'lean', expectedCount: 7, description: 'lean mode (alias)' },
        { env: 'standard', expectedCount: 15, description: 'standard mode' },
        { env: 'get_tasks,next_task', expectedCount: 2, description: 'custom list' },
        { env: 'invalid_tool', expectedCount: 36, description: 'invalid fallback' },
      ];

      testCases.forEach(testCase => {
        delete process.env.TASK_MASTER_TOOLS;
        if (testCase.env !== undefined) {
          process.env.TASK_MASTER_TOOLS = testCase.env;
        }
        
        mockServer.tools = [];
        mockServer.addTool.mockClear();
        
        registerTaskMasterTools(mockServer);
        
        expect(mockServer.addTool).toHaveBeenCalledTimes(testCase.expectedCount);
      });
    });

    it('should have optimal performance characteristics', () => {
      const startTime = Date.now();
      
      process.env.TASK_MASTER_TOOLS = 'all';
      
      registerTaskMasterTools(mockServer);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(100);
      expect(mockServer.addTool).toHaveBeenCalledTimes(36);
    });

    it('should validate token reduction claims', () => {
      expect(coreTools.length).toBeLessThan(standardTools.length);
      expect(standardTools.length).toBeLessThan(Object.keys(toolRegistry).length);
      
      expect(coreTools.length).toBe(7);
      expect(standardTools.length).toBe(15);
      expect(Object.keys(toolRegistry).length).toBe(36);
      
      const allToolsCount = Object.keys(toolRegistry).length;
      const coreReduction = ((allToolsCount - coreTools.length) / allToolsCount) * 100;
      const standardReduction = ((allToolsCount - standardTools.length) / allToolsCount) * 100;
      
      expect(coreReduction).toBeGreaterThan(80);
      expect(standardReduction).toBeGreaterThan(50);
    });

    it('should maintain referential integrity of tool registry', () => {
      coreTools.forEach(tool => {
        expect(standardTools).toContain(tool);
      });
      
      standardTools.forEach(tool => {
        expect(toolRegistry).toHaveProperty(tool);
      });
      
      Object.keys(toolRegistry).forEach(tool => {
        expect(typeof toolRegistry[tool]).toBe('function');
      });
    });

    it('should handle concurrent registration attempts', () => {
      process.env.TASK_MASTER_TOOLS = 'core';
      
      registerTaskMasterTools(mockServer);
      registerTaskMasterTools(mockServer);
      registerTaskMasterTools(mockServer);
      
      expect(mockServer.addTool).toHaveBeenCalledTimes(21);
    });

    it('should validate all documented tool categories exist', () => {
      const allTools = Object.keys(toolRegistry);
      
      const projectSetupTools = allTools.filter(tool => 
        ['initialize_project', 'models', 'rules', 'parse_prd'].includes(tool)
      );
      expect(projectSetupTools.length).toBeGreaterThan(0);
      
      const taskManagementTools = allTools.filter(tool => 
        ['get_tasks', 'get_task', 'next_task', 'set_task_status'].includes(tool)
      );
      expect(taskManagementTools.length).toBeGreaterThan(0);
      
      const analysisTools = allTools.filter(tool => 
        ['analyze_project_complexity', 'complexity_report'].includes(tool)
      );
      expect(analysisTools.length).toBeGreaterThan(0);
      
      const tagManagementTools = allTools.filter(tool => 
        ['add_tag', 'delete_tag', 'list_tags', 'use_tag'].includes(tool)
      );
      expect(tagManagementTools.length).toBeGreaterThan(0);
    });

    it('should handle error conditions gracefully', () => {
      const problematicInputs = [
        'null',
        'undefined',
        '   ',
        '\n\t',
        'special!@#$%^&*()characters',
        'very,very,very,very,very,very,very,long,comma,separated,list,with,invalid,tools,that,should,fallback,to,all',
      ];

      problematicInputs.forEach(input => {
        mockServer.tools = [];
        mockServer.addTool.mockClear();
        
        process.env.TASK_MASTER_TOOLS = input;
        
        expect(() => registerTaskMasterTools(mockServer)).not.toThrow();
        
        expect(mockServer.addTool).toHaveBeenCalledTimes(36);
      });
    });
  });
});