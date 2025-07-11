/**
 * 任务数据增强服务
 * 在不修改原始TaskMaster代码的情况下，为任务数据添加PRD范围管理功能
 */

import TaskScopeAdapter from '../adapters/task-scope-adapter.js';
import PrdAnalyzer from './prd-analyzer.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('task-enhancement');

export class TaskEnhancementService {
  constructor() {
    this.taskScopeAdapter = new TaskScopeAdapter();
    this.prdAnalyzer = new PrdAnalyzer();
    this.logger = logger;
  }

  /**
   * 增强单个任务数据，添加PRD范围信息
   */
  async enhanceTask(projectPath, task) {
    try {
      // 加载任务的范围数据
      const scopeData = await this.taskScopeAdapter.loadTaskScopeData(projectPath, task.id);
      
      // 使用适配器扩展任务数据
      const enhancedTask = this.taskScopeAdapter.extendTaskWithScopeData(task, scopeData);
      
      return enhancedTask;

    } catch (error) {
      this.logger.error('Failed to enhance task', { 
        error: error.message, 
        taskId: task.id 
      });
      // 如果增强失败，返回原始任务
      return task;
    }
  }

  /**
   * 增强任务列表
   */
  async enhanceTaskList(projectPath, tasks) {
    try {
      // 批量加载所有任务的范围数据
      const scopeDataMap = await this.taskScopeAdapter.loadAllTaskScopeData(projectPath);
      
      // 使用适配器批量扩展任务数据
      const enhancedTasks = this.taskScopeAdapter.extendTaskList(tasks, scopeDataMap);
      
      return enhancedTasks;

    } catch (error) {
      this.logger.error('Failed to enhance task list', { 
        error: error.message 
      });
      // 如果增强失败，返回原始任务列表
      return tasks;
    }
  }

  /**
   * 自动关联任务到PRD需求
   */
  async autoAssociateTasksToRequirements(projectPath, tasks) {
    try {
      // 获取PRD需求基线
      const baseline = await this.prdAnalyzer.getRequirementsBaseline(projectPath);
      if (!baseline) {
        this.logger.warn('No PRD baseline found, skipping auto-association');
        return;
      }

      const requirements = baseline.requirements;
      let associatedCount = 0;

      for (const task of tasks) {
        try {
          // 提取任务关键词
          const keywords = this._extractTaskKeywords(task);
          
          // 匹配相关需求
          const matches = this.prdAnalyzer.matchRequirements(requirements, keywords);
          
          if (matches.length > 0) {
            // 取前3个最匹配的需求
            const topMatches = matches.slice(0, 3);
            const requirementIds = topMatches.map(m => m.requirement.id);
            
            // 保存关联关系
            await this.taskScopeAdapter.associateTaskWithRequirements(
              projectPath, 
              task.id, 
              requirementIds
            );
            
            associatedCount++;
            
            this.logger.debug('Task auto-associated with requirements', {
              taskId: task.id,
              requirementIds,
              matchScores: topMatches.map(m => m.score)
            });
          }

        } catch (error) {
          this.logger.error('Failed to auto-associate task', {
            error: error.message,
            taskId: task.id
          });
        }
      }

      this.logger.info('Auto-association completed', {
        totalTasks: tasks.length,
        associatedTasks: associatedCount
      });

      return associatedCount;

    } catch (error) {
      this.logger.error('Auto-association failed', { error: error.message });
      throw error;
    }
  }

  /**
   * 生成任务范围报告
   */
  async generateTaskScopeReport(projectPath, tasks) {
    try {
      // 生成范围覆盖报告
      const coverageReport = await this.taskScopeAdapter.generateScopeCoverageReport(projectPath, tasks);
      
      // 获取PRD基线信息
      const baseline = await this.prdAnalyzer.getRequirementsBaseline(projectPath);
      
      // 计算需求覆盖度
      let requirementsCoverage = null;
      if (baseline) {
        requirementsCoverage = this.prdAnalyzer.checkRequirementsCoverage(
          baseline.requirements, 
          await this.enhanceTaskList(projectPath, tasks)
        );
      }

      const report = {
        summary: {
          totalTasks: coverageReport.totalTasks,
          scopeCompliance: parseFloat(coverageReport.scopeCompliance),
          tasksWithRequirements: coverageReport.tasksWithRequirements,
          tasksWithScopeCheck: coverageReport.tasksWithScopeCheck,
          tasksWithChangeRequests: coverageReport.tasksWithChangeRequests
        },
        requirementsCoverage,
        taskDetails: coverageReport.details,
        recommendations: this._generateRecommendations(coverageReport, requirementsCoverage),
        generatedAt: new Date().toISOString()
      };

      return report;

    } catch (error) {
      this.logger.error('Failed to generate task scope report', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 清理任务范围数据
   */
  async cleanupTaskScopeData(projectPath, existingTaskIds) {
    try {
      const scopeDataMap = await this.taskScopeAdapter.loadAllTaskScopeData(projectPath);
      let cleanedCount = 0;

      for (const taskId of Object.keys(scopeDataMap)) {
        const numericTaskId = parseInt(taskId, 10);
        if (!existingTaskIds.includes(numericTaskId)) {
          await this.taskScopeAdapter.deleteTaskScopeData(projectPath, numericTaskId);
          cleanedCount++;
        }
      }

      this.logger.info('Task scope data cleanup completed', {
        cleanedCount,
        remainingCount: Object.keys(scopeDataMap).length - cleanedCount
      });

      return cleanedCount;

    } catch (error) {
      this.logger.error('Failed to cleanup task scope data', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 提取任务关键词
   */
  _extractTaskKeywords(task) {
    const text = `${task.title} ${task.description} ${task.details || ''}`.toLowerCase();
    
    // 简单的关键词提取（可以后续优化为更智能的NLP处理）
    const words = text.match(/\b\w{3,}\b/g) || [];
    
    // 过滤常见词汇
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use']);
    
    const keywords = words.filter(word => 
      word.length >= 3 && 
      !stopWords.has(word) &&
      !/^\d+$/.test(word) // 排除纯数字
    );

    // 去重并返回
    return [...new Set(keywords)];
  }

  /**
   * 生成改进建议
   */
  _generateRecommendations(coverageReport, requirementsCoverage) {
    const recommendations = [];

    if (coverageReport.scopeCompliance < 50) {
      recommendations.push({
        type: 'low_compliance',
        priority: 'high',
        message: '任务范围合规性较低，建议对所有任务进行范围检查'
      });
    }

    if (coverageReport.tasksWithRequirements < coverageReport.totalTasks * 0.7) {
      recommendations.push({
        type: 'missing_requirements',
        priority: 'medium',
        message: '部分任务缺少PRD需求关联，建议运行自动关联或手动关联'
      });
    }

    if (requirementsCoverage && requirementsCoverage.coverage_percentage < 80) {
      recommendations.push({
        type: 'incomplete_coverage',
        priority: 'medium',
        message: `PRD需求覆盖度为${requirementsCoverage.coverage_percentage}%，建议检查未覆盖的需求`
      });
    }

    if (coverageReport.tasksWithChangeRequests > 0) {
      recommendations.push({
        type: 'pending_changes',
        priority: 'low',
        message: `有${coverageReport.tasksWithChangeRequests}个任务关联了变更请求，建议及时处理`
      });
    }

    return recommendations;
  }
}

export default TaskEnhancementService;
