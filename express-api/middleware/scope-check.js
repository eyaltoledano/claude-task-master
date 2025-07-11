/**
 * 任务范围检查中间件
 * 在任务操作前检查是否超出PRD范围
 */

import ScopeChecker from '../services/scope-checker.js';
import ChangeRequestManager from '../services/change-request-manager.js';
import TaskScopeAdapter from '../adapters/task-scope-adapter.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('scope-check-middleware');

export class ScopeCheckMiddleware {
  constructor() {
    this.scopeChecker = new ScopeChecker();
    this.crManager = new ChangeRequestManager();
    this.taskScopeAdapter = new TaskScopeAdapter();
    this.logger = logger;
  }

  /**
   * 任务范围检查中间件
   */
  checkTaskScope(options = {}) {
    const {
      operation = 'add', // add, modify, delete, expand
      autoCreateCR = true, // 自动创建变更请求
      blockOutOfScope = false, // 是否阻止超出范围的操作
      confidenceThreshold = 0.7 // 置信度阈值
    } = options;

    return async (req, res, next) => {
      try {
        this.logger.debug('Scope check middleware triggered', {
          method: req.method,
          path: req.path,
          operation,
          requestId: req.requestId
        });

        // 跳过某些路径
        if (this._shouldSkipCheck(req)) {
          this.logger.debug('Skipping scope check', {
            reason: 'shouldSkipCheck returned true',
            method: req.method,
            path: req.path,
            requestId: req.requestId
          });
          return next();
        }

        const projectPath = req.project?.path;
        if (!projectPath) {
          this.logger.debug('Skipping scope check', {
            reason: 'no project path',
            projectPath,
            requestId: req.requestId
          });
          return next(); // 没有项目路径，跳过检查
        }

        // 提取任务信息
        const tasks = this._extractTasks(req, operation);
        this.logger.debug('Extracted tasks for scope check', {
          operation,
          tasksCount: tasks?.length || 0,
          tasks: tasks?.map(t => ({ title: t.title, description: t.description?.substring(0, 100) })),
          requestId: req.requestId
        });

        if (!tasks || tasks.length === 0) {
          this.logger.debug('Skipping scope check', {
            reason: 'no tasks extracted',
            operation,
            requestBody: req.body,
            requestId: req.requestId
          });
          return next(); // 没有任务，跳过检查
        }

        // 执行范围检查
        const scopeResults = await this.scopeChecker.checkMultipleTasksScope(
          projectPath, 
          tasks, 
          operation
        );

        // 分析结果
        const analysis = this._analyzeScopeResults(scopeResults, confidenceThreshold);
        
        // 记录检查结果
        req.scopeCheck = {
          results: scopeResults,
          analysis,
          operation
        };

        // 处理超出范围的任务
        if (analysis.outOfScopeTasks.length > 0) {
          await this._handleOutOfScopeTasks(
            projectPath, 
            analysis.outOfScopeTasks, 
            operation,
            autoCreateCR,
            req
          );

          // 如果配置为阻止超出范围的操作
          if (blockOutOfScope) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'SCOPE_VIOLATION',
                message: '检测到超出PRD范围的任务',
                details: analysis
              },
              requestId: req.requestId
            });
          }
        }

        // 添加警告信息到响应
        if (analysis.warnings.length > 0) {
          req.scopeWarnings = analysis.warnings;
        }

        next();

      } catch (error) {
        this.logger.error('Scope check middleware error', { 
          error: error.message,
          requestId: req.requestId 
        });
        
        // 范围检查失败不应该阻止操作，只记录错误
        req.scopeCheckError = error.message;
        next();
      }
    };
  }

  /**
   * 是否应该跳过检查
   */
  _shouldSkipCheck(req) {
    // 跳过GET请求
    if (req.method === 'GET') return true;

    // 获取完整的原始URL路径
    const fullPath = req.originalUrl || req.url || req.path;

    // 跳过健康检查等
    if (fullPath === '/health') return true;

    // 跳过非任务相关的操作
    if (!fullPath.includes('/tasks')) return true;

    this.logger.debug('Scope check will proceed', {
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      fullPath,
      requestId: req.requestId
    });

    return false;
  }

  /**
   * 从请求中提取任务信息
   */
  _extractTasks(req, operation) {
    const tasks = [];

    switch (operation) {
      case 'add':
        if (req.body && (req.body.title || req.body.tasks)) {
          if (req.body.tasks) {
            // 批量添加
            tasks.push(...req.body.tasks);
          } else {
            // 单个添加
            tasks.push(req.body);
          }
        }
        break;

      case 'modify':
        if (req.body) {
          tasks.push({
            id: req.params.taskId || req.body.id,
            ...req.body
          });
        }
        break;

      case 'expand':
        if (req.body && req.params.taskId) {
          // 扩展任务时，检查生成的子任务
          if (req.body.subtasks) {
            tasks.push(...req.body.subtasks);
          }
        }
        break;

      case 'delete':
        // 删除操作通常不需要范围检查
        break;
    }

    return tasks.filter(task => task && (task.title || task.description));
  }

  /**
   * 分析范围检查结果
   */
  _analyzeScopeResults(scopeResults, confidenceThreshold) {
    const analysis = {
      totalTasks: scopeResults.length,
      inScopeTasks: [],
      outOfScopeTasks: [],
      lowConfidenceTasks: [],
      highRiskTasks: [],
      warnings: []
    };

    for (const result of scopeResults) {
      const { scopeCheck } = result;

      if (scopeCheck.error) {
        analysis.warnings.push({
          type: 'check_error',
          taskId: result.taskId,
          message: `范围检查失败: ${scopeCheck.reasoning}`
        });
        continue;
      }

      if (scopeCheck.skipCheck) {
        analysis.warnings.push({
          type: 'skip_check',
          taskId: result.taskId,
          message: '跳过范围检查（无PRD基线）'
        });
        continue;
      }

      if (scopeCheck.inScope) {
        analysis.inScopeTasks.push(result);
      } else {
        analysis.outOfScopeTasks.push(result);
      }

      if (scopeCheck.confidence < confidenceThreshold) {
        analysis.lowConfidenceTasks.push(result);
      }

      if (scopeCheck.riskLevel === 'high') {
        analysis.highRiskTasks.push(result);
      }
    }

    // 生成警告
    if (analysis.outOfScopeTasks.length > 0) {
      analysis.warnings.push({
        type: 'scope_violation',
        message: `发现 ${analysis.outOfScopeTasks.length} 个超出PRD范围的任务`,
        tasks: analysis.outOfScopeTasks.map(t => t.taskId)
      });
    }

    if (analysis.lowConfidenceTasks.length > 0) {
      analysis.warnings.push({
        type: 'low_confidence',
        message: `发现 ${analysis.lowConfidenceTasks.length} 个低置信度判断`,
        tasks: analysis.lowConfidenceTasks.map(t => t.taskId)
      });
    }

    return analysis;
  }

  /**
   * 处理超出范围的任务
   */
  async _handleOutOfScopeTasks(projectPath, outOfScopeTasks, operation, autoCreateCR, req) {
    if (!autoCreateCR) return;

    for (const taskResult of outOfScopeTasks) {
      try {
        const cr = await this.crManager.createAutoChangeRequest(
          projectPath,
          taskResult.task,
          taskResult.scopeCheck,
          operation
        );

        this.logger.info('Auto-created change request', {
          crId: cr.data.id,
          taskId: taskResult.taskId,
          operation,
          requestId: req.requestId
        });

        // 使用适配器保存范围数据，而不修改原始任务
        if (taskResult.task.id) {
          await this.taskScopeAdapter.associateChangeRequest(
            projectPath,
            taskResult.task.id,
            cr.data.id
          );

          // 记录范围检查结果
          await this.taskScopeAdapter.recordScopeCheckResult(
            projectPath,
            taskResult.task.id,
            taskResult.scopeCheck
          );
        }

      } catch (error) {
        this.logger.error('Failed to create auto change request', {
          error: error.message,
          taskId: taskResult.taskId,
          requestId: req.requestId
        });
      }
    }
  }
}

/**
 * 创建任务范围检查中间件实例
 */
export function createScopeCheckMiddleware(options = {}) {
  const middleware = new ScopeCheckMiddleware();
  return middleware.checkTaskScope(options);
}

/**
 * 预定义的中间件配置
 */
export const scopeCheckMiddlewares = {
  // 添加任务时的范围检查
  addTask: createScopeCheckMiddleware({
    operation: 'add',
    autoCreateCR: true,
    blockOutOfScope: false
  }),

  // 修改任务时的范围检查
  modifyTask: createScopeCheckMiddleware({
    operation: 'modify',
    autoCreateCR: true,
    blockOutOfScope: false
  }),

  // 扩展任务时的范围检查
  expandTask: createScopeCheckMiddleware({
    operation: 'expand',
    autoCreateCR: true,
    blockOutOfScope: false
  }),

  // 严格模式：阻止超出范围的操作
  strict: createScopeCheckMiddleware({
    operation: 'add',
    autoCreateCR: true,
    blockOutOfScope: true,
    confidenceThreshold: 0.8
  })
};

export default ScopeCheckMiddleware;
