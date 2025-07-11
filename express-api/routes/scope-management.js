/**
 * PRD范围管理和变更请求API路由
 */

import express from 'express';
import path from 'path';
import PrdAnalyzer from '../services/prd-analyzer.js';
import ScopeChecker from '../services/scope-checker.js';
import ChangeRequestManager from '../services/change-request-manager.js';
import TaskEnhancementService from '../services/task-enhancement.js';
import { ValidationError } from '../middleware/error-handler.js';
import { createLogger } from '../utils/logger.js';

const router = express.Router({ mergeParams: true });
const logger = createLogger('scope-management-routes');

const prdAnalyzer = new PrdAnalyzer();
const scopeChecker = new ScopeChecker();
const crManager = new ChangeRequestManager();
const taskEnhancement = new TaskEnhancementService();

// PRD分析相关路由

/**
 * 分析PRD文件，提取需求基线
 */
router.post('/analyze-prd', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { prdFilePath } = req.body;

    if (!prdFilePath) {
      throw new ValidationError('PRD file path is required');
    }

    const project = req.project;
    const fullPrdPath = path.join(project.path, '.taskmaster', 'docs', prdFilePath);

    const result = await prdAnalyzer.analyzePrd(project.path, fullPrdPath);

    res.json({
      success: true,
      data: result.data,
      message: 'PRD analysis completed successfully',
      projectId,
      requestId: req.requestId
    });

  } catch (error) {
    next(error);
  }
});

/**
 * 获取PRD需求基线
 */
router.get('/requirements-baseline', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const project = req.project;

    const baseline = await prdAnalyzer.getRequirementsBaseline(project.path);

    if (!baseline) {
      return res.json({
        success: true,
        data: null,
        message: 'No PRD baseline found',
        projectId,
        requestId: req.requestId
      });
    }

    res.json({
      success: true,
      data: baseline,
      projectId,
      requestId: req.requestId
    });

  } catch (error) {
    next(error);
  }
});

// 范围检查相关路由

/**
 * 检查单个任务的范围
 */
router.post('/check-task-scope', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { task, operation = 'add' } = req.body;

    if (!task) {
      throw new ValidationError('Task data is required');
    }

    const project = req.project;
    const result = await scopeChecker.checkTaskScope(project.path, task, operation);

    res.json({
      success: true,
      data: result,
      projectId,
      requestId: req.requestId
    });

  } catch (error) {
    next(error);
  }
});

/**
 * 批量检查任务范围
 */
router.post('/check-tasks-scope', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { tasks, operation = 'add' } = req.body;

    if (!tasks || !Array.isArray(tasks)) {
      throw new ValidationError('Tasks array is required');
    }

    const project = req.project;
    const results = await scopeChecker.checkMultipleTasksScope(project.path, tasks, operation);
    const report = scopeChecker.generateScopeReport(results);

    res.json({
      success: true,
      data: {
        results,
        report
      },
      projectId,
      requestId: req.requestId
    });

  } catch (error) {
    next(error);
  }
});

// 变更请求相关路由

/**
 * 创建变更请求
 */
router.post('/change-requests', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const crData = req.body;

    const project = req.project;
    const result = await crManager.createChangeRequest(project.path, crData);

    res.json({
      success: true,
      data: result.data,
      message: 'Change request created successfully',
      projectId,
      requestId: req.requestId
    });

  } catch (error) {
    next(error);
  }
});

/**
 * 获取变更请求列表
 */
router.get('/change-requests', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { status, type, priority, requestedBy } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (priority) filters.priority = priority;
    if (requestedBy) filters.requestedBy = requestedBy;

    const project = req.project;
    const crs = await crManager.getChangeRequests(project.path, filters);

    res.json({
      success: true,
      data: crs,
      count: crs.length,
      projectId,
      requestId: req.requestId
    });

  } catch (error) {
    next(error);
  }
});

/**
 * 获取单个变更请求
 */
router.get('/change-requests/:crId', async (req, res, next) => {
  try {
    const { projectId, crId } = req.params;
    const project = req.project;

    const cr = await crManager.getChangeRequest(project.path, crId);

    if (!cr) {
      throw new ValidationError(`Change request ${crId} not found`);
    }

    res.json({
      success: true,
      data: cr,
      projectId,
      requestId: req.requestId
    });

  } catch (error) {
    next(error);
  }
});

