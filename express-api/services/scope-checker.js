/**
 * PRD范围检查服务
 * 检查任务变更是否超出PRD定义的范围
 */

import { z } from 'zod';
import { generateObjectService } from '../../scripts/modules/ai-services-unified.js';
import { createLogger } from '../utils/logger.js';
import PrdAnalyzer from './prd-analyzer.js';

const logger = createLogger('scope-checker');

// 范围检查结果结构
const ScopeCheckResultSchema = z.object({
  inScope: z.boolean().describe('是否在PRD范围内'),
  confidence: z.number().min(0).max(1).describe('置信度 0-1'),
  reasoning: z.string().describe('判断理由'),
  matchedRequirements: z.array(z.string()).describe('匹配的需求ID'),
  suggestedRequirements: z.array(z.string()).describe('建议关联的需求ID'),
  riskLevel: z.enum(['low', 'medium', 'high']).describe('风险等级'),
  recommendations: z.array(z.string()).describe('建议措施')
});

export class ScopeChecker {
  constructor() {
    this.logger = logger;
    this.prdAnalyzer = new PrdAnalyzer();
  }

  /**
   * 检查任务是否在PRD范围内
   */
  async checkTaskScope(projectPath, task, operation = 'add') {
    try {
      this.logger.info('Checking task scope', { 
        projectPath, 
        taskId: task.id, 
        operation 
      });

      // 获取PRD需求基线
      const baseline = await this.prdAnalyzer.getRequirementsBaseline(projectPath);
      if (!baseline) {
        this.logger.warn('No PRD baseline found, skipping scope check');
        return {
          inScope: true,
          confidence: 0,
          reasoning: 'No PRD baseline available for comparison',
          skipCheck: true
        };
      }

      // 使用AI进行范围检查
      const result = await this._checkWithAI(baseline, task, operation);
      
      this.logger.info('Scope check completed', { 
        taskId: task.id, 
        inScope: result.inScope,
        confidence: result.confidence 
      });

      return result;

    } catch (error) {
      this.logger.error('Scope check failed', { error: error.message });
      throw error;
    }
  }

  /**
   * 批量检查多个任务的范围
   */
  async checkMultipleTasksScope(projectPath, tasks, operation = 'add') {
    const results = [];
    
    for (const task of tasks) {
      try {
        const result = await this.checkTaskScope(projectPath, task, operation);
        results.push({
          taskId: task.id,
          task,
          scopeCheck: result
        });
      } catch (error) {
        results.push({
          taskId: task.id,
          task,
          scopeCheck: {
            inScope: false,
            confidence: 0,
            reasoning: `Scope check failed: ${error.message}`,
            error: true
          }
        });
      }
    }

    return results;
  }

  /**
   * 使用AI进行范围检查
   */
  async _checkWithAI(baseline, task, operation) {
    const systemPrompt = `你是一个专业的项目范围管理专家。请根据PRD需求基线，判断给定的任务是否在项目范围内。

判断标准：
1. 任务是否直接支持已定义的需求
2. 任务是否与现有需求相关或衍生
3. 任务是否引入了新的功能或需求
4. 任务的复杂度是否合理
5. 任务是否可能导致范围蔓延

风险等级定义：
- low: 完全在范围内，直接支持现有需求
- medium: 部分超出范围，但与现有需求相关
- high: 明显超出范围，引入新需求或功能

请提供详细的分析和建议。`;

    const requirementsSummary = baseline.requirements.map(req => 
      `${req.id}: ${req.title} (${req.category}, ${req.scope})`
    ).join('\n');

    const userPrompt = `请分析以下任务是否在PRD范围内：

操作类型: ${operation}

PRD需求基线:
${requirementsSummary}

待检查任务:
- ID: ${task.id}
- 标题: ${task.title}
- 描述: ${task.description}
- 详细信息: ${task.details || 'N/A'}
- 测试策略: ${task.testStrategy || 'N/A'}

请分析这个任务是否在PRD定义的范围内，并提供详细的判断理由。`;

    try {
      const response = await generateObjectService({
        role: 'main',
        schema: ScopeCheckResultSchema,
        objectName: 'scope_check_result',
        systemPrompt,
        prompt: userPrompt,
        commandName: 'check-scope',
        outputType: 'json'
      });

      return response.data;

    } catch (error) {
      this.logger.error('AI scope check failed', { error: error.message });
      throw new Error(`Scope check AI analysis failed: ${error.message}`);
    }
  }

