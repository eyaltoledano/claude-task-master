/**
 * routes/tags.js
 * Tag management API routes
 */

import express from 'express';
import { z } from 'zod';
import { taskMasterService } from '../services/taskmaster-service.js';
import { validateProjectRoot } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Validation schemas
const listTagsSchema = z.object({
  projectRoot: z.string(),
  file: z.string().optional(),
  showMetadata: z.boolean().optional()
});

/**
 * @swagger
 * /api/tags:
 *   get:
 *     summary: 获取标签列表
 *     tags: [Tags]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: 标签列表获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/tags', async (req, res) => {
  try {
    const result = await taskMasterService.listTags({
      projectRoot: req.projectRoot,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('获取标签列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取标签列表失败',
      details: error.message,
      requestId: req.requestId
    });
  }
});

export default router; 