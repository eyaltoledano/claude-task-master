/**
 * routes/crs.js
 * Change Requests (CR) API routes - READ-ONLY operations
 * Manages change requests that exceed PRD scope
 */

import express from 'express';
import { z } from 'zod';
import { taskMasterService } from '../services/taskmaster-service.js';
import logger from '../utils/logger.js';

const router = express.Router({ mergeParams: true });

// Validation schemas
const getCrsSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'implemented']).optional(),
  type: z.enum(['scope_expansion', 'requirement_change', 'task_modification']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional()
});

// ==================== CHANGE REQUESTS ROUTES ====================

/**
 * @swagger
 * /api/projects/{projectId}/crs:
 *   get:
 *     summary: 获取变更请求列表
 *     tags: [Change Requests]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: 项目ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, implemented]
 *         description: 状态筛选
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [scope_expansion, requirement_change, task_modification]
 *         description: 类型筛选
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [high, medium, low]
 *         description: 优先级筛选
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
 *         description: 变更请求列表获取成功
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
 *                     changeRequests:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ChangeRequest'
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         totalChangeRequests:
 *                           type: integer
 *                         pendingCount:
 *                           type: integer
 *                         approvedCount:
 *                           type: integer
 */
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.params;
    const queryParams = getCrsSchema.parse(req.query);
    
    const result = await taskMasterService.getChangeRequests(projectId);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    let changeRequests = result.data.changeRequests || [];

    // 应用筛选条件
    if (queryParams.status) {
      changeRequests = changeRequests.filter(cr => cr.status === queryParams.status);
    }
    if (queryParams.type) {
      changeRequests = changeRequests.filter(cr => cr.type === queryParams.type);
    }
    if (queryParams.priority) {
      changeRequests = changeRequests.filter(cr => cr.priority === queryParams.priority);
    }

    // 应用分页
    const total = changeRequests.length;
    if (queryParams.offset) {
      changeRequests = changeRequests.slice(queryParams.offset);
    }
    if (queryParams.limit) {
      changeRequests = changeRequests.slice(0, queryParams.limit);
    }

    res.json({
      success: true,
      data: {
        changeRequests,
        metadata: {
          ...result.data.metadata,
          total,
          filtered: changeRequests.length,
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
    
    logger.error(`获取变更请求列表失败 (项目: ${req.params.projectId}):`, error);
    res.status(500).json({
      success: false,
      error: '获取变更请求列表失败',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}/crs/{crId}:
 *   get:
 *     summary: 获取特定变更请求详情
 *     tags: [Change Requests]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: 项目ID
 *       - in: path
 *         name: crId
 *         required: true
 *         schema:
 *           type: string
 *         description: 变更请求ID
 *     responses:
 *       200:
 *         description: 变更请求详情获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ChangeRequest'
 */
router.get('/:crId', async (req, res) => {
  try {
    const { projectId, crId } = req.params;
    const result = await taskMasterService.getChangeRequest(projectId, crId);
    
    res.json({
      success: true,
      data: result.data,
      mode: result.mode
    });
  } catch (error) {
    logger.error(`获取变更请求详情失败 (项目: ${req.params.projectId}, 变更请求: ${req.params.crId}):`, error);
    res.status(500).json({
      success: false,
      error: '获取变更请求详情失败',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}/crs/stats:
 *   get:
 *     summary: 获取变更请求统计信息
 *     tags: [Change Requests]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: 项目ID
 *     responses:
 *       200:
 *         description: 变更请求统计信息获取成功
 */
router.get('/stats', async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await taskMasterService.getCrStats(projectId);
    
    res.json({
      success: true,
      data: result.data,
      mode: result.mode
    });
  } catch (error) {
    logger.error(`获取变更请求统计失败 (项目: ${req.params.projectId}):`, error);
    res.status(500).json({
      success: false,
      error: '获取变更请求统计失败',
      details: error.message
    });
  }
});

export default router;
