/**
 * 产品需求 (Product Requirements) 路由
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { projectValidator } from '../middleware/project-validator.js';
import { createLogger } from '../utils/logger.js';

const router = express.Router({ mergeParams: true });
const logger = createLogger('prs-router');

// 项目验证中间件
router.use(projectValidator);

/**
 * 获取项目产品需求列表
 */
router.get('/', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const project = req.project;

        const requirementsPath = path.join(project.path, '.taskmaster', 'product-requirements', 'requirements.json');

        try {
            const requirementsData = await fs.readFile(requirementsPath, 'utf8');
            const parsedData = JSON.parse(requirementsData);

            res.json({
                success: true,
                data: {
                    requirements: parsedData.requirements || [],
                    count: parsedData.requirements?.length || 0,
                    metadata: parsedData.metadata || {},
                    projectId
                },
                message: 'Product requirements retrieved successfully',
                projectId,
                requestId: req.requestId
            });

        } catch (error) {
            if (error.code === 'ENOENT') {
                // 文件不存在，返回空列表
                res.json({
                    success: true,
                    data: {
                        requirements: [],
                        count: 0,
                        projectId
                    },
                    message: 'No product requirements found',
                    projectId,
                    requestId: req.requestId
                });
            } else {
                throw error;
            }
        }

    } catch (error) {
        next(error);
    }
});

/**
 * 获取特定产品需求详情
 */
router.get('/:prId', async (req, res, next) => {
    try {
        const { projectId, prId } = req.params;
        
        res.status(404).json({
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: `Product requirement ${prId} not found`
            },
            projectId,
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

export default router;
