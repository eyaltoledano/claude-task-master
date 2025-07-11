/**
 * PRD范围管理MCP工具
 * 仅用于远程MCP服务器，不修改原始TaskMaster MCP工具
 */

import PrdAnalyzer from '../services/prd-analyzer.js';
import ScopeChecker from '../services/scope-checker.js';
import ChangeRequestManager from '../services/change-request-manager.js';
import TaskEnhancementService from '../services/task-enhancement.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('scope-management-mcp-tools');

export class ScopeManagementMCPTools {
  constructor() {
    this.prdAnalyzer = new PrdAnalyzer();
    this.scopeChecker = new ScopeChecker();
    this.crManager = new ChangeRequestManager();
    this.taskEnhancement = new TaskEnhancementService();
    this.logger = logger;
  }

  /**
   * 获取所有PRD范围管理相关的MCP工具定义
   */
  getToolDefinitions() {
    return [
      {
        name: 'analyze_prd_scope',
        description: 'Analyze PRD document to extract requirements and establish project scope baseline for change management. Automatically finds PRD document in project docs directory.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'check_task_scope',
        description: 'Check if a task is within PRD scope and get AI-powered analysis with confidence score',
        inputSchema: {
          type: 'object',
          properties: {
            task: {
              type: 'object',
              properties: {
                id: { type: 'number', description: 'Task ID (optional for new tasks)' },
                title: { type: 'string', description: 'Task title' },
                description: { type: 'string', description: 'Task description' },
                details: { type: 'string', description: 'Task details (optional)' }
              },
              required: ['title', 'description']
            },
            operation: {
              type: 'string',
              enum: ['add', 'modify', 'delete', 'expand'],
              default: 'add',
              description: 'Type of operation being performed'
            }
          },
          required: ['task']
        }
      },
      {
        name: 'list_change_requests',
        description: 'List all change requests with optional filtering by status, type, or priority',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected', 'implemented'],
              description: 'Filter by status'
            },
            type: {
              type: 'string',
              enum: ['scope_expansion', 'requirement_change', 'task_modification'],
              description: 'Filter by type'
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Filter by priority'
            }
          }
        }
      },
      {
        name: 'create_change_request',
        description: 'Create a new change request for scope changes or requirement modifications',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['scope_expansion', 'requirement_change', 'task_modification'],
              description: 'Type of change request'
            },
            title: { type: 'string', description: 'Change request title' },
            description: { type: 'string', description: 'Detailed description of the change' },
            reason: { type: 'string', description: 'Reason for the change' },
            impact: { type: 'string', description: 'Expected impact of the change' },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              default: 'medium',
              description: 'Priority level'
            },
            relatedTasks: {
              type: 'array',
              items: { type: 'string' },
              description: 'Related task IDs'
            },
            relatedRequirements: {
              type: 'array',
              items: { type: 'string' },
              description: 'Related requirement IDs'
            }
          },
          required: ['type', 'title', 'description', 'reason', 'impact']
        }
      },
      {
        name: 'update_change_request_status',
        description: 'Update the status of a change request (approve, reject, implement)',
        inputSchema: {
          type: 'object',
          properties: {
            crId: { type: 'string', description: 'Change request ID' },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected', 'implemented'],
              description: 'New status'
            },
            comment: { type: 'string', description: 'Comment for the status change' },
            approvedBy: { type: 'string', description: 'Name of person making the change' }
          },
          required: ['crId', 'status']
        }
      },
      {
        name: 'get_scope_health',
        description: 'Generate comprehensive project scope health report with baseline status, coverage, and recommendations',
        inputSchema: {
          type: 'object',
          properties: {
            includeDetails: {
              type: 'boolean',
              default: false,
              description: 'Include detailed task-level information'
            }
          }
        }
      },
      {
        name: 'auto_associate_tasks',
        description: 'Automatically associate existing tasks with PRD requirements using AI matching',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_requirements_baseline',
        description: 'Get the current PRD requirements baseline if available',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  /**
   * 执行MCP工具调用
   */
  async executeTool(toolName, args, projectPath) {
    try {
      this.logger.info('Executing scope management tool', { toolName, projectPath });

      switch (toolName) {
        case 'analyze_prd_scope':
          return await this._analyzePrdScope(args, projectPath);
        
        case 'check_task_scope':
          return await this._checkTaskScope(args, projectPath);
        
        case 'list_change_requests':
          return await this._listChangeRequests(args, projectPath);
        
        case 'create_change_request':
          return await this._createChangeRequest(args, projectPath);
        
        case 'update_change_request_status':
          return await this._updateChangeRequestStatus(args, projectPath);
        
        case 'get_scope_health':
          return await this._getScopeHealth(args, projectPath);
        
        case 'auto_associate_tasks':
          return await this._autoAssociateTasks(args, projectPath);
        
        case 'get_requirements_baseline':
          return await this._getRequirementsBaseline(args, projectPath);
        
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

    } catch (error) {
      this.logger.error('Tool execution failed', { 
        toolName, 
        error: error.message,
        projectPath 
      });
      throw error;
    }
  }

  async _analyzePrdScope(args, projectPath) {
    // 自动查找PRD文档，不再需要prdFilePath参数
    const docsDir = `${projectPath}/.taskmaster/docs`;

    // 常见的PRD文件名
    const commonPrdNames = [
      'prd.md',
      'prd.txt',
      'PRD.md',
      'PRD.txt',
      'requirements.md',
      'requirements.txt',
      'product-requirements.md',
      'product-requirements.txt'
    ];

    let fullPrdPath = null;
    const fs = require('fs').promises;

    // 查找PRD文档
    for (const filename of commonPrdNames) {
      const testPath = `${docsDir}/${filename}`;
      try {
        await fs.access(testPath);
        fullPrdPath = testPath;
        this.logger.info(`Found PRD document: ${filename}`, { projectPath });
        break;
      } catch (error) {
        // 继续查找下一个文件
      }
    }

    if (!fullPrdPath) {
      throw new Error('No PRD document found in project docs directory. Please ensure a PRD file exists with a common name (prd.md, requirements.md, etc.)');
    }

    const result = await this.prdAnalyzer.analyzePrd(projectPath, fullPrdPath);
    
    return {
      success: true,
      data: {
        totalRequirements: result.data.metadata.totalRequirements,
        coreRequirements: result.data.metadata.coreRequirements,
        extendedRequirements: result.data.metadata.extendedRequirements,
        optionalRequirements: result.data.metadata.optionalRequirements,
        analyzedAt: result.data.metadata.analyzedAt,
        requirements: result.data.requirements.map(req => ({
          id: req.id,
          title: req.title,
          category: req.category,
          priority: req.priority,
          scope: req.scope
        }))
      },
      message: `Successfully analyzed PRD and extracted ${result.data.metadata.totalRequirements} requirements`
    };
  }

  async _checkTaskScope(args, projectPath) {
    const { task, operation = 'add' } = args;
    
    const result = await this.scopeChecker.checkTaskScope(projectPath, task, operation);
    
    return {
      success: true,
      data: {
        inScope: result.inScope,
        confidence: result.confidence,
        reasoning: result.reasoning,
        riskLevel: result.riskLevel,
        matchedRequirements: result.matchedRequirements || [],
        suggestedRequirements: result.suggestedRequirements || [],
        recommendations: result.recommendations || []
      },
      message: result.inScope ? 
        `Task is within scope (confidence: ${(result.confidence * 100).toFixed(1)}%)` :
        `Task is outside scope (confidence: ${(result.confidence * 100).toFixed(1)}%)`
    };
  }

  async _listChangeRequests(args, projectPath) {
    const filters = {
      status: args.status,
      type: args.type,
      priority: args.priority
    };
    
    const crs = await this.crManager.getChangeRequests(projectPath, filters);
    
    return {
      success: true,
      data: crs.map(cr => ({
        id: cr.id,
        type: cr.type,
        title: cr.title,
        status: cr.status,
        priority: cr.priority,
        requestedBy: cr.requestedBy,
        requestedAt: cr.requestedAt,
        relatedTasks: cr.relatedTasks,
        relatedRequirements: cr.relatedRequirements
      })),
      count: crs.length,
      message: `Found ${crs.length} change requests`
    };
  }

  async _createChangeRequest(args, projectPath) {
    const result = await this.crManager.createChangeRequest(projectPath, {
      ...args,
      requestedBy: 'mcp-user'
    });
    
    return {
      success: true,
      data: {
        id: result.data.id,
        type: result.data.type,
        title: result.data.title,
        status: result.data.status,
        requestedAt: result.data.requestedAt
      },
      message: `Change request created with ID: ${result.data.id}`
    };
  }

  async _updateChangeRequestStatus(args, projectPath) {
    const { crId, status, comment, approvedBy } = args;
    
    const cr = await this.crManager.updateChangeRequestStatus(
      projectPath, 
      crId, 
      status, 
      comment, 
      approvedBy || 'mcp-user'
    );
    
    return {
      success: true,
      data: {
        id: cr.id,
        status: cr.status,
        updatedAt: cr.updatedAt
      },
      message: `Change request ${crId} status updated to ${status}`
    };
  }

  async _getScopeHealth(args, projectPath) {
    // 获取PRD基线
    const baseline = await this.prdAnalyzer.getRequirementsBaseline(projectPath);
    
    // 获取变更请求统计
    const crReport = await this.crManager.generateChangeRequestReport(projectPath);
    
    // 计算健康度指标
    const health = {
      hasBaseline: !!baseline,
      baselineInfo: baseline ? {
        totalRequirements: baseline.metadata.totalRequirements,
        coreRequirements: baseline.metadata.coreRequirements,
        analyzedAt: baseline.metadata.analyzedAt
      } : null,
      changeRequests: crReport.summary,
      riskLevel: crReport.summary.pending > 5 ? 'High' : 
                 crReport.summary.pending > 2 ? 'Medium' : 'Low',
      recommendations: []
    };

    if (!baseline) {
      health.recommendations.push('建议先分析PRD文件建立需求基线');
    }

    if (crReport.summary.pending > 0) {
      health.recommendations.push(`有 ${crReport.summary.pending} 个待处理的变更请求需要审批`);
    }

    return {
      success: true,
      data: health,
      message: `Project scope health: ${health.riskLevel} risk level`
    };
  }

  async _autoAssociateTasks(args, projectPath) {
    // 这里需要获取任务列表，但我们不能直接访问原始TaskMaster的代码
    // 所以返回一个提示信息
    return {
      success: false,
      message: 'Auto-association requires access to task list. Please use the REST API endpoint instead.',
      suggestion: 'Use POST /api/projects/{projectId}/scope/auto-associate-tasks'
    };
  }

  async _getRequirementsBaseline(args, projectPath) {
    const baseline = await this.prdAnalyzer.getRequirementsBaseline(projectPath);
    
    if (!baseline) {
      return {
        success: true,
        data: null,
        message: 'No PRD baseline found. Run analyze_prd_scope first.'
      };
    }

    return {
      success: true,
      data: {
        metadata: baseline.metadata,
        requirements: baseline.requirements.map(req => ({
          id: req.id,
          title: req.title,
          description: req.description,
          category: req.category,
          priority: req.priority,
          scope: req.scope,
          keywords: req.keywords
        }))
      },
      message: `Found baseline with ${baseline.metadata.totalRequirements} requirements`
    };
  }
}

export default ScopeManagementMCPTools;
