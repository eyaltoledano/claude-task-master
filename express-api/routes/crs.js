/**
 * 变更请求 (Change Requests) 路由
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { projectValidator } from '../middleware/project-validator.js';
import { createLogger } from '../utils/logger.js';

const router = express.Router({ mergeParams: true });
const logger = createLogger('crs-router');

// 项目验证中间件
router.use(projectValidator);

/**
 * 获取项目变更请求列表
 */
router.get('/', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const project = req.project;

        const changeRequestsDir = path.join(project.path, '.taskmaster', 'change-requests');

        try {
            const files = await fs.readdir(changeRequestsDir);
            const changeRequests = [];

            // 读取所有CR文件
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const filePath = path.join(changeRequestsDir, file);
                        const fileContent = await fs.readFile(filePath, 'utf8');
                        const crData = JSON.parse(fileContent);
                        changeRequests.push(crData);
                    } catch (error) {
                        logger.warn(`Failed to read change request file ${file}:`, error.message);
                    }
                }
            }

            // 按创建时间排序
            changeRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            res.json({
                success: true,
                data: {
                    changeRequests,
                    count: changeRequests.length,
                    projectId
                },
                message: 'Change requests retrieved successfully',
                projectId,
                requestId: req.requestId
            });

        } catch (error) {
            if (error.code === 'ENOENT') {
                // 目录不存在，返回空列表
                res.json({
                    success: true,
                    data: {
                        changeRequests: [],
                        count: 0,
                        projectId
                    },
                    message: 'No change requests found',
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
 * 获取特定变更请求详情
 */
router.get('/:crId', async (req, res, next) => {
    try {
        const { projectId, crId } = req.params;
        
        res.status(404).json({
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: `Change request ${crId} not found`
            },
            projectId,
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

export default router;
