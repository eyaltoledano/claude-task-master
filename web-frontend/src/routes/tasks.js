/**
 * routes/tasks.js
 * Task management API routes - READ-ONLY operations
 * Provides task viewing and querying functionality
 */

import express from 'express';
import { z } from 'zod';
import { taskMasterService } from '../services/taskmaster-service.js';
import logger from '../utils/logger.js';

const router = express.Router({ mergeParams: true });

// Validation schemas
const getTasksSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'done', 'blocked']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  withSubtasks: z.boolean().optional(),
  tag: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional()
});

const generateFromPrdSchema = z.object({
  prdContent: z.string().min(1, 'PRD content is required'),
  numTasks: z.number().min(1).max(50).optional().default(10)
});

// ==================== TASK MANAGEMENT ROUTES (READ-ONLY) ====================

/**
 * @swagger
 * /api/projects/{projectId}/tasks:
 *   get:
 *     summary: 获取任务列表
 *     tags: [Tasks]
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
 *           enum: [pending, in_progress, done, blocked]
 *         description: 按状态过滤任务
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [high, medium, low]
 *         description: 按优先级过滤任务
 *       - in: query
 *         name: withSubtasks
 *         schema:
 *           type: boolean
 *         description: 是否包含子任务
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: 指定标签上下文
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
 *         description: 任务列表获取成功
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
 *                     tasks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Task'
 *                     meta:
 *                       type: object
 */
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.params;
    const queryParams = getTasksSchema.parse(req.query);

    const result = await taskMasterService.getTasks({
      projectId,
      ...queryParams
    });

    res.json({
      success: true,
      data: result.data,
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

    logger.error(`获取任务列表失败 (项目: ${req.params.projectId}):`, error);
    res.status(500).json({
      success: false,
      error: '获取任务列表失败',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}/tasks/stats:
 *   get:
 *     summary: 获取任务统计信息
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: 项目ID
 *     responses:
 *       200:
 *         description: 任务统计信息获取成功
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
 *                     total:
 *                       type: integer
 *                     byStatus:
 *                       type: object
 *                     byPriority:
 *                       type: object
 */
router.get('/stats', async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await taskMasterService.getTaskStats(projectId);

    res.json({
      success: true,
      data: result.data,
      mode: result.mode
    });
  } catch (error) {
    logger.error(`获取任务统计失败 (项目: ${req.params.projectId}):`, error);
    res.status(500).json({
      success: false,
      error: '获取任务统计失败',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}/tasks/next:
 *   get:
 *     summary: 获取下一个推荐任务
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: 项目ID
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: 指定标签上下文
 *     responses:
 *       200:
 *         description: 下一个推荐任务获取成功
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
 *                     nextTask:
 *                       $ref: '#/components/schemas/Task'
 */
router.get('/next', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { tag } = req.query;

    const result = await taskMasterService.getNextTask({
      projectId,
      tag
    });

    res.json({
      success: true,
      data: result.data,
      mode: result.mode
    });
  } catch (error) {
    logger.error(`获取下一个任务失败 (项目: ${req.params.projectId}):`, error);
    res.status(500).json({
      success: false,
      error: '获取下一个任务失败',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}/tasks/{taskId}:
 *   get:
 *     summary: 获取特定任务详情
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: 项目ID
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: 任务ID
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: 指定标签上下文
 *     responses:
 *       200:
 *         description: 任务详情获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Task'
 */
router.get('/:taskId', async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const { tag } = req.query;

    const result = await taskMasterService.getTask({
      id: taskId,
      projectId,
      tag
    });

    res.json({
      success: true,
      data: result.data,
      mode: result.mode
    });
  } catch (error) {
    logger.error(`获取任务详情失败 (项目: ${req.params.projectId}, 任务: ${req.params.taskId}):`, error);
    res.status(500).json({
      success: false,
      error: '获取任务详情失败',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/projects/{projectId}/tasks/generate-from-prd:
 *   post:
 *     summary: 从PRD生成任务
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: 项目ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prdContent
 *             properties:
 *               prdContent:
 *                 type: string
 *                 description: PRD文档内容
 *               numTasks:
 *                 type: integer
 *                 description: 期望生成的任务数量
 *                 default: 10
 *                 minimum: 1
 *                 maximum: 50
 *     responses:
 *       200:
 *         description: 任务生成成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     tasks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Task'
 */
router.post('/generate-from-prd', async (req, res) => {
  try {
    const { projectId } = req.params;
    const validatedData = generateFromPrdSchema.parse(req.body);

    // 调用taskMasterService的parsePrd方法
    const result = await taskMasterService.parsePrd(projectId, {
      input: validatedData.prdContent,
      numTasks: validatedData.numTasks,
      force: false
    });

    res.json({
      success: true,
      message: '任务生成成功',
      data: result.data,
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

    logger.error(`从PRD生成任务失败 (项目: ${req.params.projectId}):`, error);
    res.status(500).json({
      success: false,
      error: '从PRD生成任务失败',
      details: error.message
    });
  }
});

export default router;