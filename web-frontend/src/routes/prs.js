/**
 * routes/prs.js
 * Product Requirements (PR) API routes - READ-ONLY operations
 * Manages product requirements extracted from PRD documents
 */

import express from 'express';
import { z } from 'zod';
import { taskMasterService } from '../services/taskmaster-service.js';
import logger from '../utils/logger.js';

const router = express.Router({ mergeParams: true });

// Validation schemas
const getPrsSchema = z.object({
  scope: z.enum(['core', 'extended', 'optional']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  category: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional()
});

// ==================== PRODUCT REQUIREMENTS ROUTES ====================

/**
 * @swagger
 * /api/projects/{projectId}/prs:
 *   get:
 *     summary: 获取产品需求列表
 *     tags: [Product Requirements]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: 项目ID
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *           enum: [core, extended, optional]
 *         description: 需求范围筛选
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [high, medium, low]
 *         description: 优先级筛选
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: 分类筛选
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: 返回数量限制
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: 偏移量
 *     responses:
 *       200:
 *         description: 产品需求列表获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     requirements:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ProductRequirement'
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         totalRequirements:
 *                           type: integer
 *                         lastAnalyzed:
 *                           type: string
 *                           format: date-time
 *                         prdVersion:
 *                           type: string
 */
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.params;
    const queryParams = getPrsSchema.parse(req.query);
    
    const result = await taskMasterService.getProductRequirements(projectId);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    let requirements = result.data.requirements || [];

    // 应用筛选条件
    if (queryParams.scope) {
      requirements = requirements.filter(req => req.scope === queryParams.scope);
    }
    if (queryParams.priority) {
      requirements = requirements.filter(req => req.priority === queryParams.priority);
    }
    if (queryParams.category) {
      requirements = requirements.filter(req => req.category === queryParams.category);
    }

    // 应用分页
    const total = requirements.length;
    if (queryParams.offset) {
      requirements = requirements.slice(queryParams.offset);
    }
    if (queryParams.limit) {
      requirements = requirements.slice(0, queryParams.limit);
    }

    res.json({
      success: true,
      data: {
        requirements,
        metadata: {
          ...result.data.metadata,
          total,
          filtered: requirements.length,
          filters: queryParams
        }
      },
      mode: result.mode
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: error.errors
      });
    }
    
    logger.error(`获取产品需求列表失败 (项目: ${req.params.projectId}):`, error);
    res.status(500).json({
      success: false,
      error: '获取产品需求列表失败',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}/prs/{reqId}:
 *   get:
 *     summary: 获取特定产品需求详情
 *     tags: [Product Requirements]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: 项目ID
 *       - in: path
 *         name: reqId
 *         required: true
 *         schema:
 *           type: string
 *         description: 需求ID
 *     responses:
 *       200:
 *         description: 产品需求详情获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ProductRequirement'
 */
router.get('/:reqId', async (req, res) => {
  try {
    const { projectId, reqId } = req.params;
    const result = await taskMasterService.getProductRequirement(projectId, reqId);
    
    res.json({
      success: true,
      data: result.data,
      mode: result.mode
    });
  } catch (error) {
    logger.error(`获取产品需求详情失败 (项目: ${req.params.projectId}, 需求: ${req.params.reqId}):`, error);
    res.status(500).json({
      success: false,
      error: '获取产品需求详情失败',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}/prs/stats:
 *   get:
 *     summary: 获取产品需求统计信息
 *     tags: [Product Requirements]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: 项目ID
 *     responses:
 *       200:
 *         description: 产品需求统计信息获取成功
 */
router.get('/stats', async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await taskMasterService.getPrStats(projectId);
    
    res.json({
      success: true,
      data: result.data,
      mode: result.mode
    });
  } catch (error) {
    logger.error(`获取产品需求统计失败 (项目: ${req.params.projectId}):`, error);
    res.status(500).json({
      success: false,
      error: '获取产品需求统计失败',
      details: error.message
    });
  }
});

export default router;
