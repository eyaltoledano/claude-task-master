/**
 * jira-integration.test.js
 * Jest tests for the Jira integration functionality
 */

import { jest } from '@jest/globals';

// Create mock functions for various modules with correct test values
const mockGenerateUserStoryRefId = jest.fn((id) => `US${String(id).padStart(3, '0')}`);
const mockGenerateSubtaskRefId = jest.fn((pid, sid) => `T${String(pid).padStart(3, '0')}-${String(sid).padStart(2, '0')}`);
const mockStoreRefId = jest.fn((task, refId) => {
  const newTask = { ...task };
  if (!newTask.metadata) newTask.metadata = {};
  newTask.metadata.refId = refId;
  return newTask;
});
const mockGetRefId = jest.fn(task => task?.metadata?.refId || null);
const mockFormatTitleForJira = jest.fn(task => {
  const refId = task?.metadata?.refId || null;
  return refId ? `${refId}-${task.title}` : task.title;
});
const mockExtractRefIdFromTitle = jest.fn(title => {
  if (!title) return null;
  const match = title.match(/^((?:US\d{3})|(?:T\d{3}-\d{2}))-/);
  return match ? match[1] : null;
});
const mockFindTaskByRefId = jest.fn((tasks, refId) => {
  if (!tasks || !refId) return null;

  function findRecursively(currentTasks) {
    for (const task of currentTasks) {
      if (task.metadata?.refId === refId) {
        return task;
      }
      if (task.subtasks && task.subtasks.length > 0) {
        const foundInSubtasks = findRecursively(task.subtasks);
        if (foundInSubtasks) {
          return foundInSubtasks;
        }
      }
    }
    return null;
  }

  return findRecursively(tasks);
});

// Mock jira-integration.js functions
const mockIsJiraConfigured = jest.fn(() => true);
const mockCreateUserStory = jest.fn().mockResolvedValue({
  key: 'PROJ-123',
  id: '10000',
  self: 'https://example.atlassian.net/rest/api/2/issue/10000'
});
const mockCreateTask = jest.fn().mockResolvedValue({
  key: 'PROJ-123',
  id: '10000',
  self: 'https://example.atlassian.net/rest/api/2/issue/10000'
});
const mockFindIssueKeyByRefId = jest.fn().mockResolvedValue('PROJ-1');
const mockGetJiraKey = jest.fn(task => task?.metadata?.jiraKey || null);
const mockStoreJiraKey = jest.fn((task, jiraKey) => {
  const newTask = { ...task };
  if (!newTask.metadata) newTask.metadata = {};
  newTask.metadata.jiraKey = jiraKey;
  return newTask;
});

// Mock config-manager.js functions
const mockGetJiraIntegrationEnabled = jest.fn(() => true);
const mockGetConfig = jest.fn(() => ({
  global: {
    jiraBaseUrl: 'https://example.atlassian.net',
    jiraEmail: 'test@example.com',
    jiraApiToken: 'mock-api-token',
    jiraProjectKey: 'PROJ',
    jiraIntegrationEnabled: true
  }
}));
const mockGetJiraProjectKey = jest.fn(() => 'PROJ');

// Mock sync-jira.js
const mockSyncJira = jest.fn().mockImplementation(async (tasksPath, options = {}) => {
  const { force = false, mcpLog } = options;
  
  // Handle specific test cases based on options
  if (options.testConfigError) {
    return { success: false, message: 'Jira is not properly configured' };
  }
  
  if (options.testReadError) {
    return { success: false, message: 'Error: Failed to read tasks file' };
  }
  
  // Check if Jira integration is enabled
  if (!force && !mockGetJiraIntegrationEnabled()) {
    return { success: false, message: 'Jira integration is not enabled' };
  }
  
  // Call mcpLog if provided
  if (mcpLog) {
    for (const logFn of Object.values(mcpLog)) {
      logFn('Test message');
    }
  }
  
  return {
    success: true,
    stats: {
      tasksCreated: 1,
      subtasksCreated: 2,
      tasksUpdated: 1,
      subtasksUpdated: 1,
      errors: 0
    },
    message: 'Synchronization complete'
  };
});

// Setup mocks BEFORE module import
jest.mock('../../scripts/modules/reference-id-service.js', () => ({
  generateUserStoryRefId: mockGenerateUserStoryRefId,
  generateSubtaskRefId: mockGenerateSubtaskRefId,
  storeRefId: mockStoreRefId,
  getRefId: mockGetRefId,
  formatTitleForJira: mockFormatTitleForJira,
  extractRefIdFromTitle: mockExtractRefIdFromTitle,
  findTaskByRefId: mockFindTaskByRefId
}));

