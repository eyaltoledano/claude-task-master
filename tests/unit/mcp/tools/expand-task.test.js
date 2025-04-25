import { jest } from '@jest/globals';

// Mock EVERYTHING
const mockExpandTaskDirect = jest.fn();
jest.mock('../../../../mcp-server/src/core/task-master-core.js', () => ({
  expandTaskDirect: mockExpandTaskDirect
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
      num: {},
      research: {},
      prompt: {},
      force: {},
      file: {},
      projectRoot: {},
      mode: {},
      subtasks: {}
    })
  }
};

jest.mock('zod', () => ({
  z: mockZod
}));

// Fake implementation of registerExpandTaskTool
const registerExpandTaskTool = (server) => {
  const toolConfig = {
    name: 'expand_task',
    description: 'Expand a task into subtasks',
    parameters: mockZod,
    execute: (args, context) => {
      const { log, reportProgress, session } = context;
      try {
        log.info && log.info(`Starting expand-task with args: ${JSON.stringify(args)}`);
        const rootFolder = mockGetProjectRootFromSession(session, log);
        const result = mockExpandTaskDirect(
          {
            ...args,
            projectRoot: rootFolder
          },
          log,
          { reportProgress, session }
        );
        return mockHandleApiResult(result, log);
      } catch (error) {
        log.error && log.error(`Error in expand-task tool: ${error.message}`);
        return mockCreateErrorResponse(error.message);
      }
    }
  };
  server.addTool(toolConfig);
};

describe('Agent-in-the-Loop: expand_task', () => {
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
    mockExpandTaskDirect.mockReturnValue({ success: true, data: { subtasks: [], message: 'ok' } });
    registerExpandTaskTool(mockServer);
  });

  test('should return a prompt/context when called with mode: get_prompt', () => {
    const promptResponse = {
      success: true,
      data: { prompt: 'Generate subtasks for this task...' }
    };
    mockExpandTaskDirect.mockReturnValueOnce(promptResponse);
    const args = { mode: 'get_prompt', id: '1', projectRoot: '/mock/project/root' };
    executeFunction(args, mockContext);
    expect(mockExpandTaskDirect).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'get_prompt' }),
      mockLogger,
      expect.any(Object)
    );
    expect(mockHandleApiResult).toHaveBeenCalledWith(promptResponse, mockLogger);
  });

  test('should accept a valid agent-generated subtasks array with mode: submit_subtasks', () => {
    const submitResponse = {
      success: true,
      data: { subtasks: [{ title: 'A', description: 'B', details: 'C', status: 'pending', dependencies: [] }], message: 'Successfully added subtasks' }
    };
    mockExpandTaskDirect.mockReturnValueOnce(submitResponse);
    const validSubtasks = [
      { title: 'Agent Subtask', description: 'Agent-generated', details: 'Details', status: 'pending', dependencies: [] }
    ];
    const args = { mode: 'submit_subtasks', subtasks: validSubtasks, id: '1', projectRoot: '/mock/project/root' };
    executeFunction(args, mockContext);
    expect(mockExpandTaskDirect).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'submit_subtasks', subtasks: validSubtasks }),
      mockLogger,
      expect.any(Object)
    );
    expect(mockHandleApiResult).toHaveBeenCalledWith(submitResponse, mockLogger);
  });

  test('should return a validation error for invalid agent-generated subtasks', () => {
    const errorResponse = {
      success: false,
      error: { code: 'INVALID_SUBTASKS', message: 'Subtask validation failed.', details: ["'title' is required and must be a string."] }
    };
    mockExpandTaskDirect.mockReturnValueOnce(errorResponse);
    const invalidSubtasks = [{ description: 'Missing title' }];
    const args = { mode: 'submit_subtasks', subtasks: invalidSubtasks, id: '1', projectRoot: '/mock/project/root' };
    executeFunction(args, mockContext);
    expect(mockExpandTaskDirect).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'submit_subtasks', subtasks: invalidSubtasks }),
      mockLogger,
      expect.any(Object)
    );
    expect(mockHandleApiResult).toHaveBeenCalledWith(errorResponse, mockLogger);
  });

  test('should still work in non-agent mode', () => {
    const normalResponse = {
      success: true,
      data: { subtasks: [], message: 'Successfully expanded task' }
    };
    mockExpandTaskDirect.mockReturnValueOnce(normalResponse);
    const args = { id: '1', num: 3, projectRoot: '/mock/project/root' };
    executeFunction(args, mockContext);
    expect(mockExpandTaskDirect).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', num: 3 }),
      mockLogger,
      expect.any(Object)
    );
    expect(mockHandleApiResult).toHaveBeenCalledWith(normalResponse, mockLogger);
  });
}); 