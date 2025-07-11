/**
 * 任务范围数据适配器
 * 在不修改原始TaskMaster代码的情况下，扩展任务数据结构支持PRD范围管理
 */

import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('task-scope-adapter');

export class TaskScopeAdapter {
  constructor() {
    this.logger = logger;
  }

  /**
   * 扩展任务数据，添加PRD范围信息
   */
  extendTaskWithScopeData(task, scopeData = {}) {
    return {
      ...task,
      // 保持原始任务数据不变
      // 添加范围相关的扩展字段
      _scopeExtension: {
        prdRequirementIds: scopeData.prdRequirementIds || [],
        scopeMetadata: scopeData.scopeMetadata || null,
        lastScopeCheck: scopeData.lastScopeCheck || null,
        changeRequestIds: scopeData.changeRequestIds || []
      }
    };
  }

  /**
   * 从扩展任务数据中提取原始任务数据
   */
  extractOriginalTask(extendedTask) {
    const { _scopeExtension, ...originalTask } = extendedTask;
    return originalTask;
  }

  /**
   * 从扩展任务数据中提取范围数据
   */
  extractScopeData(extendedTask) {
    return extendedTask._scopeExtension || {};
  }

  /**
   * 批量扩展任务列表
   */
  extendTaskList(tasks, scopeDataMap = {}) {
    return tasks.map(task => {
      const scopeData = scopeDataMap[task.id] || {};
      return this.extendTaskWithScopeData(task, scopeData);
    });
  }

  /**
   * 保存任务范围数据到独立文件
   */
  async saveTaskScopeData(projectPath, taskId, scopeData) {
    try {
      const scopeDir = path.join(projectPath, '.taskmaster', 'scope-data');
      await fs.mkdir(scopeDir, { recursive: true });

      const scopeFilePath = path.join(scopeDir, `task-${taskId}-scope.json`);
      await fs.writeFile(scopeFilePath, JSON.stringify(scopeData, null, 2), 'utf8');

      this.logger.debug('Task scope data saved', { taskId, scopeFilePath });
      return scopeFilePath;

    } catch (error) {
      this.logger.error('Failed to save task scope data', { 
        error: error.message, 
        taskId 
      });
      throw error;
    }
  }

  /**
   * 加载任务范围数据
   */
  async loadTaskScopeData(projectPath, taskId) {
    try {
      const scopeFilePath = path.join(projectPath, '.taskmaster', 'scope-data', `task-${taskId}-scope.json`);
      const content = await fs.readFile(scopeFilePath, 'utf8');
      return JSON.parse(content);

    } catch (error) {
      if (error.code === 'ENOENT') {
        return {}; // 文件不存在，返回空对象
      }
      this.logger.error('Failed to load task scope data', { 
        error: error.message, 
        taskId 
      });
      throw error;
    }
  }

  /**
   * 批量加载任务范围数据
   */
  async loadAllTaskScopeData(projectPath) {
    try {
      const scopeDir = path.join(projectPath, '.taskmaster', 'scope-data');
      
      try {
        const files = await fs.readdir(scopeDir);
        const scopeDataMap = {};

        for (const file of files) {
          if (file.startsWith('task-') && file.endsWith('-scope.json')) {
            const taskIdMatch = file.match(/task-(\d+)-scope\.json/);
            if (taskIdMatch) {
              const taskId = parseInt(taskIdMatch[1], 10);
              const filePath = path.join(scopeDir, file);
              const content = await fs.readFile(filePath, 'utf8');
              scopeDataMap[taskId] = JSON.parse(content);
            }
          }
        }

        return scopeDataMap;

      } catch (error) {
        if (error.code === 'ENOENT') {
          return {}; // 目录不存在，返回空对象
        }
        throw error;
      }

    } catch (error) {
      this.logger.error('Failed to load all task scope data', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 更新任务范围数据
   */
  async updateTaskScopeData(projectPath, taskId, updates) {
    try {
      const existingData = await this.loadTaskScopeData(projectPath, taskId);
      const updatedData = {
        ...existingData,
        ...updates,
        lastUpdated: new Date().toISOString()
      };

      await this.saveTaskScopeData(projectPath, taskId, updatedData);
      return updatedData;

    } catch (error) {
      this.logger.error('Failed to update task scope data', { 
        error: error.message, 
        taskId 
      });
      throw error;
    }
  }

  /**
   * 删除任务范围数据
   */
  async deleteTaskScopeData(projectPath, taskId) {
    try {
      const scopeFilePath = path.join(projectPath, '.taskmaster', 'scope-data', `task-${taskId}-scope.json`);
      await fs.unlink(scopeFilePath);
      
      this.logger.debug('Task scope data deleted', { taskId });

    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Failed to delete task scope data', { 
          error: error.message, 
          taskId 
        });
        throw error;
      }
    }
  }

