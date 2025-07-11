import express from 'express';
import { createLogger } from '../utils/logger.js';

const router = express.Router();
const logger = createLogger('mcp-router');

/**
 * MCP工具列表 - 与mcp-remote/server.js保持一致
 */
function getToolsList(projectId = 'default') {
  return {
    tools: [
      // Group 1: 初始化与设置工具
      {
        name: 'initialize-project',
        description: `Initialize a new TaskMaster project in ${projectId}`,
        inputSchema: {
          type: 'object',
          properties: {
            force: {
              type: 'boolean',
              description: 'Force initialization even if project already exists',
              default: false,
            },
          },
        },
      },
      {
        name: 'models',
        description: 'List available AI models and their configurations',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'rules',
        description: 'Get TaskMaster rules and guidelines',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'parse-prd',
        description: `Parse PRD document and generate tasks for project ${projectId}. Automatically finds PRD document in project docs directory.`,
        inputSchema: {
          type: 'object',
          properties: {
            prdContent: {
              type: 'string',
              description: 'PRD content to parse (optional, if not provided will auto-find PRD document)',
            },
            numTasks: {
              type: 'number',
              description: 'Number of tasks to generate',
              default: 10,
            },
            force: {
              type: 'boolean',
              description: 'Overwrite existing tasks without prompting',
              default: false,
            },
            research: {
              type: 'boolean',
              description: 'Use research capabilities for task generation',
              default: false,
            },
          },
          required: [],
        },
      },

      // Group 2: 任务分析与扩展工具
      {
        name: 'analyze',
        description: `Analyze project complexity for ${projectId}`,
        inputSchema: {
          type: 'object',
          properties: {
            detailed: {
              type: 'boolean',
              description: 'Generate detailed complexity analysis',
              default: false,
            },
          },
        },
      },
      {
        name: 'expand-task',
        description: `Expand a specific task with subtasks in ${projectId}`,
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'number',
              description: 'Task ID to expand',
            },
            numSubtasks: {
              type: 'number',
              description: 'Number of subtasks to generate',
              default: 5,
            },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'expand-all',
        description: `Expand all tasks with subtasks in ${projectId}`,
        inputSchema: {
          type: 'object',
          properties: {
            maxSubtasks: {
              type: 'number',
              description: 'Maximum subtasks per task',
              default: 5,
            },
          },
        },
      },

      // Group 3: 任务列表与查看工具
      {
        name: 'get-tasks',
        description: `Get all tasks in project ${projectId}`,
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Filter tasks by status',
            },
            withSubtasks: {
              type: 'boolean',
              description: 'Include subtasks in the response',
              default: false,
            },
          },
        },
      },
      {
        name: 'get-task',
        description: `Get detailed information about a specific task in ${projectId}`,
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'number',
              description: 'Task ID to get',
            },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'next-task',
        description: `Get the next task to work on in ${projectId}`,
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Filter by task status',
              default: 'pending',
            },
          },
        },
      },
      {
        name: 'complexity-report',
        description: `Generate complexity report for ${projectId}`,
        inputSchema: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['json', 'markdown'],
              description: 'Report format',
              default: 'json',
            },
          },
        },
      },

      // Group 4: 任务状态与管理工具
      {
        name: 'set-task-status',
        description: `Set task status in ${projectId}`,
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'number',
              description: 'Task ID to update',
            },
            status: {
              type: 'string',
              enum: ['pending', 'in-progress', 'done', 'blocked', 'deferred'],
              description: 'New task status',
            },
          },
          required: ['taskId', 'status'],
        },
      },
      {
        name: 'generate',
        description: `Generate task files and documentation for ${projectId}`,
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'number',
              description: 'Task ID to generate files for',
            },
            type: {
              type: 'string',
              enum: ['code', 'docs', 'tests', 'all'],
              description: 'Type of files to generate',
              default: 'all',
            },
          },
          required: ['taskId'],
        },
      },

      // Group 5: 任务创建与修改工具
      {
        name: 'add-task',
        description: `Add a new task to project ${projectId}`,
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Description of the task to add (AI-generated)',
            },
            title: {
              type: 'string',
              description: 'Task title (manual creation)',
            },
            description: {
              type: 'string',
              description: 'Task description (manual creation)',
            },
            details: {
              type: 'string',
              description: 'Implementation details',
            },
            testStrategy: {
              type: 'string',
              description: 'Test strategy',
            },
            dependencies: {
              type: 'string',
              description: 'Comma-separated list of task IDs this task depends on',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Task priority',
              default: 'medium',
            },
            research: {
              type: 'boolean',
              description: 'Use research capabilities for task creation',
              default: false,
            },
          },
        },
      },
      {
        name: 'add-subtask',
        description: `Add a subtask to an existing task in ${projectId}`,
        inputSchema: {
          type: 'object',
          properties: {
            parentTaskId: {
              type: 'number',
              description: 'Parent task ID',
            },
            title: {
              type: 'string',
              description: 'Subtask title',
            },
            description: {
              type: 'string',
              description: 'Subtask description',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'Subtask priority',
              default: 'medium',
            },
          },
          required: ['parentTaskId', 'title', 'description'],
        },
      },
      {
        name: 'update-task',
        description: `Update a task in project ${projectId}`,
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'number',
              description: 'Task ID to update',
            },
            title: {
              type: 'string',
              description: 'New task title',
            },
            description: {
              type: 'string',
              description: 'New task description',
            },
            status: {
              type: 'string',
              description: 'New task status',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'New task priority',
            },
            details: {
              type: 'string',
              description: 'New implementation details',
            },
          },
          required: ['taskId'],
        },
      },
    ],
  };
}

