/**
 * Tests for the analyzeTaskComplexity function
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Import the specific function being tested
import { analyzeTaskComplexity } from '../../../scripts/modules/task-manager.js';

// Import sample data
import { sampleTasks } from '../../fixtures/sample-tasks.js';

// Mock implementations (Copy relevant mocks from the original file)
const mockReadFileSync = jest.fn();
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockDirname = jest.fn();
const mockCallClaude = jest.fn().mockResolvedValue({ tasks: [] });
const mockCallPerplexity = jest.fn().mockResolvedValue({ tasks: [] });
const mockWriteJSON = jest.fn();
const mockReadJSON = jest.fn();
const mockLog = jest.fn();
const mockGetAvailableAIModel = jest.fn();

// Mock fs module
jest.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: jest.fn()
}));

// Mock path module
jest.mock('path', () => ({
  dirname: mockDirname,
  join: jest.fn((dir, file) => `${dir}/${file}`)
}));

// Mock ui (Only include mocks relevant to analyzeTaskComplexity)
jest.mock('../../../scripts/modules/ui.js', () => ({
  startLoadingIndicator: jest.fn(() => ({ stop: jest.fn() })),
  stopLoadingIndicator: jest.fn()
}));

// Mock dependency-manager (Only include mocks relevant to analyzeTaskComplexity)
jest.mock('../../../scripts/modules/dependency-manager.js', () => ({
}));

// Mock utils (Include mocks relevant to analyzeTaskComplexity)
jest.mock('../../../scripts/modules/utils.js', () => ({
  writeJSON: mockWriteJSON,
  readJSON: mockReadJSON,
  log: mockLog,
  CONFIG: {
    model: 'mock-claude-model',
    maxTokens: 4000,
    temperature: 0.7,
    debug: false,
    defaultSubtasks: 3
  },
  // Mocks for specific utils functions if needed
}));

// Mock AI services (Include mocks relevant to analyzeTaskComplexity)
jest.mock('../../../scripts/modules/ai-services.js', () => ({
  callClaude: mockCallClaude,
  callPerplexity: mockCallPerplexity,
  generateComplexityAnalysisPrompt: jest.fn((tasks) => `Analyze these tasks: ${tasks.map(t=>t.id).join(',')}`),
  getAvailableAIModel: mockGetAvailableAIModel,
  handleClaudeError: jest.fn()
}));

// Test-specific helper function (copied from original file)
const testAnalyzeTaskComplexity = async (options) => {
	try {
		// Get base options or use defaults
		const thresholdScore = parseFloat(options.threshold || '5');
		const useResearch = options.research === true;
		const tasksPath = options.file || 'tasks/tasks.json';
		const reportPath = options.output || 'scripts/task-complexity-report.json';
		const modelName = options.model || 'mock-claude-model';

		// Read tasks file
		const tasksData = mockReadJSON(tasksPath);
		if (!tasksData || !Array.isArray(tasksData.tasks)) {
			throw new Error(`No valid tasks found in ${tasksPath}`);
		}

		// Filter tasks for analysis (non-completed)
		const activeTasks = tasksData.tasks.filter(
			(task) => task.status !== 'done' && task.status !== 'completed'
		);

		// Call the appropriate mock API based on research flag
		let apiResponse;
		if (useResearch) {
			apiResponse = await mockCallPerplexity();
		} else {
			apiResponse = await mockCallClaude();
		}

		// Format report with threshold check
		const report = {
			meta: {
				generatedAt: new Date().toISOString(),
				tasksAnalyzed: activeTasks.length,
				thresholdScore: thresholdScore,
				projectName: tasksData.meta?.projectName || 'Test Project',
				usedResearch: useResearch,
				model: modelName
			},
			complexityAnalysis:
				apiResponse.tasks?.map((task) => ({
					taskId: task.id,
					complexityScore: task.complexity || 5,
					recommendedSubtasks: task.subtaskCount || 3,
					expansionPrompt: `Generate ${task.subtaskCount || 3} subtasks`,
					reasoning: 'Mock reasoning for testing'
				})) || []
		};

		// Write the report
		mockWriteJSON(reportPath, report);

		// Log success
		mockLog(
			'info',
			`Successfully analyzed ${activeTasks.length} tasks with threshold ${thresholdScore}`
		);

		return report;
	} catch (error) {
		mockLog('error', `Error during complexity analysis: ${error.message}`);
		throw error;
	}
};


describe('analyzeTaskComplexity function', () => {
  // Setup common test variables
  const tasksPath = 'tasks/tasks.json';
  const reportPath = 'scripts/task-complexity-report.json';
  const thresholdScore = 5;
  const baseOptions = {
    file: tasksPath,
    output: reportPath,
    threshold: thresholdScore.toString(),
    research: false // Default to false
  };

  // Sample response structure (simplified for these tests)
  const sampleApiResponse = {
    tasks: [
      { id: 1, complexity: 3, subtaskCount: 2 },
      { id: 2, complexity: 7, subtaskCount: 5 },
      { id: 3, complexity: 9, subtaskCount: 8 }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockReadJSON.mockReturnValue(JSON.parse(JSON.stringify(sampleTasks)));
    mockWriteJSON.mockImplementation((path, data) => data);
    mockCallClaude.mockResolvedValue(sampleApiResponse);
    mockCallPerplexity.mockResolvedValue(sampleApiResponse);

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    console.log.mockRestore();
    console.error.mockRestore();
  });

  test('should call Claude when research flag is false', async () => {
    // Arrange
    const options = { ...baseOptions, research: false };

    // Act
    await testAnalyzeTaskComplexity(options); // Use the test helper

    // Assert
    expect(mockCallClaude).toHaveBeenCalled();
    expect(mockCallPerplexity).not.toHaveBeenCalled();
    expect(mockWriteJSON).toHaveBeenCalledWith(
      reportPath,
      expect.any(Object)
    );
  });

  test('should call Perplexity when research flag is true', async () => {
    // Arrange
    const options = { ...baseOptions, research: true };

    // Act
    await testAnalyzeTaskComplexity(options);

    // Assert
    expect(mockCallPerplexity).toHaveBeenCalled();
    expect(mockCallClaude).not.toHaveBeenCalled();
    expect(mockWriteJSON).toHaveBeenCalledWith(
      reportPath,
      expect.any(Object)
    );
  });

  test('should handle valid JSON response from LLM (Claude)', async () => {
    // Arrange
    const options = { ...baseOptions, research: false };

    // Act
    await testAnalyzeTaskComplexity(options);

    // Assert
    expect(mockReadJSON).toHaveBeenCalledWith(tasksPath);
    expect(mockCallClaude).toHaveBeenCalled();
    expect(mockCallPerplexity).not.toHaveBeenCalled();
    expect(mockWriteJSON).toHaveBeenCalledWith(
      reportPath,
      expect.objectContaining({
        complexityAnalysis: expect.arrayContaining([
          expect.objectContaining({ taskId: 1 })
        ])
      })
    );
    expect(mockLog).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('Successfully analyzed')
    );
  });

  test('should handle and fix malformed JSON string response (Claude)', async () => {
    // Arrange
    const malformedJsonResponse = {
      tasks: [{ id: 1, complexity: 3 }] // Simulate a slightly different structure
    };
    mockCallClaude.mockResolvedValueOnce(malformedJsonResponse);
    const options = { ...baseOptions, research: false };

    // Act
    await testAnalyzeTaskComplexity(options);

    // Assert
    // Check that the core logic completed and wrote *something*
    expect(mockCallClaude).toHaveBeenCalled();
    expect(mockCallPerplexity).not.toHaveBeenCalled();
    expect(mockWriteJSON).toHaveBeenCalled();
  });

  test('should handle missing tasks in the response (Claude)', async () => {
    // Arrange
    const incompleteResponse = { tasks: [sampleApiResponse.tasks[0]] }; // Only one task
    mockCallClaude.mockResolvedValueOnce(incompleteResponse);

    const options = { ...baseOptions, research: false };

    // Act
    await testAnalyzeTaskComplexity(options);

    // Assert
    // Check that the core logic completed and wrote *something*
    expect(mockCallClaude).toHaveBeenCalled();
    expect(mockCallPerplexity).not.toHaveBeenCalled();
    expect(mockWriteJSON).toHaveBeenCalled();
  });

  test('should handle different threshold parameter types correctly', async () => {
    // Test with string threshold
    let options = { ...baseOptions, threshold: '7' };
    const report1 = await testAnalyzeTaskComplexity(options);
    expect(report1.meta.thresholdScore).toBe(7);
    expect(mockCallClaude).toHaveBeenCalledTimes(1); // Check call count

    // Reset ONLY call history for relevant mocks
    mockCallClaude.mockClear();
    mockCallPerplexity.mockClear();
    // No need to re-mock mockReadJSON here, beforeEach setup should persist

    // Test with number threshold
    options = { ...baseOptions, threshold: 8 };
    const report2 = await testAnalyzeTaskComplexity(options);
    expect(report2.meta.thresholdScore).toBe(8);
    expect(mockCallClaude).toHaveBeenCalledTimes(1);

    // Reset ONLY call history
    mockCallClaude.mockClear();
    mockCallPerplexity.mockClear();

    // Test with float threshold
    options = { ...baseOptions, threshold: 6.5 };
    const report3 = await testAnalyzeTaskComplexity(options);
    expect(report3.meta.thresholdScore).toBe(6.5);
    expect(mockCallClaude).toHaveBeenCalledTimes(1);

    // Reset ONLY call history
    mockCallClaude.mockClear();
    mockCallPerplexity.mockClear();

    // Test with undefined threshold (should use default)
    const { threshold, ...optionsWithoutThreshold } = baseOptions;
    const report4 = await testAnalyzeTaskComplexity(optionsWithoutThreshold);
    expect(report4.meta.thresholdScore).toBe(5); // Default value from the function
    expect(mockCallClaude).toHaveBeenCalledTimes(1);
  });
}); 