import express from 'express';
import { createLogger } from '../utils/logger.js';
import { projectValidator } from '../middleware/project-validator.js';
import { taskFileLockMiddleware } from '../middleware/file-lock.js';
import { scopeCheckMiddlewares } from '../middleware/scope-check.js';
import { taskListCache } from '../middleware/response-cache.js';
import { ValidationError, NotFoundError } from '../middleware/error-handler.js';
import TaskEnhancementService from '../services/task-enhancement.js';
import CoreAdapter from '../services/core-adapter.js';

const router = express.Router({ mergeParams: true });
const logger = createLogger('tasks-router');
const taskEnhancement = new TaskEnhancementService();
const coreAdapter = new CoreAdapter();

// 项目验证中间件
router.use(projectValidator);

// 文件锁中间件（用于写操作）
router.use(taskFileLockMiddleware());

// 获取任务列表（带缓存）
router.get('/', taskListCache(), async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { tag } = req.query;
        
        const project = req.project;
        const options = {
            tag: tag || 'main'
        };
        
        const result = await req.projectManager.coreAdapter.listTasks(projectId, options);

        // 增强任务数据，添加PRD范围信息（不修改原始数据）
        let enhancedTasks = result;
        if (result && Array.isArray(result.tasks)) {
            const enhanced = await taskEnhancement.enhanceTaskList(req.projectManager.getProjectPath(projectId), result.tasks);
            enhancedTasks = { ...result, tasks: enhanced };
        }

        res.json({
            success: true,
            data: enhancedTasks,
            projectId,
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

// 添加新任务
router.post('/', scopeCheckMiddlewares.addTask, async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { title, description, priority = 'medium', useManualData = false } = req.body;

        if (!title || !description) {
            throw new ValidationError('Title and description are required');
        }

        const project = req.project;
        const options = {
            useManualData: useManualData  // 默认使用AI生成，可通过参数覆盖
        };

        const result = await req.projectManager.coreAdapter.addTask(
            projectId,
            title,
            description,
            priority,
            options
        );

        res.status(201).json({
            success: true,
            data: result,
            message: 'Task added successfully',
            projectId,
            requestId: req.requestId
        });

    } catch (error) {
        next(error);
    }
});

// 获取下一个任务 - 必须在 /:taskId 路由之前定义
router.get('/next', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { status = 'pending' } = req.query;

        const project = req.project;
        const result = await req.projectManager.coreAdapter.getNextTask(
            projectId,
            { status }
        );

        res.json({
            success: true,
            data: result,
            message: result ? `Next task found` : 'No tasks available',
            projectId,
            requestId: req.requestId
        });

    } catch (error) {
        next(error);
    }
});

// 获取单个任务
router.get('/:taskId', async (req, res, next) => {
    try {
        const { projectId, taskId } = req.params;
        
        const project = req.project;
        const result = await req.projectManager.coreAdapter.listTasks(projectId);
        
        // 查找指定任务
        const task = result.tasks?.find(t => t.id === parseInt(taskId));
        
        if (!task) {
            throw new NotFoundError(`Task ${taskId} not found in project ${projectId}`);
        }
        
        res.json({
            success: true,
            data: task,
            projectId,
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

// 更新任务
router.put('/:taskId', async (req, res, next) => {
    try {
        const { projectId, taskId } = req.params;
        const updates = req.body;
        
        const project = req.project;
        const result = await req.projectManager.coreAdapter.updateTaskById(
            projectId,
            parseInt(taskId),
            updates
        );
        
        res.json({
            success: true,
            data: result,
            message: `Task ${taskId} updated successfully`,
            projectId,
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

// 删除任务
router.delete('/:taskId', async (req, res, next) => {
    try {
        const { projectId, taskId } = req.params;
        
        const project = req.project;
        const result = await req.projectManager.coreAdapter.removeTask(
            projectId,
            parseInt(taskId)
        );
        
        res.json({
            success: true,
            data: result,
            message: `Task ${taskId} deleted successfully`,
            projectId,
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

// 扩展任务
router.post('/:taskId/expand', scopeCheckMiddlewares.expandTask, async (req, res, next) => {
    try {
        const { projectId, taskId } = req.params;
        const { numSubtasks, useResearch } = req.body;
        
        const project = req.project;
        const options = {
            research: useResearch || false
        };
        
        const result = await req.projectManager.coreAdapter.expandTask(
            projectId,
            taskId,  // 传递字符串，让原始脚本自己处理parseInt
            numSubtasks,
            options
        );
        
        res.json({
            success: true,
            data: result,
            message: `Task ${taskId} expanded successfully`,
            projectId,
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

// 设置任务状态
router.put('/:taskId/status', async (req, res, next) => {
    try {
        const { projectId, taskId } = req.params;
        const { status } = req.body;
        
        if (!status) {
            throw new ValidationError('Status is required');
        }
        
        const project = req.project;
        const result = await req.projectManager.coreAdapter.setTaskStatus(
            projectId,
            parseInt(taskId),
            status
        );
        
        res.json({
            success: true,
            data: result,
            message: `Task ${taskId} status updated to ${status}`,
            projectId,
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

// 分析任务复杂度
router.post('/:taskId/analyze', async (req, res, next) => {
    try {
        const { projectId, taskId } = req.params;
        
        const project = req.project;
        const result = await req.projectManager.coreAdapter.analyzeTaskComplexity(
            projectId,
            parseInt(taskId)
        );
        
        res.json({
            success: true,
            data: result,
            message: `Task ${taskId} complexity analyzed`,
            projectId,
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

// 扩展所有任务
router.post('/expand-all', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { maxSubtasks = 5 } = req.body;

        const project = req.project;
        const result = await req.projectManager.coreAdapter.expandAllTasks(
            projectId,
            { maxSubtasks }
        );

        res.json({
            success: true,
            data: result,
            message: `All tasks expanded successfully`,
            projectId,
            requestId: req.requestId
        });

    } catch (error) {
        next(error);
    }
});

// 从PRD生成任务（兼容性路由，重定向到PRD解析）
router.post('/generate-from-prd', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { prdContent, numTasks = 10 } = req.body;

        if (!prdContent) {
            throw new ValidationError('prdContent is required');
        }

        const project = req.project;

        // 调用PRD解析功能
        const result = await coreAdapter.parsePRD(
            projectId,
            null, // 不使用文件路径，直接使用内容
            numTasks,
            {
                prdContent, // 传递PRD内容
                force: false,
                append: false,
                research: false
            }
        );

        res.json({
            success: true,
            data: result,
            message: 'Tasks generated from PRD successfully',
            projectId,
            requestId: req.requestId
        });

    } catch (error) {
        logger.error('Error generating tasks from PRD:', error);
        next(error);
    }
});

export default router;
