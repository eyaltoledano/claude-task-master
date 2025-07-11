/**
 * routes/research.js
 * Research functionality API routes
 */

import express from 'express';
import { z } from 'zod';
import { taskMasterService } from '../services/taskmaster-service.js';
import { validateProjectRoot } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Validation schemas
const researchSchema = z.object({
  query: z.string(),
  taskIds: z.string().optional(),
  filePaths: z.string().optional(),
  customContext: z.string().optional(),
  includeProjectTree: z.boolean().optional(),
  detailLevel: z.enum(['low', 'medium', 'high']).optional(),
  saveTo: z.string().optional(),
  saveToFile: z.boolean().optional(),
  projectRoot: z.string()
});

/**
 * @swagger
 * /api/v1/research:
 *   post:
 *     summary: Perform AI-powered research
 *     description: Execute research queries with project context using AI
 *     tags: [Research]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 description: Research query/prompt
 *               taskIds:
 *                 type: string
 *                 description: Comma-separated list of task/subtask IDs for context
 *               filePaths:
 *                 type: string
 *                 description: Comma-separated list of file paths for context
 *               customContext:
 *                 type: string
 *                 description: Additional custom context text
 *               includeProjectTree:
 *                 type: boolean
 *                 description: Include project file tree structure in context
 *               detailLevel:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: Detail level for the research response
 *               saveTo:
 *                 type: string
 *                 description: Task or subtask ID to save research results to
 *               saveToFile:
 *                 type: boolean
 *                 description: Save research results to file
 *               projectRoot:
 *                 type: string
 *                 description: Project root directory
 *     responses:
 *       200:
 *         description: Research completed successfully
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
 *                     research:
 *                       type: object
 *                       description: Research results
 *       400:
 *         description: Invalid request data
 */
router.post('/', validateProjectRoot, async (req, res) => {
  try {
    const params = researchSchema.parse({
      ...req.body,
      projectRoot: req.projectRoot
    });

    logger.info('Performing research', { 
      query: params.query,
      taskIds: params.taskIds,
      requestId: req.requestId 
    });

    const result = await taskMasterService.research({
      ...params,
      requestId: req.requestId
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error in POST /research', { error: error.message, requestId: req.requestId });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router; 