/**
 * 验证Origin头部以防止DNS重绑定攻击
 */
function validateOrigin(req) {
  const origin = req.headers.origin;

  // 如果没有Origin头部，允许（可能是直接的HTTP请求）
  if (!origin) {
    return true;
  }

  // 允许的Origin模式
  const allowedOrigins = [
    'http://localhost',
    'http://127.0.0.1',
    'https://localhost',
    'https://127.0.0.1'
  ];

  // 检查Origin是否在允许列表中
  return allowedOrigins.some(allowed => origin.startsWith(allowed));
}

/**
 * MCP认证中间件 - 严格验证项目名称，记录用户信息，增强安全性
 * 支持多种方式传递项目信息：URL参数、HTTP头部、查询参数
 */
function authenticateMcpRequest(req, res, next) {
  // 优先级：URL参数 > HTTP头部 > 查询参数
  const projectId = req.params.project || req.headers['x-project'] || req.query.project;
  const username = req.params.username || req.headers['x-username'] || req.query.username;
  const password = req.params.password || req.headers['x-password'] || req.query.password;

  // 验证Origin头部
  if (!validateOrigin(req)) {
    logger.warn('MCP request rejected: invalid origin', {
      origin: req.headers.origin,
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path
    });

    return res.status(403).json({
      jsonrpc: "2.0",
      id: req.body?.id || 1,
      error: {
        code: -32603,
        message: 'Invalid origin. Only localhost connections are allowed.'
      }
    });
  }

  // 开发模式下打印header参数
  if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
    console.log('🔍 [MCP Auth] 项目验证检查:');
    console.log(`  📁 X-PROJECT: ${projectId || '(未设置)'}`);
    console.log(`  👤 X-USERNAME: ${username || '(未设置)'}`);
    console.log(`  🔐 X-PASSWORD: ${password ? '***' : '(未设置)'}`);
    console.log(`  🌐 User-Agent: ${req.headers['user-agent'] || '(未设置)'}`);
    console.log(`  🌍 Origin: ${req.headers.origin || '(未设置)'}`);
    console.log(`  📍 请求路径: ${req.method} ${req.path}`);
    console.log('');
  }

  // 项目ID是必需的，不允许默认值
  if (!projectId) {
    logger.warn('MCP request rejected: missing project ID', {
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path
    });

    return res.status(400).json({
      jsonrpc: "2.0",
      id: req.body?.id || 1,
      error: {
        code: -32602,
        message: 'X-PROJECT header is required. Please specify a valid project name.'
      }
    });
  }

  // 验证项目是否存在
  const projectManager = req.projectManager;
  if (!projectManager.projectExists(projectId)) {
    logger.warn('MCP request rejected: project not found', {
      projectId,
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path
    });

    return res.status(404).json({
      jsonrpc: "2.0",
      id: req.body?.id || 1,
      error: {
        code: -32602,
        message: `Project '${projectId}' not found. Please check the project name or create the project first.`
      }
    });
  }

  // 将项目信息附加到请求对象
  req.projectId = projectId;
  req.username = username || 'anonymous';

  // 记录成功的访问日志
  logger.info('MCP request authenticated', {
    projectId,
    username: req.username,
    userAgent: req.headers['user-agent'],
    origin: req.headers.origin,
    method: req.method,
    path: req.path
  });

  next();
}

