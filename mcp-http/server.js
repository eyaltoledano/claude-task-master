#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import ScopeManagementMCPTools from '../express-api/mcp-tools/scope-management-tools.js';
// Using built-in fetch in Node.js 18+

class TaskMasterRemoteMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'taskmaster-remote',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // 从环境变量获取配置
    this.apiUrl = process.env.TASKMASTER_API_URL || 'http://localhost:3000';
    this.port = process.env.MCP_PORT || 3001;

    // 项目ID将从HTTP头中获取，不再从环境变量
    this.defaultProjectId = process.env.TASKMASTER_PROJECT_ID || 'default';

    // 初始化范围管理工具
    this.scopeTools = new ScopeManagementMCPTools();

    this.setupToolHandlers();
    this.setupHttpServer();
  }

  /**
   * 设置HTTP服务器
   */
  setupHttpServer() {
    this.app = express();

    // 中间件
    this.app.use(cors());
    this.app.use(express.json());

    // 认证中间件
    this.app.use('/mcp', this.authenticateRequest.bind(this));

    // MCP端点
    this.app.post('/mcp', (req, res, next) => {
      // 设置必要的HTTP头
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'close');
      next();
    }, this.handleMcpRequest.bind(this));

    // 健康检查
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  /**
   * 认证请求
   */
  authenticateRequest(req, res, next) {
    const projectId = req.headers['x-project'];
    const username = req.headers['x-username'];
    const password = req.headers['x-password'];

    // 开发模式下打印header参数
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      console.log('🔍 [MCP Remote] 接收到的请求头:');
      console.log(`  📁 X-PROJECT: ${projectId || '(未设置)'}`);
      console.log(`  👤 X-USERNAME: ${username || '(未设置)'}`);
      console.log(`  🔐 X-PASSWORD: ${password ? '***' : '(未设置)'}`);
      console.log(`  🌐 User-Agent: ${req.headers['user-agent'] || '(未设置)'}`);
      console.log(`  📍 请求路径: ${req.method} ${req.path}`);
      console.log('');
    }

    // 项目ID是必需的
    if (!projectId) {
      return res.status(400).json({ error: 'X-PROJECT header is required' });
    }

    // 用户名和密码在开发模式下是可选的
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (!isDevelopment && (!username || !password)) {
      return res.status(401).json({ error: 'X-USERNAME and X-PASSWORD headers are required in production mode' });
    }

    // 将项目信息附加到请求对象
    req.projectId = projectId;
    req.username = username || 'anonymous';

    next();
  }

  /**
   * 处理MCP请求
   */
  async handleMcpRequest(req, res) {
    try {
      const mcpRequest = req.body;

      // 详细的请求日志
      console.log(`\n=== MCP Request Details ===`);
      console.log(`Method: ${mcpRequest.method}`);
      console.log(`ID: ${mcpRequest.id}`);
      console.log(`Project: ${req.projectId}`);
      console.log(`Username: ${req.username}`);
      console.log(`JSONRPC Version: ${mcpRequest.jsonrpc}`);

      if (mcpRequest.params) {
        console.log(`Params:`, JSON.stringify(mcpRequest.params, null, 2));
        if (mcpRequest.params.protocolVersion) {
          console.log(`Client Protocol Version: ${mcpRequest.params.protocolVersion}`);
        }
        if (mcpRequest.params.clientInfo) {
          console.log(`Client Info:`, JSON.stringify(mcpRequest.params.clientInfo, null, 2));
        }
      }
      console.log(`Request Headers:`, JSON.stringify(req.headers, null, 2));
      console.log(`========================\n`);

      // 从请求中获取项目ID，确保在整个请求处理过程中使用正确的项目ID
      const requestProjectId = req.projectId;
      if (!requestProjectId) {
        return res.status(400).json({
          jsonrpc: "2.0",
          id: mcpRequest.id || 1,
          error: {
            code: -32602,
            message: "Project ID is required in X-PROJECT header"
          }
        });
      }

      let result;

      if (mcpRequest.method === 'initialize') {
        // MCP初始化请求 - 支持协议版本协商
        const clientVersion = mcpRequest.params?.protocolVersion;
        const supportedVersions = ["2024-11-05", "2025-03-26"];

        // 正确的协议协商：优先使用客户端版本，如果不支持则使用最新的我们支持的版本
        const negotiatedVersion = supportedVersions.includes(clientVersion)
          ? clientVersion
          : supportedVersions[supportedVersions.length - 1];

        console.log(`Protocol negotiation: Client requested ${clientVersion}, using ${negotiatedVersion}`);

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
          instructions: `TaskMaster Remote MCP Server for project: ${requestProjectId}. Provides task management tools for AI-driven project development.`
        };
      } else if (mcpRequest.method === 'notifications/initialized') {
        // MCP初始化完成通知 - 这是一个通知，不需要响应
        console.log(`MCP client initialized for project: ${requestProjectId}`);

        // 对于通知，我们不返回result，直接返回空响应
        res.status(200).end();
        return;
      } else if (mcpRequest.method === 'tools/list') {
        result = await this.getToolsList();
      } else if (mcpRequest.method === 'tools/call') {
        result = await this.handleToolCall(mcpRequest.params, requestProjectId);
      } else {
        throw new Error(`Unsupported method: ${mcpRequest.method}`);
      }

      // 构建符合JSON-RPC标准的响应 - 必须使用客户端的请求ID
      const response = {
        jsonrpc: "2.0",
        id: mcpRequest.id, // 严格使用客户端的ID，不能有默认值
        result: result
      };

      // 详细的响应日志
      console.log(`\n=== MCP Response Details ===`);
      console.log(`Method: ${mcpRequest.method}`);
      console.log(`Response ID: ${response.id}`);
      console.log(`Response Size: ${JSON.stringify(response).length} characters`);

      if (mcpRequest.method === 'initialize') {
        console.log(`Negotiated Protocol Version: ${response.result.protocolVersion}`);
        console.log(`Server Capabilities:`, JSON.stringify(response.result.capabilities, null, 2));
      } else if (mcpRequest.method === 'tools/list') {
        console.log(`Tools Count: ${response.result.tools?.length || 0}`);
      } else if (mcpRequest.method === 'tools/call') {
        console.log(`Tool Called: ${mcpRequest.params?.name}`);
        console.log(`Response Content Type: ${response.result.content?.[0]?.type}`);
      }
      console.log(`===========================\n`);

      res.json(response);
    } catch (error) {
      console.error(`\n=== MCP Error Details ===`);
      console.error(`Method: ${mcpRequest?.method}`);
      console.error(`Error:`, error);
      console.error(`Stack:`, error.stack);
      console.error(`========================\n`);

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
  }

  /**
   * 构建API URL - 根据端点类型进行正确的URL拼接
   */
  buildApiUrl(endpoint, projectId = null) {
    const targetProjectId = projectId || this.projectId || this.defaultProjectId;
    const projectEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

    // 项目级别的端点（需要项目ID在路径中）
    const projectLevelEndpoints = [
      'tasks', 'prd', 'files', 'analyze', 'reports', 'dependencies', 'tags', 'research',
      'operations', 'cache', 'update'
    ];

    // 检查是否是项目级别的端点
    const isProjectLevel = projectLevelEndpoints.some(prefix =>
      projectEndpoint.startsWith(prefix) || projectEndpoint.includes(`/${prefix}`)
    );

    if (isProjectLevel) {
      // 项目级别的端点：/api/projects/{projectId}/{endpoint}
      return `${this.apiUrl}/api/projects/${targetProjectId}/${projectEndpoint}`;
    } else {
      // 项目管理端点：/api/projects/{projectId}/{endpoint} 或 /api/projects/{endpoint}
      if (projectEndpoint === 'initialize') {
        return `${this.apiUrl}/api/projects/${targetProjectId}/initialize`;
      } else if (projectEndpoint === 'models' || projectEndpoint === 'rules') {
        // 全局端点，不需要项目ID
        return `${this.apiUrl}/api/${projectEndpoint}`;
      } else {
        // 其他项目管理端点
        return `${this.apiUrl}/api/projects/${targetProjectId}/${projectEndpoint}`;
      }
    }
  }

  /**
   * 调用远程API
   */
  async callApi(endpoint, options = {}, projectId = null) {
    const url = this.buildApiUrl(endpoint, projectId);

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
    }

    return await response.json();
  }

  /**
   * 获取工具列表（用于HTTP模式）
   */
  async getToolsList() {
    const projectId = this.projectId || this.defaultProjectId;
    return {
      tools: [
        // Group 1: 初始化与设置工具
        {
          name: 'initialize_project',
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
          name: 'parse_prd',
          description: `Parse PRD document from project ${projectId} and generate tasks. Automatically finds PRD document in project docs directory.`,
          inputSchema: {
            type: 'object',
            properties: {
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
          name: 'analyze_project_complexity',
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
          name: 'expand_task',
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
          name: 'expand_all',
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
          name: 'get_tasks',
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
          name: 'get_task',
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
          name: 'next_task',
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
          name: 'complexity_report',
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
          name: 'set_task_status',
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
          name: 'add_task',
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
          name: 'add_subtask',
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
          name: 'update_task',
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
        {
          name: 'update_subtask',
          description: `Update a subtask in project ${projectId}`,
          inputSchema: {
            type: 'object',
            properties: {
              taskId: {
                type: 'number',
                description: 'Parent task ID',
              },
              subtaskId: {
                type: 'number',
                description: 'Subtask ID to update',
              },
              title: {
                type: 'string',
                description: 'New subtask title',
              },
              description: {
                type: 'string',
                description: 'New subtask description',
              },
              status: {
                type: 'string',
                description: 'New subtask status',
              },
            },
            required: ['taskId', 'subtaskId'],
          },
        },
        {
          name: 'remove_task',
          description: `Remove a task from project ${projectId}`,
          inputSchema: {
            type: 'object',
            properties: {
              taskId: {
                type: 'number',
                description: 'Task ID to remove',
              },
              force: {
                type: 'boolean',
                description: 'Force removal without confirmation',
                default: false,
              },
            },
            required: ['taskId'],
          },
        },
        {
          name: 'remove_subtask',
          description: `Remove a subtask from project ${projectId}`,
          inputSchema: {
            type: 'object',
            properties: {
              taskId: {
                type: 'number',
                description: 'Parent task ID',
              },
              subtaskId: {
                type: 'number',
                description: 'Subtask ID to remove',
              },
            },
            required: ['taskId', 'subtaskId'],
          },
        },
        {
          name: 'clear_subtasks',
          description: `Clear all subtasks from a task in ${projectId}`,
          inputSchema: {
            type: 'object',
            properties: {
              taskId: {
                type: 'number',
                description: 'Task ID to clear subtasks from',
              },
            },
            required: ['taskId'],
          },
        },
        {
          name: 'move_task',
          description: `Move a task to a different position in ${projectId}`,
          inputSchema: {
            type: 'object',
            properties: {
              taskId: {
                type: 'number',
                description: 'Task ID to move',
              },
              newPosition: {
                type: 'number',
                description: 'New position (1-based index)',
              },
            },
            required: ['taskId', 'newPosition'],
          },
        },

        // Group 6: 依赖管理工具
        {
          name: 'add_dependency',
          description: `Add a dependency between tasks in ${projectId}`,
          inputSchema: {
            type: 'object',
            properties: {
              taskId: {
                type: 'number',
                description: 'Task ID that depends on another task',
              },
              dependsOnTaskId: {
                type: 'number',
                description: 'Task ID that this task depends on',
              },
            },
            required: ['taskId', 'dependsOnTaskId'],
          },
        },
        {
          name: 'remove_dependency',
          description: `Remove a dependency between tasks in ${projectId}`,
          inputSchema: {
            type: 'object',
            properties: {
              taskId: {
                type: 'number',
                description: 'Task ID to remove dependency from',
              },
              dependsOnTaskId: {
                type: 'number',
                description: 'Task ID to remove as dependency',
              },
            },
            required: ['taskId', 'dependsOnTaskId'],
          },
        },
        {
          name: 'validate_dependencies',
          description: `Validate task dependencies for circular references in ${projectId}`,
          inputSchema: {
            type: 'object',
            properties: {
              fix: {
                type: 'boolean',
                description: 'Automatically fix circular dependencies',
                default: false,
              },
            },
          },
        },
        {
          name: 'fix_dependencies',
          description: `Fix circular dependencies in ${projectId}`,
          inputSchema: {
            type: 'object',
            properties: {
              strategy: {
                type: 'string',
                enum: ['remove-oldest', 'remove-newest', 'interactive'],
                description: 'Strategy for fixing circular dependencies',
                default: 'remove-oldest',
              },
            },
          },
        },

        // Group 7: 标签管理工具
        {
          name: 'list_tags',
          description: `List all available tags in ${projectId}`,
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'add_tag',
          description: `Add a new tag in ${projectId}`,
          inputSchema: {
            type: 'object',
            properties: {
              tagName: {
                type: 'string',
                description: 'Name of the new tag',
              },
              description: {
                type: 'string',
                description: 'Tag description',
              },
            },
            required: ['tagName'],
          },
        },
        {
          name: 'delete_tag',
          description: `Delete a tag from ${projectId}`,
          inputSchema: {
            type: 'object',
            properties: {
              tagName: {
                type: 'string',
                description: 'Name of the tag to delete',
              },
              force: {
                type: 'boolean',
                description: 'Force deletion without confirmation',
                default: false,
              },
            },
            required: ['tagName'],
          },
        },
        {
          name: 'use_tag',
          description: `Switch to a specific tag in ${projectId}`,
          inputSchema: {
            type: 'object',
            properties: {
              tagName: {
                type: 'string',
                description: 'Name of the tag to switch to',
              },
            },
            required: ['tagName'],
          },
        },
        {
          name: 'rename_tag',
          description: `Rename a tag in ${projectId}`,
          inputSchema: {
            type: 'object',
            properties: {
              oldTagName: {
                type: 'string',
                description: 'Current tag name',
              },
              newTagName: {
                type: 'string',
                description: 'New tag name',
              },
            },
            required: ['oldTagName', 'newTagName'],
          },
        },
        {
          name: 'copy_tag',
          description: `Copy a tag to create a new tag in ${projectId}`,
          inputSchema: {
            type: 'object',
            properties: {
              sourceTagName: {
                type: 'string',
                description: 'Source tag name to copy from',
              },
              targetTagName: {
                type: 'string',
                description: 'Target tag name to copy to',
              },
            },
            required: ['sourceTagName', 'targetTagName'],
          },
        },

        // Group 8: 研究功能工具
        {
          name: 'research',
          description: `Perform research for task planning in ${projectId}`,
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Research query or topic',
              },
              scope: {
                type: 'string',
                enum: ['task', 'project', 'technology'],
                description: 'Research scope',
                default: 'task',
              },
            },
            required: ['query'],
          },
        },

        // 项目管理工具（新增）- 注释掉，原始版本没有
        // {
        //   name: 'switch_project',
        //   description: 'Switch to a different project',
        //   inputSchema: {
        //     type: 'object',
        //     properties: {
        //       projectId: {
        //         type: 'string',
        //         description: 'Project ID to switch to',
        //       },
        //     },
        //     required: ['projectId'],
        //   },
        // },

        // 操作状态工具
        {
          name: 'get_operation_status',
          description: 'Get the status of a background operation',
          inputSchema: {
            type: 'object',
            properties: {
              operationId: {
                type: 'string',
                description: 'The ID of the operation to check',
              },
            },
            required: ['operationId'],
          },
        },

        // 缓存统计工具 - 注释掉，原始版本没有
        // {
        //   name: 'cache_stats',
        //   description: 'Get cache statistics for monitoring performance',
        //   inputSchema: {
        //     type: 'object',
        //     properties: {},
        //   },
        // },

        // 通用更新工具 - 注释掉，原始版本没有
        // {
        //   name: 'update',
        //   description: 'Update multiple tasks or project settings',
        //   inputSchema: {
        //     type: 'object',
        //     properties: {
        //       tasks: {
        //         type: 'array',
        //         description: 'Array of task updates',
        //         items: {
        //           type: 'object',
        //           properties: {
        //             id: {
        //               type: 'number',
        //               description: 'Task ID',
        //             },
        //             title: {
        //               type: 'string',
        //               description: 'New task title',
        //             },
        //             description: {
        //               type: 'string',
        //               description: 'New task description',
        //             },
        //             status: {
        //               type: 'string',
        //               description: 'New task status',
        //             },
        //           },
        //           required: ['id'],
        //         },
        //       },
        //     },
        //   },
        // },

        // Group 8.5: IDE配置管理工具
        {
          name: 'get_ide_config_content',
          description: `Get IDE configuration file contents for client-side creation`,
          inputSchema: {
            type: 'object',
            properties: {
              ideType: {
                type: 'string',
                description: 'Specific IDE type to get (cursor, vscode, claude, github, idea, roo, trae, windsurf, clinerules). If not specified, gets all available IDE configs',
                enum: ['cursor', 'vscode', 'claude', 'github', 'idea', 'roo', 'trae', 'windsurf', 'clinerules']
              },
              format: {
                type: 'string',
                description: 'Output format: "content" for file contents, "script" for executable script',
                enum: ['content', 'script'],
                default: 'content'
              }
            }
          }
        },

        // Group 9: PRD范围管理工具（远程服务专用）
        ...this.scopeTools.getToolDefinitions()
      ],
    };
  }

  /**
   * 处理工具调用（用于HTTP模式）
   * @param {Object} params - 工具调用参数
   * @param {string} projectId - 项目ID
   */
  async handleToolCall(params, projectId) {
    const { name, arguments: args } = params;

    // 临时设置项目ID，确保所有API调用都使用正确的项目ID
    const originalProjectId = this.projectId;
    this.projectId = projectId;

    try {
      switch (name) {
        // Group 1: 初始化与设置工具
        case 'initialize_project':
          return await this.handleInitializeProject(args);
        case 'models':
          return await this.handleModels(args);
        case 'rules':
          return await this.handleRules(args);
        case 'parse_prd':
          return await this.handleParsePRD(args);

        // Group 2: 任务分析与扩展工具
        case 'analyze_project_complexity':
          return await this.handleAnalyze(args);
        case 'expand_task':
          return await this.handleExpandTask(args);
        case 'expand_all':
          return await this.handleExpandAll(args);

        // Group 3: 任务列表与查看工具
        case 'get_tasks':
          return await this.handleGetTasks(args);
        case 'get_task':
          return await this.handleGetTask(args);
        case 'next_task':
          return await this.handleNextTask(args);
        case 'complexity_report':
          return await this.handleComplexityReport(args);

        // Group 4: 任务状态与管理工具
        case 'set_task_status':
          return await this.handleSetTaskStatus(args);
        case 'generate':
          return await this.handleGenerate(args);

        // Group 5: 任务创建与修改工具
        case 'add_task':
          return await this.handleAddTask(args);
        case 'add_subtask':
          return await this.handleAddSubtask(args);
        case 'update_task':
          return await this.handleUpdateTask(args);
        case 'update_subtask':
          return await this.handleUpdateSubtask(args);
        case 'remove_task':
          return await this.handleRemoveTask(args);
        case 'remove_subtask':
          return await this.handleRemoveSubtask(args);
        case 'clear_subtasks':
          return await this.handleClearSubtasks(args);
        case 'move_task':
          return await this.handleMoveTask(args);

        // Group 6: 依赖管理工具
        case 'add_dependency':
          return await this.handleAddDependency(args);
        case 'remove_dependency':
          return await this.handleRemoveDependency(args);
        case 'validate_dependencies':
          return await this.handleValidateDependencies(args);
        case 'fix_dependencies':
          return await this.handleFixDependencies(args);

        // Group 7: 标签管理工具
        case 'list_tags':
          return await this.handleListTags(args);
        case 'add_tag':
          return await this.handleAddTag(args);
        case 'delete_tag':
          return await this.handleDeleteTag(args);
        case 'use_tag':
          return await this.handleUseTag(args);
        case 'rename_tag':
          return await this.handleRenameTag(args);
        case 'copy_tag':
          return await this.handleCopyTag(args);

        // Group 8: 研究功能工具
        case 'research':
          return await this.handleResearch(args);

        // Group 8.5: IDE配置管理工具
        case 'get_ide_config_content':
          return await this.handleGetIdeConfigContent(args);

        // 项目管理工具 - 注释掉，原始版本没有
        // case 'switch_project':
        //   return await this.handleSwitchProject(args);

        // 操作状态工具
        case 'get_operation_status':
          return await this.handleGetOperationStatus(args);

        // 缓存统计工具 - 注释掉，原始版本没有
        // case 'cache_stats':
        //   return await this.handleCacheStats(args);

        // 通用更新工具 - 注释掉，原始版本没有
        // case 'update':
        //   return await this.handleUpdate(args);

        // Group 9: PRD范围管理工具（远程服务专用）
        case 'analyze_prd_scope':
        case 'check_task_scope':
        case 'list_change_requests':
        case 'create_change_request':
        case 'update_change_request_status':
        case 'get_scope_health':
        case 'auto_associate_tasks':
        case 'get_requirements_baseline':
          return await this.handleScopeManagementTool(name, args);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
      };
    } finally {
      // 恢复原始项目ID
      this.projectId = originalProjectId;
    }
  }

  /**
   * 处理PRD范围管理工具调用
   */
  async handleScopeManagementTool(toolName, args) {
    try {
      // 获取项目路径
      const projectId = this.projectId || this.defaultProjectId;
      const projectPath = `./projects/${projectId}`;

      // 调用范围管理工具
      const result = await this.scopeTools.executeTool(toolName, args, projectPath);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${toolName}: ${error.message}`,
          },
        ],
      };
    }
  }

  setupToolHandlers() {
    // 列出可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return await this.getToolsList();
    });

    // 处理工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await this.handleToolCall(request.params);
    });
  }

  async handleAddTask(args) {
    const { title, description, priority = 'medium' } = args;
    
    // URL会被拼接为: http://localhost:3000/api/projects/{projectId}/tasks
    const result = await this.callApi('tasks', {
      method: 'POST',
      body: JSON.stringify({ title, description, priority }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `✅ Task added successfully to project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }



  async handleUpdateTask(args) {
    const { taskId, ...updates } = args;
    
    // URL会被拼接为: http://localhost:3000/api/projects/{projectId}/tasks/{taskId}
    const result = await this.callApi(`tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    return {
      content: [
        {
          type: 'text',
          text: `✅ Task ${taskId} updated successfully in project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleSwitchProject(args) {
    const { projectId } = args;

    // 验证项目是否存在，如果不存在则创建
    try {
      const url = `${this.apiUrl}/api/projects/${projectId}`;
      const response = await fetch(url);

      if (!response.ok) {
        // 项目不存在，尝试创建并初始化
        console.log(`Project ${projectId} not found, creating and initializing...`);

        // 先初始化项目
        const initResult = await this.callApi('initialize', {
          method: 'POST',
          body: JSON.stringify({ force: true }),
        }, projectId);

        console.log(`Project ${projectId} initialized successfully`);
      }

      // 更新当前项目ID
      this.projectId = projectId;
      process.env.TASKMASTER_PROJECT_ID = projectId;

      return {
        content: [
          {
            type: 'text',
            text: `🔄 Switched to project: ${projectId}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to switch project: ${error.message}`);
    }
  }

  async handleParsePRD(args) {
    const { numTasks = 10, force = false, research = false } = args;

    // 服务端将自动从项目的固定路径读取PRD文档
    // URL会被拼接为: http://localhost:3000/api/projects/{projectId}/prd/parse
    const result = await this.callApi('prd/parse', {
      method: 'POST',
      body: JSON.stringify({
        // 不再传递prdFilePath，服务端会自动查找PRD文档
        numTasks,
        force,
        useResearch: research
      }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `📄 PRD parsed successfully for project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  // Group 1: 初始化与设置工具处理函数
  async handleInitializeProject(args) {
    const { force = false } = args;

    const result = await this.callApi(`initialize`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `🚀 Project ${this.projectId} initialized successfully!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleModels() {
    const result = await this.callApi('models');

    return {
      content: [
        {
          type: 'text',
          text: `🤖 Available AI models:\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleRules() {
    const result = await this.callApi('rules');

    return {
      content: [
        {
          type: 'text',
          text: `📋 TaskMaster rules and guidelines:\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  // Group 2: 任务分析与扩展工具处理函数
  async handleAnalyze(args) {
    const { detailed = false } = args;

    const result = await this.callApi(`analyze`, {
      method: 'POST',
      body: JSON.stringify({ detailed }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `📊 Project complexity analysis for ${this.projectId}:\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleExpandTask(args) {
    const { taskId, numSubtasks = 5 } = args;

    const result = await this.callApi(`tasks/${taskId}/expand`, {
      method: 'POST',
      body: JSON.stringify({ numSubtasks }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `🌳 Task ${taskId} expanded with subtasks in project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleExpandAll(args) {
    const { maxSubtasks = 5 } = args;

    const result = await this.callApi('tasks/expand-all', {
      method: 'POST',
      body: JSON.stringify({ maxSubtasks }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `🌳 All tasks expanded with subtasks in project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  // Group 3: 任务列表与查看工具处理函数
  async handleGetTask(args) {
    const { taskId } = args;

    const result = await this.callApi(`tasks/${taskId}`);

    return {
      content: [
        {
          type: 'text',
          text: `📋 Task ${taskId} details in project ${this.projectId}:\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleGetTasks(args) {
    const { status, withSubtasks = false } = args;

    let url = 'tasks';
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (withSubtasks) params.append('withSubtasks', 'true');
    if (params.toString()) url += `?${params.toString()}`;

    const result = await this.callApi(url);

    return {
      content: [
        {
          type: 'text',
          text: `📋 Tasks in project ${this.projectId}:\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleNextTask(args) {
    const { status = 'pending' } = args;

    const result = await this.callApi(`tasks/next?status=${encodeURIComponent(status)}`);

    return {
      content: [
        {
          type: 'text',
          text: `⏭️ Next task to work on in project ${this.projectId}:\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleComplexityReport(args) {
    const { format = 'json' } = args;

    const result = await this.callApi(`reports/complexity?format=${format}`);

    return {
      content: [
        {
          type: 'text',
          text: `📊 Complexity report for project ${this.projectId}:\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  // Group 4: 任务状态与管理工具处理函数
  async handleSetTaskStatus(args) {
    const { taskId, status } = args;

    const result = await this.callApi(`tasks/${taskId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `✅ Task ${taskId} status updated to '${status}' in project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleGenerate(args) {
    const { taskId, type = 'all' } = args;

    const result = await this.callApi(`tasks/${taskId}/generate`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `🔧 Generated ${type} files for task ${taskId} in project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  // Group 5: 任务创建与修改工具处理函数（更新现有的handleAddTask）
  async handleAddTask(args) {
    const {
      prompt,
      title,
      description,
      details,
      testStrategy,
      dependencies,
      priority = 'medium',
      research = false
    } = args;

    const result = await this.callApi('tasks', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        title,
        description,
        details,
        testStrategy,
        dependencies,
        priority,
        research
      }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `✅ Task added successfully to project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleAddSubtask(args) {
    const { parentTaskId, title, description, priority = 'medium' } = args;

    const result = await this.callApi(`tasks/${parentTaskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title, description, priority }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `✅ Subtask added to task ${parentTaskId} in project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleUpdateSubtask(args) {
    const { taskId, subtaskId, title, description, status } = args;

    const result = await this.callApi(`tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'PUT',
      body: JSON.stringify({ title, description, status }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `✅ Subtask ${subtaskId} updated in task ${taskId} in project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleRemoveTask(args) {
    const { taskId, force = false } = args;

    const result = await this.callApi(`tasks/${taskId}`, {
      method: 'DELETE',
      body: JSON.stringify({ force }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `🗑️ Task ${taskId} removed from project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleRemoveSubtask(args) {
    const { taskId, subtaskId } = args;

    const result = await this.callApi(`tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'DELETE',
    });

    return {
      content: [
        {
          type: 'text',
          text: `🗑️ Subtask ${subtaskId} removed from task ${taskId} in project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleClearSubtasks(args) {
    const { taskId } = args;

    const result = await this.callApi(`tasks/${taskId}/subtasks`, {
      method: 'DELETE',
    });

    return {
      content: [
        {
          type: 'text',
          text: `🧹 All subtasks cleared from task ${taskId} in project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleMoveTask(args) {
    const { taskId, newPosition } = args;

    const result = await this.callApi(`tasks/${taskId}/move`, {
      method: 'PUT',
      body: JSON.stringify({ newPosition }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `📦 Task ${taskId} moved to position ${newPosition} in project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  // Group 6: 依赖管理工具处理函数
  async handleAddDependency(args) {
    const { taskId, dependsOnTaskId } = args;

    const result = await this.callApi(`tasks/${taskId}/dependencies`, {
      method: 'POST',
      body: JSON.stringify({ dependsOnTaskId }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `🔗 Dependency added: Task ${taskId} now depends on Task ${dependsOnTaskId} in project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleRemoveDependency(args) {
    const { taskId, dependsOnTaskId } = args;

    const result = await this.callApi(`tasks/${taskId}/dependencies/${dependsOnTaskId}`, {
      method: 'DELETE',
    });

    return {
      content: [
        {
          type: 'text',
          text: `🔗 Dependency removed: Task ${taskId} no longer depends on Task ${dependsOnTaskId} in project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleValidateDependencies(args) {
    const { fix = false } = args;

    const result = await this.callApi('dependencies/validate', {
      method: 'POST',
      body: JSON.stringify({ fix }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `🔍 Dependencies validation for project ${this.projectId}:\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleFixDependencies(args) {
    const { strategy = 'remove-oldest' } = args;

    const result = await this.callApi('dependencies/fix', {
      method: 'POST',
      body: JSON.stringify({ strategy }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `🔧 Dependencies fixed using '${strategy}' strategy in project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  // Group 7: 标签管理工具处理函数
  async handleListTags() {
    const result = await this.callApi('tags');

    return {
      content: [
        {
          type: 'text',
          text: `🏷️ Available tags in project ${this.projectId}:\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleAddTag(args) {
    const { tagName, description } = args;

    const result = await this.callApi('tags', {
      method: 'POST',
      body: JSON.stringify({ tagName, description }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `🏷️ Tag '${tagName}' added to project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleDeleteTag(args) {
    const { tagName, force = false } = args;

    const result = await this.callApi(`tags/${tagName}`, {
      method: 'DELETE',
      body: JSON.stringify({ force }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `🗑️ Tag '${tagName}' deleted from project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleUseTag(args) {
    const { tagName } = args;

    const result = await this.callApi(`tags/${tagName}/use`, {
      method: 'POST',
    });

    return {
      content: [
        {
          type: 'text',
          text: `🏷️ Switched to tag '${tagName}' in project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleRenameTag(args) {
    const { oldTagName, newTagName } = args;

    const result = await this.callApi(`tags/${oldTagName}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ newTagName }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `🏷️ Tag '${oldTagName}' renamed to '${newTagName}' in project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async handleCopyTag(args) {
    const { sourceTagName, targetTagName } = args;

    const result = await this.callApi(`tags/${sourceTagName}/copy`, {
      method: 'POST',
      body: JSON.stringify({ targetTagName }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `🏷️ Tag '${sourceTagName}' copied to '${targetTagName}' in project ${this.projectId}!\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  // Group 8: 研究功能工具处理函数
  async handleResearch(args) {
    const { query, scope = 'task' } = args;

    const result = await this.callApi('research', {
      method: 'POST',
      body: JSON.stringify({ query, scope }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `🔬 Research results for '${query}' (scope: ${scope}) in project ${this.projectId}:\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  // Group 8.5: 获取IDE配置内容工具处理函数
  async handleGetIdeConfigContent(args) {
    const { ideType, format = 'content' } = args;

    try {
      // 导入必要的模块
      const fs = await import('fs');
      const path = await import('path');

      // 所有支持的IDE配置目录
      const ideDirectories = [
        '.claude',
        '.clinerules',
        '.cursor',
        '.github',
        '.idea',
        '.roo',
        '.trae',
        '.vscode',
        '.windsurf'
      ];

      // 确定要读取的IDE目录
      let targetDirectories = [];
      if (ideType) {
        const ideDir = `.${ideType}`;
        if (ideDirectories.includes(ideDir)) {
          targetDirectories = [ideDir];
        } else {
          throw new Error(`不支持的IDE类型: ${ideType}。支持的类型: ${ideDirectories.map(d => d.substring(1)).join(', ')}`);
        }
      } else {
        targetDirectories = ideDirectories;
      }

      // 项目根目录路径（MCP服务器运行的目录）
      const projectRootPath = process.cwd();
      console.log(`🔍 Reading IDE config from project root: ${projectRootPath}`);

      let fileContents = [];

      // 读取每个IDE目录的文件
      for (const ideDir of targetDirectories) {
        const ideDirPath = path.join(projectRootPath, ideDir);

        // 检查目录是否存在
        if (!fs.existsSync(ideDirPath)) {
          console.log(`⚠️ IDE目录不存在: ${ideDirPath}`);
          continue;
        }

        // 递归读取目录中的所有文件
        const files = this.readDirectoryRecursively(ideDirPath, ideDir, fs, path);
        fileContents.push(...files);
      }

      if (fileContents.length === 0) {
        throw new Error(`未找到任何IDE配置文件${ideType ? ` (${ideType})` : ''}`);
      }

      if (format === 'script') {
        // 生成创建文件的脚本
        return this.generateFileCreationScript(fileContents, ideType);
      } else {
        // 返回文件内容列表
        return this.generateFileContentResponse(fileContents, ideType);
      }

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 获取IDE配置内容失败: ${error.message}`,
          },
        ],
      };
    }
  }

  // 递归读取目录中的所有文件
  readDirectoryRecursively(dirPath, relativePath, fs, path) {
    const files = [];

    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const relativeItemPath = path.join(relativePath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          // 递归读取子目录
          const subFiles = this.readDirectoryRecursively(itemPath, relativeItemPath, fs, path);
          files.push(...subFiles);
        } else if (stat.isFile()) {
          // 读取文件内容
          try {
            const content = fs.readFileSync(itemPath, 'utf8');
            files.push({
              path: relativeItemPath.replace(/\\/g, '/'), // 统一使用正斜杠
              content: content
            });
          } catch (readError) {
            console.log(`⚠️ 无法读取文件: ${itemPath}, 错误: ${readError.message}`);
          }
        }
      }
    } catch (dirError) {
      console.log(`⚠️ 无法读取目录: ${dirPath}, 错误: ${dirError.message}`);
    }

    return files;
  }

  // 生成文件内容响应
  generateFileContentResponse(fileContents, ideType) {
    let resultMessage = `📁 IDE配置文件内容获取成功！\n\n`;
    resultMessage += `项目: ${this.projectId}\n`;
    resultMessage += `IDE类型: ${ideType || '全部'}\n`;
    resultMessage += `文件数量: ${fileContents.length}\n\n`;

    resultMessage += `📋 文件列表和内容：\n`;
    resultMessage += `${'='.repeat(50)}\n\n`;

    for (const file of fileContents) {
      resultMessage += `📄 文件: ${file.path}\n`;
      resultMessage += `${'─'.repeat(30)}\n`;
      resultMessage += `${file.content}\n`;
      resultMessage += `${'─'.repeat(30)}\n\n`;
    }

    resultMessage += `💡 使用说明：\n`;
    resultMessage += `1. 在您的客户端项目根目录创建上述文件\n`;
    resultMessage += `2. 复制对应的文件内容\n`;
    resultMessage += `3. 或者使用 format: "script" 参数获取自动化脚本\n`;

    return {
      content: [
        {
          type: 'text',
          text: resultMessage,
        },
      ],
    };
  }

  // 生成文件创建脚本
  generateFileCreationScript(fileContents, ideType) {
    let scriptContent = `#!/bin/bash\n`;
    scriptContent += `# IDE配置文件创建脚本\n`;
    scriptContent += `# 项目: ${this.projectId}\n`;
    scriptContent += `# IDE类型: ${ideType || '全部'}\n`;
    scriptContent += `# 生成时间: ${new Date().toISOString()}\n\n`;

    scriptContent += `echo "🚀 开始创建IDE配置文件..."\n\n`;

    for (const file of fileContents) {
      const dirPath = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '';

      if (dirPath) {
        scriptContent += `# 创建目录: ${dirPath}\n`;
        scriptContent += `mkdir -p "${dirPath}"\n\n`;
      }

      scriptContent += `# 创建文件: ${file.path}\n`;
      scriptContent += `cat > "${file.path}" << 'EOF'\n`;
      scriptContent += `${file.content}\n`;
      scriptContent += `EOF\n\n`;
      scriptContent += `echo "✅ 创建文件: ${file.path}"\n\n`;
    }

    scriptContent += `echo "🎉 IDE配置文件创建完成！"\n`;
    scriptContent += `echo "📁 共创建 ${fileContents.length} 个文件"\n`;

    let resultMessage = `📁 IDE配置文件创建脚本生成成功！\n\n`;
    resultMessage += `项目: ${this.projectId}\n`;
    resultMessage += `IDE类型: ${ideType || '全部'}\n`;
    resultMessage += `文件数量: ${fileContents.length}\n\n`;

    resultMessage += `💾 脚本内容：\n`;
    resultMessage += `${'='.repeat(50)}\n`;
    resultMessage += `${scriptContent}\n`;
    resultMessage += `${'='.repeat(50)}\n\n`;

    resultMessage += `💡 使用说明：\n`;
    resultMessage += `1. 将上述脚本内容保存为 create_ide_config.sh\n`;
    resultMessage += `2. 在客户端项目根目录执行: chmod +x create_ide_config.sh\n`;
    resultMessage += `3. 运行脚本: ./create_ide_config.sh\n`;

    return {
      content: [
        {
          type: 'text',
          text: resultMessage,
        },
      ],
    };
  }

  // 操作状态工具处理函数
  async handleGetOperationStatus(args) {
    const { operationId } = args;

    const result = await this.callApi(`operations/${operationId}/status`);

    return {
      content: [
        {
          type: 'text',
          text: `📊 Operation ${operationId} status in project ${this.projectId}:\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  // 缓存统计工具处理函数
  async handleCacheStats() {
    const result = await this.callApi('cache/stats');

    return {
      content: [
        {
          type: 'text',
          text: `📈 Cache statistics for project ${this.projectId}:\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  // 通用更新工具处理函数
  async handleUpdate(args) {
    const { tasks } = args;

    const result = await this.callApi('update', {
      method: 'POST',
      body: JSON.stringify({ tasks }),
    });

    return {
      content: [
        {
          type: 'text',
          text: `🔄 Batch update completed for project ${this.projectId}:\n\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async run() {
    // 检查是否以HTTP模式运行
    const httpMode = process.env.MCP_HTTP_MODE === 'true' || process.argv.includes('--http');

    if (httpMode) {
      // HTTP服务器模式
      this.app.listen(this.port, () => {
        console.log(`🚀 TaskMaster MCP HTTP server running on port ${this.port}`);
        console.log(`📡 Health check: http://localhost:${this.port}/health`);
        console.log(`🔗 MCP endpoint: http://localhost:${this.port}/mcp`);
      });
    } else {
      // 传统stdio模式
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error(`TaskMaster Remote MCP server running for project: ${this.defaultProjectId}`);
    }
  }
}

const server = new TaskMasterRemoteMCPServer();
server.run().catch(console.error);