  /**
   * 为任务关联PRD需求
   */
  async associateTaskWithRequirements(projectPath, taskId, requirementIds) {
    const scopeData = {
      prdRequirementIds: requirementIds,
      lastAssociated: new Date().toISOString()
    };

    return await this.updateTaskScopeData(projectPath, taskId, scopeData);
  }

  /**
   * 记录任务范围检查结果
   */
  async recordScopeCheckResult(projectPath, taskId, scopeCheckResult) {
    const scopeData = {
      scopeMetadata: {
        inScope: scopeCheckResult.inScope,
        confidence: scopeCheckResult.confidence,
        reasoning: scopeCheckResult.reasoning,
        riskLevel: scopeCheckResult.riskLevel,
        lastChecked: new Date().toISOString()
      },
      lastScopeCheck: scopeCheckResult
    };

    return await this.updateTaskScopeData(projectPath, taskId, scopeData);
  }

  /**
   * 关联变更请求到任务
   */
  async associateChangeRequest(projectPath, taskId, changeRequestId) {
    const existingData = await this.loadTaskScopeData(projectPath, taskId);
    const changeRequestIds = existingData.changeRequestIds || [];
    
    if (!changeRequestIds.includes(changeRequestId)) {
      changeRequestIds.push(changeRequestId);
    }

    const scopeData = {
      changeRequestIds,
      lastCRAssociated: new Date().toISOString()
    };

    return await this.updateTaskScopeData(projectPath, taskId, scopeData);
  }

  /**
   * 获取任务的完整范围信息
   */
  async getTaskScopeInfo(projectPath, taskId) {
    const scopeData = await this.loadTaskScopeData(projectPath, taskId);
    
    return {
      taskId,
      prdRequirementIds: scopeData.prdRequirementIds || [],
      scopeMetadata: scopeData.scopeMetadata || null,
      lastScopeCheck: scopeData.lastScopeCheck || null,
      changeRequestIds: scopeData.changeRequestIds || [],
      lastUpdated: scopeData.lastUpdated || null
    };
  }

  /**
   * 生成任务范围覆盖报告
   */
  async generateScopeCoverageReport(projectPath, tasks) {
    const scopeDataMap = await this.loadAllTaskScopeData(projectPath);
    
    const report = {
      totalTasks: tasks.length,
      tasksWithScopeData: 0,
      tasksWithRequirements: 0,
      tasksWithScopeCheck: 0,
      tasksWithChangeRequests: 0,
      scopeCompliance: 0,
      details: []
    };

    for (const task of tasks) {
      const scopeData = scopeDataMap[task.id] || {};
      const hasRequirements = scopeData.prdRequirementIds && scopeData.prdRequirementIds.length > 0;
      const hasScopeCheck = !!scopeData.scopeMetadata;
      const hasChangeRequests = scopeData.changeRequestIds && scopeData.changeRequestIds.length > 0;

      if (Object.keys(scopeData).length > 0) {
        report.tasksWithScopeData++;
      }

      if (hasRequirements) {
        report.tasksWithRequirements++;
      }

      if (hasScopeCheck) {
        report.tasksWithScopeCheck++;
      }

      if (hasChangeRequests) {
        report.tasksWithChangeRequests++;
      }

      report.details.push({
        taskId: task.id,
        title: task.title,
        hasRequirements,
        hasScopeCheck,
        hasChangeRequests,
        inScope: scopeData.scopeMetadata?.inScope,
        confidence: scopeData.scopeMetadata?.confidence,
        riskLevel: scopeData.scopeMetadata?.riskLevel
      });
    }

    report.scopeCompliance = report.totalTasks > 0 ? 
      (report.tasksWithScopeCheck / report.totalTasks * 100).toFixed(2) : 0;

    return report;
  }
}

export default TaskScopeAdapter;
