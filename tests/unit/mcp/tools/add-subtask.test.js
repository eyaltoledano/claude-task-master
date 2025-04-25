import { jest } from '@jest/globals';

// Mock EVERYTHING
const mockAddSubtaskDirect = jest.fn();
jest.mock('../../../../mcp-server/src/core/task-master-core.js', () => ({
  addSubtaskDirect: mockAddSubtaskDirect
}));

const mockHandleApiResult = jest.fn((result) => result);
const mockGetProjectRootFromSession = jest.fn(() => '/mock/project/root');
const mockCreateErrorResponse = jest.fn((msg) => ({
  success: false,
  error: { code: 'ERROR', message: msg }
}));

jest.mock('../../../../mcp-server/src/tools/utils.js', () => ({
  getProjectRootFromSession: mockGetProjectRootFromSession,
  handleApiResult: mockHandleApiResult,
  createErrorResponse: mockCreateErrorResponse,
  createContentResponse: jest.fn((content) => ({
    success: true,
    data: content
  })),
  executeTaskMasterCommand: jest.fn()
}));

// Mock the z object from zod
const mockZod = {
  object: jest.fn(() => mockZod),
  string: jest.fn(() => mockZod),
  boolean: jest.fn(() => mockZod),
  optional: jest.fn(() => mockZod),
  describe: jest.fn(() => mockZod),
  _def: {
    shape: () => ({
      id: {},
      taskId: {},
      title: {},
      description: {},
      details: {},
      status: {},
      dependencies: {},
      file: {},
      skipGenerate: {},
      projectRoot: {},
      mode: {},
      subtask: {}
    })
  }
};

jest.mock('zod', () => ({
  z: mockZod
}));

// Fake implementation of registerAddSubtaskTool
const registerAddSubtaskTool = (server) => {
  const toolConfig = {
    name: 'add_subtask',
    description: 'Add a subtask to an existing task',
    parameters: mockZod,
    execute: (args, context) => {
      const { log, reportProgress, session } = context;
      try {
        log.info && log.info(`Starting add-subtask with args: ${JSON.stringify(args)}`);
        const rootFolder = mockGetProjectRootFromSession(session, log);
        const result = mockAddSubtaskDirect(
          {
            ...args,
            projectRoot: rootFolder
          },
          log,
          { reportProgress, session }
        );
        return mockHandleApiResult(result, log);
      } catch (error) {
        log.error && log.error(`Error in add-subtask tool: ${error.message}`);
        return mockCreateErrorResponse(error.message);
      }
    }
  };
  server.addTool(toolConfig);
};

describe('Agent-in-the-Loop: add_subtask', () => {
  let mockServer;
  let executeFunction;
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
  const mockContext = {
    log: mockLogger,
    reportProgress: jest.fn(),
    session: { workingDirectory: '/mock/dir' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockServer = {
      addTool: jest.fn((config) => {
        executeFunction = config.execute;
      })
    };
    mockAddSubtaskDirect.mockReturnValue({ success: true, data: { subtaskId: 1, message: 'ok' } });
    registerAddSubtaskTool(mockServer);
  });

  test('should return a prompt/context when called with mode: get_prompt', () => {
    const promptResponse = {
      success: true,
      data: { prompt: 'Generate a new subtask...' }
    };
    mockAddSubtaskDirect.mockReturnValueOnce(promptResponse);
    const args = { mode: 'get_prompt', id: '1', projectRoot: '/mock/project/root' };
    executeFunction(args, mockContext);
    expect(mockAddSubtaskDirect).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'get_prompt' }),
      mockLogger,
      expect.any(Object)
    );
    expect(mockHandleApiResult).toHaveBeenCalledWith(promptResponse, mockLogger);
  });

  test('should accept a valid agent-generated subtask with mode: submit_subtask', () => {
    const submitResponse = {
      success: true,
      data: { subtaskId: 2, message: 'Successfully added subtask' }
    };
    mockAddSubtaskDirect.mockReturnValueOnce(submitResponse);
    const validSubtask = {
      title: 'Agent Subtask',
      description: 'Agent-generated',
      details: 'Details',
      status: 'pending',
      dependencies: []
    };
    const args = { mode: 'submit_subtask', subtask: validSubtask, id: '1', projectRoot: '/mock/project/root' };
    executeFunction(args, mockContext);
    expect(mockAddSubtaskDirect).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'submit_subtask', subtask: validSubtask }),
      mockLogger,
      expect.any(Object)
    );
    expect(mockHandleApiResult).toHaveBeenCalledWith(submitResponse, mockLogger);
  });

  test('should return a validation error for invalid agent-generated subtask', () => {
    const errorResponse = {
      success: false,
      error: { code: 'INVALID_SUBTASK', message: 'Subtask validation failed.', details: ["'title' is required and must be a string."] }
    };
    mockAddSubtaskDirect.mockReturnValueOnce(errorResponse);
    const invalidSubtask = { description: 'Missing title' };
    const args = { mode: 'submit_subtask', subtask: invalidSubtask, id: '1', projectRoot: '/mock/project/root' };
    executeFunction(args, mockContext);
    expect(mockAddSubtaskDirect).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'submit_subtask', subtask: invalidSubtask }),
      mockLogger,
      expect.any(Object)
    );
    expect(mockHandleApiResult).toHaveBeenCalledWith(errorResponse, mockLogger);
  });

  test('should still work in non-agent mode', () => {
    const normalResponse = {
      success: true,
      data: { subtaskId: 3, message: 'Successfully added subtask' }
    };
    mockAddSubtaskDirect.mockReturnValueOnce(normalResponse);
    const args = { id: '1', title: 'Normal subtask', projectRoot: '/mock/project/root' };
    executeFunction(args, mockContext);
    expect(mockAddSubtaskDirect).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', title: 'Normal subtask' }),
      mockLogger,
      expect.any(Object)
    );
    expect(mockHandleApiResult).toHaveBeenCalledWith(normalResponse, mockLogger);
  });
}); 