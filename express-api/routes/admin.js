import express from 'express';
import { createLogger } from '../utils/logger.js';
import { getCacheManager } from '../utils/cache-manager.js';
import { clearCacheByPattern, clearProjectCache } from '../middleware/response-cache.js';

const router = express.Router();
const logger = createLogger('admin-router');
const cache = getCacheManager();

/**
 * 清理所有缓存
 */
router.post('/cache/clear', async (req, res, next) => {
    try {
        // 清理缓存管理器
        const cacheCleared = cache.clear();
        
        // 清理项目管理器内存缓存
        const projectManager = req.projectManager;
        const projectsCleared = projectManager.projects.size;
        projectManager.projects.clear();
        
        // 清理配置管理器缓存
        const configManager = req.projectManager.configManager;
        configManager.clearCache();
        
        // 重新加载项目
        await projectManager.loadExistingProjects();
        
        logger.info('All caches cleared', {
            cacheCleared,
            projectsCleared,
            requestId: req.requestId
        });
        
        res.json({
            success: true,
            data: {
                cacheCleared,
                projectsCleared,
                message: 'All caches cleared successfully'
            },
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * 清理项目相关缓存
 */
router.post('/cache/clear/projects', async (req, res, next) => {
    try {
        const { projectId } = req.body;
        
        let clearedCount = 0;
        
        if (projectId) {
            // 清理特定项目的缓存
            clearedCount = clearProjectCache(projectId);
            
            // 从项目管理器中移除
            const projectManager = req.projectManager;
            if (projectManager.projects.has(projectId)) {
                projectManager.projects.delete(projectId);
                clearedCount++;
            }
        } else {
            // 清理所有项目缓存
            clearedCount += clearCacheByPattern('projects:');
            clearedCount += clearCacheByPattern('tasks:');
            
            // 清理项目管理器内存缓存
            const projectManager = req.projectManager;
            clearedCount += projectManager.projects.size;
            projectManager.projects.clear();
            
            // 重新加载项目
            await projectManager.loadExistingProjects();
        }
        
        logger.info('Project caches cleared', {
            projectId,
            clearedCount,
            requestId: req.requestId
        });
        
        res.json({
            success: true,
            data: {
                clearedCount,
                projectId,
                message: projectId ? 
                    `Project ${projectId} cache cleared` : 
                    'All project caches cleared'
            },
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * 获取缓存统计信息
 */
router.get('/cache/stats', async (req, res, next) => {
    try {
        const cacheStats = cache.getStats();
        const projectManager = req.projectManager;
        
        const stats = {
            cache: cacheStats,
            projects: {
                inMemory: projectManager.projects.size,
                loaded: Array.from(projectManager.projects.keys())
            }
        };
        
        res.json({
            success: true,
            data: stats,
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

/**
 * 强制重新加载项目
 */
router.post('/projects/reload', async (req, res, next) => {
    try {
        const projectManager = req.projectManager;
        
        // 清理内存中的项目
        const oldCount = projectManager.projects.size;
        projectManager.projects.clear();
        
        // 重新加载项目
        await projectManager.loadExistingProjects();
        const newCount = projectManager.projects.size;
        
        logger.info('Projects reloaded', {
            oldCount,
            newCount,
            requestId: req.requestId
        });
        
        res.json({
            success: true,
            data: {
                oldCount,
                newCount,
                projects: Array.from(projectManager.projects.keys()),
                message: 'Projects reloaded successfully'
            },
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

export default router;