/**
 * MCP协议检测 - 严格符合官方标准
 * 官方支持的协议：stdio, SSE, Streamable HTTP
 * 我们作为HTTP服务器支持：SSE, Streamable HTTP
 */
function detectProtocol(req) {
  const method = req.method;
  const accept = req.headers['accept'] || '';

  if (method === 'GET' && accept.includes('text/event-stream')) {
    // SSE: 服务器发起的事件流（可选功能）
    return 'SSE';
  } else if (method === 'POST') {
    // Streamable HTTP: 官方推荐的HTTP传输协议
    // 可以返回 application/json 或 text/event-stream
    return 'STREAMABLE_HTTP';
  } else {
    return 'UNKNOWN';
  }
}

/**
 * 生成会话ID
 */
function generateSessionId() {
  return 'mcp-session-' + Math.random().toString(36).substring(2, 18) + '-' + Date.now();
}

/**
 * SSE连接处理器
 */
async function handleSSEConnection(req, res) {
  // 生成会话ID
  const sessionId = generateSessionId();

  // 设置SSE响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control, X-PROJECT, X-USERNAME, X-PASSWORD',
    'Mcp-Session-Id': sessionId
  });

  // 发送初始连接确认
  res.write('event: connected\n');
  res.write(`data: {"status": "connected", "server": "taskmaster-remote", "protocol": "SSE", "sessionId": "${sessionId}"}\n\n`);

  // 发送服务器信息
  const serverInfo = {
    name: "taskmaster-remote",
    version: "1.0.0",
    project: req.projectId,
    capabilities: ["tools", "logging", "resources", "prompts"],
    protocols: ["SSE", "STREAMABLE_HTTP"],
    sessionId: sessionId,
    timestamp: new Date().toISOString()
  };
  res.write(`event: server-info\n`);
  res.write(`data: ${JSON.stringify(serverInfo)}\n\n`);

  // 发送可用工具列表
  const toolsInfo = {
    tools: [
      "add-task", "update-task", "delete-task", "get-task", "list-tasks",
      "add-project", "get-project", "list-projects", "delete-project",
      "get-config", "update-config", "backup-project", "restore-project",
      // PRD范围管理工具（远程服务专用）
      "analyze-prd-scope", "check-task-scope", "list-change-requests",
      "create-change-request", "update-change-request-status", "get-scope-health",
      "auto-associate-tasks", "get-requirements-baseline"
    ],
    count: 21,
    project: req.projectId
  };
  res.write(`event: tools-available\n`);
  res.write(`data: ${JSON.stringify(toolsInfo)}\n\n`);

  // 保持连接活跃（每30秒发送心跳）
  const heartbeat = setInterval(() => {
    try {
      res.write('event: heartbeat\n');
      res.write(`data: {"timestamp": "${new Date().toISOString()}", "sessionId": "${sessionId}"}\n\n`);
    } catch (error) {
      clearInterval(heartbeat);
      logger.warn('Heartbeat failed, connection likely closed', {
        sessionId,
        error: error.message
      });
    }
  }, 30000);

  // 处理客户端断开连接
  req.on('close', () => {
    clearInterval(heartbeat);
    logger.info('SSE connection closed', {
      projectId: req.projectId,
      username: req.username,
      sessionId
    });
  });

  // 处理连接错误
  req.on('error', (error) => {
    clearInterval(heartbeat);
    logger.error('SSE connection error', {
      projectId: req.projectId,
      username: req.username,
      sessionId,
      error: error.message
    });
  });

  // 处理响应错误
  res.on('error', (error) => {
    clearInterval(heartbeat);
    logger.error('SSE response error', {
      projectId: req.projectId,
      username: req.username,
      sessionId,
      error: error.message
    });
  });

  req.on('error', (error) => {
    clearInterval(heartbeat);
    logger.error('SSE connection error', {
      projectId: req.projectId,
      username: req.username,
      sessionId,
      error: error.message
    });
  });

  logger.info('SSE connection established', {
    projectId: req.projectId,
    username: req.username,
    userAgent: req.headers['user-agent'],
    sessionId
  });
}