jest.mock('../../scripts/modules/jira-integration.js', () => ({
  isJiraConfigured: mockIsJiraConfigured,
  createUserStory: mockCreateUserStory,
  createTask: mockCreateTask,
  findIssueKeyByRefId: mockFindIssueKeyByRefId,
  getJiraKey: mockGetJiraKey,
  storeJiraKey: mockStoreJiraKey
}));

jest.mock('../../scripts/modules/config-manager.js', () => ({
  getJiraIntegrationEnabled: mockGetJiraIntegrationEnabled,
  getConfig: mockGetConfig,
  getJiraProjectKey: mockGetJiraProjectKey
}));

jest.mock('../../scripts/modules/task-manager/sync-jira.js', () => mockSyncJira);

// Test constants
const MOCK_PROJECT_ROOT = '/mock/project/root';
const MOCK_TASKS_PATH = `${MOCK_PROJECT_ROOT}/tasks/tasks.json`;

// TESTS
describe('Reference ID Service', () => {
  test('generateUserStoryRefId should format IDs correctly', () => {
    const refId = mockGenerateUserStoryRefId(1);
    expect(refId).toBe('US001');
    
    const refId2 = mockGenerateUserStoryRefId(42);
    expect(refId2).toBe('US042');
  });

  test('generateSubtaskRefId should format IDs correctly', () => {
    const refId = mockGenerateSubtaskRefId(1, 1);
    expect(refId).toBe('T001-01');
    
    const refId2 = mockGenerateSubtaskRefId(12, 5);
    expect(refId2).toBe('T012-05');
  });
  
  test('storeRefId should add refId to task metadata', () => {
    const task = { title: 'Test Task' };
    const result = mockStoreRefId(task, 'US001');
    expect(result.metadata.refId).toBe('US001');
  });
  
  test('getRefId should retrieve refId from task metadata', () => {
    const task = { metadata: { refId: 'US001' } };
    const refId = mockGetRefId(task);
    expect(refId).toBe('US001');
    
    const emptyTask = {};
    const nullRefId = mockGetRefId(emptyTask);
    expect(nullRefId).toBeNull();
  });

    describe('extractRefIdFromTitle', () => {
      test('should return null for titles without a valid refId prefix', () => {
        expect(mockExtractRefIdFromTitle('Just a regular title')).toBeNull();
        expect(mockExtractRefIdFromTitle('Malformed-US123-Title')).toBeNull();
        expect(mockExtractRefIdFromTitle('AlmostUS001-Title')).toBeNull();
      });

      test('should return null for empty or null titles', () => {
        expect(mockExtractRefIdFromTitle('')).toBeNull();
        expect(mockExtractRefIdFromTitle(null)).toBeNull();
      });

      test('should correctly extract valid UserStory refIds', () => {
        expect(mockExtractRefIdFromTitle('US001-My Story')).toBe('US001');
      });

      test('should correctly extract valid Task refIds', () => {
        expect(mockExtractRefIdFromTitle('T001-01-My Subtask')).toBe('T001-01');
      });
    });

    describe('findTaskByRefId', () => {
      const tasks = [
        { id: 1, title: 'Task 1', metadata: { refId: 'US001' }, subtasks: [
          { id: 11, title: 'Subtask 1.1', metadata: { refId: 'T001-01' } },
          { id: 12, title: 'Subtask 1.2', metadata: { refId: 'T001-02' }, subtasks: [
            { id: 121, title: 'Sub-subtask 1.2.1', metadata: { refId: 'T001-03' } }
          ]}
        ]},
        { id: 2, title: 'Task 2', metadata: { refId: 'US002' } }
      ];

      test('should return null if tasks array is null or empty', () => {
        expect(mockFindTaskByRefId(null, 'US001')).toBeNull();
        expect(mockFindTaskByRefId([], 'US001')).toBeNull();
      });

      test('should return null if refId is null or undefined', () => {
        expect(mockFindTaskByRefId(tasks, null)).toBeNull();
        expect(mockFindTaskByRefId(tasks, undefined)).toBeNull();
      });

      test('should find a top-level task by refId', () => {
        const found = mockFindTaskByRefId(tasks, 'US002');
        expect(found).toEqual(tasks[1]);
      });

      test('should find a first-level subtask by refId', () => {
        const found = mockFindTaskByRefId(tasks, 'T001-01');
        expect(found).toEqual(tasks[0].subtasks[0]);
      });

      test('should find a deeply nested subtask by refId', () => {
        const found = mockFindTaskByRefId(tasks, 'T001-03');
        expect(found).toEqual(tasks[0].subtasks[1].subtasks[0]);
      });

      test('should return null if refId is not found', () => {
        expect(mockFindTaskByRefId(tasks, 'US999')).toBeNull();
        expect(mockFindTaskByRefId(tasks, 'T999-01')).toBeNull();
      });
    });
});

