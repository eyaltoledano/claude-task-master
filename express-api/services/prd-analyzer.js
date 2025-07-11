/**
 * PRD需求分析器
 * 用于提取PRD中的核心需求点，建立需求基线
 */

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { generateObjectService } from '../../scripts/modules/ai-services-unified.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('prd-analyzer');

// PRD需求点数据结构
const PrdRequirementSchema = z.object({
  id: z.string().describe('需求唯一标识符'),
  title: z.string().describe('需求标题'),
  description: z.string().describe('需求详细描述'),
  category: z.enum(['functional', 'non-functional', 'technical', 'business']).describe('需求类别'),
  priority: z.enum(['high', 'medium', 'low']).describe('需求优先级'),
  scope: z.enum(['core', 'extended', 'optional']).describe('需求范围'),
  keywords: z.array(z.string()).describe('关键词列表'),
  dependencies: z.array(z.string()).describe('依赖的其他需求ID')
});

// PRD分析结果结构
const PrdAnalysisSchema = z.object({
  requirements: z.array(PrdRequirementSchema),
  metadata: z.object({
    projectName: z.string().optional(),
    version: z.string().optional(),
    analyzedAt: z.string(),
    totalRequirements: z.number(),
    coreRequirements: z.number(),
    extendedRequirements: z.number(),
    optionalRequirements: z.number()
  })
});

export class PrdAnalyzer {
  constructor() {
    this.logger = logger;
  }

  /**
   * 分析PRD文件，提取需求点
   */
  async analyzePrd(projectPath, prdFilePath) {
    try {
      this.logger.info('Starting PRD analysis', { projectPath, prdFilePath });

      // 读取PRD文件内容
      const prdContent = await fs.readFile(prdFilePath, 'utf8');
      
      // 使用AI分析PRD内容
      const analysis = await this._analyzeWithAI(prdContent, prdFilePath);
      
      // 保存分析结果
      const analysisPath = await this._saveAnalysis(projectPath, analysis);
      
      this.logger.info('PRD analysis completed', { 
        analysisPath, 
        requirementsCount: analysis.requirements.length 
      });

      return {
        success: true,
        data: analysis,
        analysisPath
      };

    } catch (error) {
      this.logger.error('PRD analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * 使用AI分析PRD内容
   */
  async _analyzeWithAI(prdContent, prdFilePath) {
    const systemPrompt = `你是一个专业的需求分析师。请分析提供的PRD文档，提取出所有的功能需求和非功能需求。

对于每个需求，请：
1. 分配唯一的ID（使用格式：REQ-001, REQ-002等）
2. 提取清晰的标题和描述
3. 分类为功能性、非功能性、技术性或业务性需求
4. 评估优先级（高、中、低）
5. 确定范围（核心、扩展、可选）
6. 提取关键词
7. 识别需求间的依赖关系

重点关注：
- 明确的功能描述
- 用户故事和用例
- 技术要求和约束
- 性能和质量要求
- 集成和接口需求

请确保需求提取的完整性和准确性，这将作为项目范围控制的基线。`;

    const userPrompt = `请分析以下PRD文档，提取所有需求点：

文件路径: ${prdFilePath}

PRD内容:
${prdContent}

请返回JSON格式的分析结果，包含所有识别的需求点。`;

    try {
      const response = await generateObjectService({
        role: 'main',
        schema: PrdAnalysisSchema,
        objectName: 'prd_analysis',
        systemPrompt,
        prompt: userPrompt,
        commandName: 'analyze-prd',
        outputType: 'json'
      });

      // 添加元数据
      const analysis = response.data;
      analysis.metadata = {
        ...analysis.metadata,
        analyzedAt: new Date().toISOString(),
        totalRequirements: analysis.requirements.length,
        coreRequirements: analysis.requirements.filter(r => r.scope === 'core').length,
        extendedRequirements: analysis.requirements.filter(r => r.scope === 'extended').length,
        optionalRequirements: analysis.requirements.filter(r => r.scope === 'optional').length
      };

      return analysis;

    } catch (error) {
      this.logger.error('AI analysis failed', { error: error.message });
      throw new Error(`PRD AI analysis failed: ${error.message}`);
    }
  }

  /**
   * 保存分析结果
   */
  async _saveAnalysis(projectPath, analysis) {
    const analysisDir = path.join(projectPath, '.taskmaster', 'analysis');
    await fs.mkdir(analysisDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const analysisPath = path.join(analysisDir, `prd-requirements-${timestamp}.json`);

    await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2), 'utf8');

    // 同时保存为最新版本
    const latestPath = path.join(analysisDir, 'prd-requirements-latest.json');
    await fs.writeFile(latestPath, JSON.stringify(analysis, null, 2), 'utf8');

    return analysisPath;
  }

  /**
   * 获取项目的PRD需求基线
   */
  async getRequirementsBaseline(projectPath) {
    try {
      const latestPath = path.join(projectPath, '.taskmaster', 'analysis', 'prd-requirements-latest.json');
      const content = await fs.readFile(latestPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // 没有分析结果
      }
      throw error;
    }
  }

  /**
   * 根据关键词匹配需求
   */
  matchRequirements(requirements, keywords) {
    const matches = [];
    
    for (const requirement of requirements) {
      let score = 0;
      
      // 检查标题匹配
      for (const keyword of keywords) {
        if (requirement.title.toLowerCase().includes(keyword.toLowerCase())) {
          score += 3;
        }
        if (requirement.description.toLowerCase().includes(keyword.toLowerCase())) {
          score += 2;
        }
        if (requirement.keywords.some(k => k.toLowerCase().includes(keyword.toLowerCase()))) {
          score += 1;
        }
      }
      
      if (score > 0) {
        matches.push({
          requirement,
          score,
          matchedKeywords: keywords.filter(k => 
            requirement.title.toLowerCase().includes(k.toLowerCase()) ||
            requirement.description.toLowerCase().includes(k.toLowerCase()) ||
            requirement.keywords.some(rk => rk.toLowerCase().includes(k.toLowerCase()))
          )
        });
      }
    }
    
    // 按匹配分数排序
    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * 检查需求覆盖度
   */
  checkRequirementsCoverage(requirements, tasks) {
    const coverage = {
      total: requirements.length,
      covered: 0,
      uncovered: [],
      coverage_percentage: 0
    };

    for (const requirement of requirements) {
      const iscovered = tasks.some(task => 
        task.prdRequirementIds && task.prdRequirementIds.includes(requirement.id)
      );

      if (iscovered) {
        coverage.covered++;
      } else {
        coverage.uncovered.push(requirement);
      }
    }

    coverage.coverage_percentage = (coverage.covered / coverage.total * 100).toFixed(2);
    return coverage;
  }
}

export default PrdAnalyzer;