/**
 * 处理MCP GET请求 (SSE协议)
 */
router.get('/', authenticateMcpRequest, async (req, res) => {
  const protocol = detectProtocol(req);

  // 开发模式下打印协议信息
  if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
    console.log('🔍 [MCP GET] 协议检测:');
    console.log(`  📁 X-PROJECT: ${req.projectId || '(未设置)'}`);
    console.log(`  👤 X-USERNAME: ${req.username || '(未设置)'}`);
    console.log(`  🌐 User-Agent: ${req.headers['user-agent'] || '(未设置)'}`);
    console.log(`  📍 请求路径: ${req.method} ${req.path}`);
    console.log(`  🎯 Accept: ${req.headers['accept'] || '(未设置)'}`);
    console.log(`  🔧 协议类型: ${protocol}`);
    console.log('');
  }

  if (protocol === 'SSE') {
    await handleSSEConnection(req, res);
  } else {
    // 返回404，因为GET请求应该用于SSE
    res.status(404).json({
      jsonrpc: "2.0",
      error: {
        code: -32601,
        message: "Not found. Use POST for JSON-RPC requests or Accept: text/event-stream for SSE."
      }
    });
  }
});

/**
 * Streamable HTTP响应处理器 - 符合官方标准
 * 根据请求复杂度决定返回JSON还是SSE流
 */
async function handleStreamableHTTPResponse(req, res, mcpRequest, result) {
  const accept = req.headers['accept'] || '';
  const needsStreaming = shouldUseStreaming(mcpRequest, result);

  // 生成会话ID（如果是initialize请求）
  const sessionId = mcpRequest?.method === 'initialize' ? generateSessionId() : null;

  if (needsStreaming && accept.includes('text/event-stream')) {
    // 返回SSE流式响应
    await sendSSEResponse(req, res, mcpRequest, result, sessionId);
  } else {
    // 返回标准JSON响应
    await sendJSONResponse(req, res, mcpRequest, result, sessionId);
  }
}

/**
 * 判断是否需要流式响应
 */
function shouldUseStreaming(mcpRequest, result) {
  // 对于复杂操作或大量数据，使用流式响应
  const streamingMethods = ['tools/call', 'resources/read'];
  return streamingMethods.includes(mcpRequest?.method);
}

/**
 * 发送SSE流式响应
 */
async function sendSSEResponse(req, res, mcpRequest, result, sessionId) {
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-PROJECT, X-USERNAME, X-PASSWORD, Mcp-Session-Id'
  };

  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId;
  }

  res.writeHead(200, headers);

  // 发送JSON-RPC响应作为SSE事件
  const response = {
    jsonrpc: "2.0",
    id: mcpRequest?.id || 1,
    result: result
  };

  if (sessionId && result && typeof result === 'object') {
    result.sessionId = sessionId;
    result.timestamp = new Date().toISOString();
  }

  res.write(`data: ${JSON.stringify(response)}\n\n`);
  res.end();

  logger.info('SSE response sent', {
    method: mcpRequest?.method,
    projectId: req.projectId,
    username: req.username,
    sessionId
  });
}

/**
 * 发送标准JSON响应
 */
async function sendJSONResponse(req, res, mcpRequest, result, sessionId) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-PROJECT, X-USERNAME, X-PASSWORD, Mcp-Session-Id'
  };

  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId;
    // 在结果中也包含会话信息
    if (result && typeof result === 'object') {
      result.sessionId = sessionId;
      result.timestamp = new Date().toISOString();
    }
  }

  const response = {
    jsonrpc: "2.0",
    id: mcpRequest?.id || 1,
    result: result
  };

  res.set(headers);
  res.json(response);

  logger.info('JSON response sent', {
    method: mcpRequest?.method,
    projectId: req.projectId,
    username: req.username,
    sessionId
  });
}



/**
 * 验证JSON-RPC请求格式
 */