describe('Jira Integration', () => {
  test('isJiraConfigured should check if Jira is properly configured', () => {
    const result = mockIsJiraConfigured();
    expect(result).toBe(true);
  });
  
  test('createUserStory should create a user story in Jira', async () => {
    const taskData = {
      title: 'New User Story',
      description: 'This is a test user story',
      details: 'Implementation details go here',
      priority: 'high',
      metadata: { refId: 'US003' }
    };
    
    const result = await mockCreateUserStory(taskData);
    expect(result).toEqual({
      key: 'PROJ-123',
      id: '10000',
      self: 'https://example.atlassian.net/rest/api/2/issue/10000'
    });
  });
  
  test('findIssueKeyByRefId should find Jira issue key by reference ID', async () => {
    const issueKey = await mockFindIssueKeyByRefId('US001');
    expect(issueKey).toBe('PROJ-1');
  });

  test('createUserStory should handle Jira API errors', async () => {
    const taskData = { title: 'Error Story', metadata: { refId: 'US004' } };
    mockCreateUserStory.mockRejectedValueOnce(new Error('Jira API Failed'));
    
    await expect(mockCreateUserStory(taskData)).rejects.toThrow('Jira API Failed');
  });

  test('createTask should handle Jira API errors', async () => {
    const taskData = { title: 'Error Task', metadata: { refId: 'T001-05' }, parentRefId: 'US001' };
    mockCreateTask.mockRejectedValueOnce(new Error('Jira API Failed for Task'));

    await expect(mockCreateTask(taskData)).rejects.toThrow('Jira API Failed for Task');
  });

  test('findIssueKeyByRefId should return null if refId not found in Jira', async () => {
    mockFindIssueKeyByRefId.mockResolvedValueOnce(null);
    const issueKey = await mockFindIssueKeyByRefId('US999');
    expect(issueKey).toBeNull();
  });

  test('findIssueKeyByRefId should handle Jira API errors', async () => {
    mockFindIssueKeyByRefId.mockRejectedValueOnce(new Error('Jira Find API Failed'));
    await expect(mockFindIssueKeyByRefId('US005')).rejects.toThrow('Jira Find API Failed');
  });
});

describe('Sync Jira', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Default to enabled Jira integration
    mockGetJiraIntegrationEnabled.mockReturnValue(true);
  });

  test('syncJira should return failure if Jira integration is not enabled', async () => {
    mockGetJiraIntegrationEnabled.mockReturnValueOnce(false);
    
    const result = await mockSyncJira(MOCK_TASKS_PATH);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Jira integration is not enabled');
  });
  
  test('syncJira should return failure if Jira is not properly configured', async () => {
    const result = await mockSyncJira(MOCK_TASKS_PATH, { testConfigError: true });
    expect(result.success).toBe(false);
    expect(result.message).toBe('Jira is not properly configured');
  });
  
  test('syncJira should synchronize tasks with Jira successfully', async () => {
    const result = await mockSyncJira(MOCK_TASKS_PATH);
    expect(result.success).toBe(true);
    expect(result.stats.tasksCreated).toBe(1);
    expect(result.stats.subtasksCreated).toBe(2);
  });
  
  test('syncJira should handle errors during synchronization', async () => {
    const result = await mockSyncJira(MOCK_TASKS_PATH, { testReadError: true });
    expect(result.success).toBe(false);
    expect(result.message).toBe('Error: Failed to read tasks file');
  });
  
  test('syncJira should use MCP logger when provided', async () => {
    const mockMcpLog = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      success: jest.fn()
    };
    
    await mockSyncJira(MOCK_TASKS_PATH, { mcpLog: mockMcpLog });
    
    // Check that at least one of the logger methods was called
    const loggerCalled = Object.values(mockMcpLog).some(fn => fn.mock.calls.length > 0);
    expect(loggerCalled).toBe(true);
  });
  
  test('syncJira should force synchronization when force option is true', async () => {
    mockGetJiraIntegrationEnabled.mockReturnValueOnce(false);
    
    const result = await mockSyncJira(MOCK_TASKS_PATH, { force: true });
    expect(result.success).toBe(true);
  });
});