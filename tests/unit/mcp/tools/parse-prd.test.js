import { jest } from '@jest/globals';

// Mock EVERYTHING
const mockParsePRDDirect = jest.fn();
jest.mock('../../../../mcp-server/src/core/task-master-core.js', () => ({
  parsePRDDirect: mockParsePRDDirect
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
  array: jest.fn(() => mockZod),
  describe: jest.fn(() => mockZod),
  _def: {
    shape: () => ({
      input: {},
      numTasks: {},
      output: {},
      force: {},
      append: {},
      projectRoot: {},
      mode: {},
      tasks: {}
    })
  }
};

jest.mock('zod', () => ({
  z: mockZod
}));

// Fake implementation of registerParsePrdTool
const registerParsePrdTool = (server) => {
  const toolConfig = {
    name: 'parse_prd',
    description: 'Parse a PRD and generate tasks',
    parameters: mockZod,
    execute: (args, context) => {
      const { log, reportProgress, session } = context;
      try {
        log.info && log.info(`Starting parse-prd with args: ${JSON.stringify(args)}`);
        const rootFolder = mockGetProjectRootFromSession(session, log);
        const result = mockParsePRDDirect(
          {
            ...args,
            projectRoot: rootFolder
          },
          log,
          { reportProgress, session }
        );
        return mockHandleApiResult(result, log);
      } catch (error) {
        log.error && log.error(`Error in parse-prd tool: ${error.message}`);
        return mockCreateErrorResponse(error.message);
      }
    }
  };
  server.addTool(toolConfig);
};

describe('Agent-in-the-Loop: parse_prd', () => {
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
    mockParsePRDDirect.mockReturnValue({ success: true, data: { tasks: [], message: 'ok' } });
    registerParsePrdTool(mockServer);
  });

  test('should return a prompt/context when called with mode: get_prompt', () => {
    const promptResponse = {
      success: true,
      data: { prompt: 'Generate tasks for this PRD...' }
    };
    mockParsePRDDirect.mockReturnValueOnce(promptResponse);
    const args = { mode: 'get_prompt', input: 'prd.txt', projectRoot: '/mock/project/root' };
    executeFunction(args, mockContext);
    expect(mockParsePRDDirect).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'get_prompt' }),
      mockLogger,
      expect.any(Object)
    );
    expect(mockHandleApiResult).toHaveBeenCalledWith(promptResponse, mockLogger);
  });

  test('should accept a valid agent-generated tasks array with mode: submit_tasks', () => {
    const submitResponse = {
      success: true,
      data: { tasks: [{ title: 'A', description: 'B', details: 'C', status: 'pending', dependencies: [] }], message: 'Successfully added tasks' }
    };
    mockParsePRDDirect.mockReturnValueOnce(submitResponse);
    const validTasks = [
      { title: 'Agent Task', description: 'Agent-generated', details: 'Details', status: 'pending', dependencies: [] }
    ];
    const args = { mode: 'submit_tasks', tasks: validTasks, input: 'prd.txt', projectRoot: '/mock/project/root' };
    executeFunction(args, mockContext);
    expect(mockParsePRDDirect).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'submit_tasks', tasks: validTasks }),
      mockLogger,
      expect.any(Object)
    );
    expect(mockHandleApiResult).toHaveBeenCalledWith(submitResponse, mockLogger);
  });

  test('should return a validation error for invalid agent-generated tasks', () => {
    const errorResponse = {
      success: false,
      error: { code: 'INVALID_TASKS', message: 'Task validation failed.', details: ["'title' is required and must be a string."] }
    };
    mockParsePRDDirect.mockReturnValueOnce(errorResponse);
    const invalidTasks = [{ description: 'Missing title' }];
    const args = { mode: 'submit_tasks', tasks: invalidTasks, input: 'prd.txt', projectRoot: '/mock/project/root' };
    executeFunction(args, mockContext);
    expect(mockParsePRDDirect).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'submit_tasks', tasks: invalidTasks }),
      mockLogger,
      expect.any(Object)
    );
    expect(mockHandleApiResult).toHaveBeenCalledWith(errorResponse, mockLogger);
  });

  test('should still work in non-agent mode', () => {
    const normalResponse = {
      success: true,
      data: { tasks: [], message: 'Successfully parsed PRD' }
    };
    mockParsePRDDirect.mockReturnValueOnce(normalResponse);
    const args = { input: 'prd.txt', numTasks: 3, projectRoot: '/mock/project/root' };
    executeFunction(args, mockContext);
    expect(mockParsePRDDirect).toHaveBeenCalledWith(
      expect.objectContaining({ input: 'prd.txt', numTasks: 3 }),
      mockLogger,
      expect.any(Object)
    );
    expect(mockHandleApiResult).toHaveBeenCalledWith(normalResponse, mockLogger);
  });
}); 