function validateJsonRpcRequest(request) {
  if (!request || typeof request !== 'object') {
    return { valid: false, error: 'Request must be a JSON object' };
  }

  if (request.jsonrpc !== '2.0') {
    return { valid: false, error: 'Invalid jsonrpc version. Must be "2.0"' };
  }

  if (!request.method || typeof request.method !== 'string') {
    return { valid: false, error: 'Missing or invalid method field' };
  }

  // 对于请求（非通知），必须有ID
  // 但为了兼容某些客户端（如Cursor），对initialize请求提供默认ID
  if (!request.method.startsWith('notifications/') && (request.id === undefined || request.id === null)) {
    if (request.method === 'initialize') {
      // 为initialize请求提供默认ID以兼容Cursor等客户端
      request.id = 1;
    } else {
      return { valid: false, error: 'Missing id field for JSON-RPC request' };
    }
  }

  return { valid: true };
}

/**
 * 处理MCP请求 (POST请求) - 支持多协议
 */
router.post('/', authenticateMcpRequest, async (req, res) => {
  try {
    const mcpRequest = req.body;
    const protocol = detectProtocol(req);

    // 验证JSON-RPC请求格式
    const validation = validateJsonRpcRequest(mcpRequest);
    if (!validation.valid) {
      logger.warn('Invalid JSON-RPC request', {
        error: validation.error,
        projectId: req.projectId,
        username: req.username,
        requestBody: mcpRequest
      });

      return res.status(400).json({
        jsonrpc: "2.0",
        id: mcpRequest?.id || null,
        error: {
          code: -32600,
          message: `Invalid Request: ${validation.error}`
        }
      });
    }

    // 开发模式下打印详细信息
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      console.log(`🔍 [MCP POST] ${protocol}请求:`);
      console.log(`  📁 X-PROJECT: ${req.projectId || '(未设置)'}`);
      console.log(`  👤 X-USERNAME: ${req.username || '(未设置)'}`);
      console.log(`  🌐 User-Agent: ${req.headers['user-agent'] || '(未设置)'}`);
      console.log(`  🎯 Accept: ${req.headers['accept'] || '(未设置)'}`);
      console.log(`  🔖 MCP-Protocol-Version: ${req.headers['mcp-protocol-version'] || '(未设置)'}`);
      console.log(`  📝 Method: ${mcpRequest?.method || '(未设置)'}`);
      console.log(`  🆔 ID: ${mcpRequest?.id || '(未设置)'}`);
      console.log(`  🔧 协议类型: ${protocol}`);
      console.log('');
    }

    logger.info('MCP request received', {
      method: mcpRequest.method,
      projectId: req.projectId,
      username: req.username,
      requestId: req.requestId
    });

    let result;

    if (mcpRequest.method === 'initialize') {
      // MCP初始化请求 - 支持协议版本协商
      const clientVersion = mcpRequest.params?.protocolVersion;
      const supportedVersions = ["2024-11-05", "2025-03-26"];

      // 选择客户端支持的最新版本，如果不支持则使用我们的最新版本
      const negotiatedVersion = supportedVersions.includes(clientVersion)
        ? clientVersion
        : supportedVersions[supportedVersions.length - 1];

      result = {
        protocolVersion: negotiatedVersion,
        capabilities: {
          logging: {},
          tools: {
            listChanged: true
          },
          resources: {
            subscribe: false,
            listChanged: false
          },
          prompts: {
            listChanged: false
          },
          completions: {}
        },
        serverInfo: {
          name: "taskmaster-remote",
          version: "1.0.0"
        },
        instructions: `TaskMaster Remote MCP Server for project: ${req.projectId}. Provides task management tools for AI-driven project development.`
      };
    } else if (mcpRequest.method === 'notifications/initialized') {
      // MCP初始化完成通知 - 这是一个通知，不需要响应
      logger.info('MCP client initialized', {
        projectId: req.projectId,
        username: req.username,
        requestId: req.requestId
      });

      // 对于通知，我们不返回result，直接返回空响应
      res.status(200).end();
      return;
    } else if (mcpRequest.method === 'tools/list') {
      result = getToolsList(req.projectId);
    } else if (mcpRequest.method === 'tools/call') {
      // 这里需要实现工具调用逻辑
      // 暂时返回一个占位符响应
      result = {
        content: [
          {
            type: 'text',
            text: `Tool call not yet implemented: ${mcpRequest.params?.name || 'unknown'}`
          }
        ]
      };
    } else {
      throw new Error(`Unsupported method: ${mcpRequest.method}`);
    }

    // 使用Streamable HTTP协议发送响应
    await handleStreamableHTTPResponse(req, res, mcpRequest, result);

    // 开发模式下打印响应
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      console.log(`🚀 [MCP POST] 发送${protocol}响应完成`);
      console.log('');
    }
  } catch (error) {
    logger.error('MCP request error', {
      error: error.message,
      projectId: req.projectId,
      requestId: req.requestId
    });

    // 构建符合JSON-RPC标准的错误响应
    const errorResponse = {
      jsonrpc: "2.0",
      id: req.body?.id || 1,
      error: {
        code: -32603,
        message: error.message
      }
    };
    res.status(500).json(errorResponse);
  }
});