  /**
   * 检查任务变更的影响
   */
  async checkTaskChangeImpact(projectPath, originalTask, modifiedTask) {
    try {
      // 检查原任务和修改后任务的范围
      const [originalCheck, modifiedCheck] = await Promise.all([
        this.checkTaskScope(projectPath, originalTask, 'original'),
        this.checkTaskScope(projectPath, modifiedTask, 'modify')
      ]);

      // 分析变更影响
      const impact = {
        scopeChanged: originalCheck.inScope !== modifiedCheck.inScope,
        riskIncreased: this._compareRiskLevel(originalCheck.riskLevel, modifiedCheck.riskLevel) > 0,
        confidenceChanged: Math.abs(originalCheck.confidence - modifiedCheck.confidence) > 0.2,
        originalCheck,
        modifiedCheck,
        changeAnalysis: {
          titleChanged: originalTask.title !== modifiedTask.title,
          descriptionChanged: originalTask.description !== modifiedTask.description,
          detailsChanged: (originalTask.details || '') !== (modifiedTask.details || ''),
          testStrategyChanged: (originalTask.testStrategy || '') !== (modifiedTask.testStrategy || '')
        }
      };

      return impact;

    } catch (error) {
      this.logger.error('Change impact analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * 比较风险等级
   */
  _compareRiskLevel(level1, level2) {
    const levels = { low: 1, medium: 2, high: 3 };
    return levels[level2] - levels[level1];
  }

  /**
   * 生成范围检查报告
   */
  generateScopeReport(scopeResults) {
    const inScopeCount = scopeResults.filter(r => r.scopeCheck.inScope).length;
    const outOfScopeCount = scopeResults.length - inScopeCount;
    const highRiskCount = scopeResults.filter(r => r.scopeCheck.riskLevel === 'high').length;

    const report = {
      summary: {
        totalTasks: scopeResults.length,
        inScope: inScopeCount,
        outOfScope: outOfScopeCount,
        highRisk: highRiskCount,
        scopeCompliance: ((inScopeCount / scopeResults.length) * 100).toFixed(2)
      },
      details: scopeResults,
      recommendations: this._generateRecommendations(scopeResults),
      generatedAt: new Date().toISOString()
    };

    return report;
  }

  /**
   * 生成建议
   */
  _generateRecommendations(scopeResults) {
    const recommendations = [];
    
    const outOfScopeTasks = scopeResults.filter(r => !r.scopeCheck.inScope);
    const highRiskTasks = scopeResults.filter(r => r.scopeCheck.riskLevel === 'high');

    if (outOfScopeTasks.length > 0) {
      recommendations.push({
        type: 'scope_violation',
        message: `发现 ${outOfScopeTasks.length} 个超出PRD范围的任务，建议创建变更请求`,
        tasks: outOfScopeTasks.map(t => t.taskId)
      });
    }

    if (highRiskTasks.length > 0) {
      recommendations.push({
        type: 'high_risk',
        message: `发现 ${highRiskTasks.length} 个高风险任务，需要额外审查`,
        tasks: highRiskTasks.map(t => t.taskId)
      });
    }

    const lowConfidenceTasks = scopeResults.filter(r => r.scopeCheck.confidence < 0.6);
    if (lowConfidenceTasks.length > 0) {
      recommendations.push({
        type: 'low_confidence',
        message: `发现 ${lowConfidenceTasks.length} 个低置信度判断，建议人工审查`,
        tasks: lowConfidenceTasks.map(t => t.taskId)
      });
    }

    return recommendations;
  }
}

export default ScopeChecker;