/**
 * 更新变更请求状态
 */
router.patch('/change-requests/:crId/status', async (req, res, next) => {
  try {
    const { projectId, crId } = req.params;
    const { status, comment, approvedBy } = req.body;

    if (!status) {
      throw new ValidationError('Status is required');
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'implemented'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const project = req.project;
    const cr = await crManager.updateChangeRequestStatus(
      project.path, 
      crId, 
      status, 
      comment, 
      approvedBy
    );

    res.json({
      success: true,
      data: cr,
      message: `Change request status updated to ${status}`,
      projectId,
      requestId: req.requestId
    });

  } catch (error) {
    next(error);
  }
});

/**
 * 获取变更请求报告
 */
router.get('/change-requests-report', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const project = req.project;

    const report = await crManager.generateChangeRequestReport(project.path);

    res.json({
      success: true,
      data: report,
      projectId,
      requestId: req.requestId
    });

  } catch (error) {
    next(error);
  }
});

// 任务增强相关路由

/**
 * 自动关联任务到PRD需求
 */
router.post('/auto-associate-tasks', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const project = req.project;

    // 获取当前任务列表
    const tasksResult = await req.projectManager.coreAdapter.listTasks(project.path);
    const tasks = tasksResult.tasks || [];

    const associatedCount = await taskEnhancement.autoAssociateTasksToRequirements(
      project.path,
      tasks
    );

    res.json({
      success: true,
      data: {
        totalTasks: tasks.length,
        associatedTasks: associatedCount,
        message: `Successfully associated ${associatedCount} tasks with PRD requirements`
      },
      projectId,
      requestId: req.requestId
    });

  } catch (error) {
    next(error);
  }
});

/**
 * 生成任务范围报告
 */
router.get('/task-scope-report', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const project = req.project;

    // 获取当前任务列表
    const tasksResult = await req.projectManager.coreAdapter.listTasks(project.path);
    const tasks = tasksResult.tasks || [];

    const report = await taskEnhancement.generateTaskScopeReport(project.path, tasks);

    res.json({
      success: true,
      data: report,
      projectId,
      requestId: req.requestId
    });

  } catch (error) {
    next(error);
  }
});

/**
 * 清理任务范围数据
 */
router.post('/cleanup-scope-data', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const project = req.project;

    // 获取当前任务列表
    const tasksResult = await req.projectManager.coreAdapter.listTasks(project.path);
    const tasks = tasksResult.tasks || [];
    const existingTaskIds = tasks.map(task => task.id);

    const cleanedCount = await taskEnhancement.cleanupTaskScopeData(
      project.path,
      existingTaskIds
    );

    res.json({
      success: true,
      data: {
        cleanedCount,
        message: `Cleaned up ${cleanedCount} orphaned scope data entries`
      },
      projectId,
      requestId: req.requestId
    });

  } catch (error) {
    next(error);
  }
});

// 综合分析路由

/**
 * 获取项目范围健康度报告
 */
router.get('/scope-health', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const project = req.project;

    // 获取PRD基线
    const baseline = await prdAnalyzer.getRequirementsBaseline(project.path);
    
    // 获取变更请求统计
    const crReport = await crManager.generateChangeRequestReport(project.path);

    // 计算健康度指标
    const health = {
      hasBaseline: !!baseline,
      requirementsCoverage: baseline ? 'N/A' : 'No baseline',
      changeRequestTrend: crReport.summary.total > 0 ? 'Active' : 'Stable',
      riskLevel: crReport.summary.pending > 5 ? 'High' : 
                 crReport.summary.pending > 2 ? 'Medium' : 'Low',
      recommendations: []
    };

    if (!baseline) {
      health.recommendations.push('建议先分析PRD文件建立需求基线');
    }

    if (crReport.summary.pending > 0) {
      health.recommendations.push(`有 ${crReport.summary.pending} 个待处理的变更请求`);
    }

    res.json({
      success: true,
      data: {
        health,
        baseline: baseline ? {
          totalRequirements: baseline.metadata.totalRequirements,
          coreRequirements: baseline.metadata.coreRequirements,
          analyzedAt: baseline.metadata.analyzedAt
        } : null,
        changeRequests: crReport.summary
      },
      projectId,
      requestId: req.requestId
    });

  } catch (error) {
    next(error);
  }
});

export default router;