// 支持URL参数格式的路由
// /mcp/project/username/password
router.get('/:project/:username/:password?', authenticateMcpRequest, async (req, res) => {
  const protocol = detectProtocol(req);

  // 开发模式下打印协议信息
  if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
    console.log('🔍 [MCP GET] URL参数协议检测:');
    console.log(`  📁 项目: ${req.projectId || '(未设置)'}`);
    console.log(`  👤 用户: ${req.username || '(未设置)'}`);
    console.log(`  🌐 User-Agent: ${req.headers['user-agent'] || '(未设置)'}`);
    console.log(`  📍 请求路径: ${req.method} ${req.path}`);
    console.log(`  🎯 Accept: ${req.headers['accept'] || '(未设置)'}`);
    console.log(`  🔧 协议类型: ${protocol}`);
    console.log('');
  }

  if (protocol === 'SSE') {
    await handleSSEConnection(req, res);
  } else {
    res.status(400).json({
      jsonrpc: "2.0",
      id: 1,
      error: {
        code: -32600,
        message: 'GET requests only support SSE protocol. Use POST for JSON-RPC requests.'
      }
    });
  }
});

router.post('/:project/:username/:password?', authenticateMcpRequest, async (req, res) => {
  try {
    const mcpRequest = req.body;
    const protocol = detectProtocol(req);

    // 开发模式下打印详细信息
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      console.log(`🔍 [MCP POST] URL参数${protocol}请求:`);
      console.log(`  📁 项目: ${req.projectId || '(未设置)'}`);
      console.log(`  👤 用户: ${req.username || '(未设置)'}`);
      console.log(`  🌐 User-Agent: ${req.headers['user-agent'] || '(未设置)'}`);
      console.log(`  🎯 Accept: ${req.headers['accept'] || '(未设置)'}`);
      console.log(`  🔖 MCP-Protocol-Version: ${req.headers['mcp-protocol-version'] || '(未设置)'}`);
      console.log(`  📝 Method: ${mcpRequest?.method || '(未设置)'}`);
      console.log(`  🆔 ID: ${mcpRequest?.id || '(未设置)'}`);
      console.log(`  🔧 协议类型: ${protocol}`);
      console.log('');
    }

    logger.info('MCP request received via URL params', {
      method: mcpRequest.method,
      projectId: req.projectId,
      username: req.username,
      requestId: req.requestId
    });

    let result;

    if (mcpRequest.method === 'initialize') {
      // MCP初始化请求 - 支持协议版本协商
      const clientVersion = mcpRequest.params?.protocolVersion;
      const supportedVersions = ["2024-11-05", "2025-03-26"];

      // 选择客户端支持的最新版本，如果不支持则使用我们的最新版本
      const negotiatedVersion = supportedVersions.includes(clientVersion)
        ? clientVersion
        : supportedVersions[supportedVersions.length - 1];

      result = {
        protocolVersion: negotiatedVersion,
        capabilities: {
          logging: {},
          tools: {
            listChanged: true
          },
          resources: {
            subscribe: false,
            listChanged: false
          },
          prompts: {
            listChanged: false
          },
          completions: {}
        },
        serverInfo: {
          name: "taskmaster-remote",
          version: "1.0.0"
        },
        instructions: `TaskMaster Remote MCP Server for project: ${req.projectId}. Provides task management tools for AI-driven project development.`
      };
    } else if (mcpRequest.method === 'notifications/initialized') {
      // MCP初始化完成通知 - 这是一个通知，不需要响应
      logger.info('MCP client initialized via URL params', {
        projectId: req.projectId,
        username: req.username,
        requestId: req.requestId
      });

      // 对于通知，我们不返回result，直接返回空响应
      res.status(200).end();
      return;
    } else if (mcpRequest.method === 'tools/list') {
      result = getToolsList(req.projectId);
    } else if (mcpRequest.method === 'tools/call') {
      // 这里需要实现工具调用逻辑
      // 暂时返回一个占位符响应
      result = {
        content: [
          {
            type: "text",
            text: "Tool call functionality is not yet implemented. This is a placeholder response."
          }
        ]
      };
    } else {
      // 未知方法
      throw new Error(`Unknown method: ${mcpRequest.method}`);
    }

    // 使用Streamable HTTP协议发送响应
    await handleStreamableHTTPResponse(req, res, mcpRequest, result);

    // 开发模式下打印成功信息
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      console.log('✅ [MCP] URL参数请求处理成功');
      console.log('');
    }
  } catch (error) {
    logger.error('MCP request error via URL params', {
      error: error.message,
      projectId: req.projectId,
      requestId: req.requestId
    });

    // 构建符合JSON-RPC标准的错误响应
    const errorResponse = {
      jsonrpc: "2.0",
      id: req.body?.id || 1,
      error: {
        code: -32603,
        message: error.message
      }
    };
    res.status(500).json(errorResponse);
  }
});

// 支持简化URL格式的路由
// /mcp/project
router.get('/:project', authenticateMcpRequest, async (req, res) => {
  const protocol = detectProtocol(req);

  if (protocol === 'SSE') {
    await handleSSEConnection(req, res);
  } else {
    res.status(400).json({
      jsonrpc: "2.0",
      id: 1,
      error: {
        code: -32600,
        message: 'GET requests only support SSE protocol. Use POST for JSON-RPC requests.'
      }
    });
  }
});

router.post('/:project', authenticateMcpRequest, async (req, res) => {
  try {
    const mcpRequest = req.body;
    const protocol = detectProtocol(req);

    logger.info('MCP request received via project URL', {
      method: mcpRequest.method,
      projectId: req.projectId,
      username: req.username,
      requestId: req.requestId
    });

    let result;

    if (mcpRequest.method === 'initialize') {
      const clientVersion = mcpRequest.params?.protocolVersion;
      const supportedVersions = ["2024-11-05", "2025-03-26"];
      const negotiatedVersion = supportedVersions.includes(clientVersion)
        ? clientVersion
        : supportedVersions[supportedVersions.length - 1];

      result = {
        protocolVersion: negotiatedVersion,
        capabilities: {
          logging: {},
          tools: { listChanged: true },
          resources: { subscribe: false, listChanged: false },
          prompts: { listChanged: false },
          completions: {}
        },
        serverInfo: {
          name: "taskmaster-remote",
          version: "1.0.0"
        },
        instructions: `TaskMaster Remote MCP Server for project: ${req.projectId}. Provides task management tools for AI-driven project development.`
      };
    } else if (mcpRequest.method === 'notifications/initialized') {
      logger.info('MCP client initialized via project URL', {
        projectId: req.projectId,
        username: req.username,
        requestId: req.requestId
      });
      res.status(200).end();
      return;
    } else if (mcpRequest.method === 'tools/list') {
      result = getToolsList(req.projectId);
    } else if (mcpRequest.method === 'tools/call') {
      result = {
        content: [
          {
            type: "text",
            text: "Tool call functionality is not yet implemented. This is a placeholder response."
          }
        ]
      };
    } else {
      throw new Error(`Unknown method: ${mcpRequest.method}`);
    }

    // 使用Streamable HTTP协议发送响应
    await handleStreamableHTTPResponse(req, res, mcpRequest, result);
  } catch (error) {
    logger.error('MCP request error via project URL', {
      error: error.message,
      projectId: req.projectId,
      requestId: req.requestId
    });

    const errorResponse = {
      jsonrpc: "2.0",
      id: req.body?.id || 1,
      error: {
        code: -32603,
        message: error.message
      }
    };
    res.status(500).json(errorResponse);
  }
});

export default router;
