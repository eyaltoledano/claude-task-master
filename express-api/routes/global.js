/**
 * 全局API路由
 * 处理不需要项目上下文的全局操作
 */

import express from 'express';
import { createLogger } from '../utils/logger.js';

const router = express.Router();
const logger = createLogger('global-router');

// 获取模型配置
router.get('/models', async (req, res, next) => {
    try {
        const configManager = req.projectManager?.configManager;
        if (!configManager) {
            return res.status(500).json({
                success: false,
                error: 'Configuration manager not available',
                requestId: req.requestId
            });
        }

        const globalConfig = configManager.getGlobalConfig();
        
        res.json({
            success: true,
            data: {
                models: globalConfig.models,
                currentModel: globalConfig.models.main
            },
            message: 'Models configuration retrieved successfully',
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

// 获取规则配置
router.get('/rules', async (req, res, next) => {
    try {
        const configManager = req.projectManager?.configManager;
        if (!configManager) {
            return res.status(500).json({
                success: false,
                error: 'Configuration manager not available',
                requestId: req.requestId
            });
        }

        const globalConfig = configManager.getGlobalConfig();
        
        // 默认规则配置
        const rules = globalConfig.rules || {
            taskNaming: {
                pattern: '^[A-Z][a-zA-Z0-9\\s-_]+$',
                maxLength: 100,
                minLength: 5
            },
            taskDescription: {
                maxLength: 500,
                minLength: 10,
                required: true
            },
            priorities: ['low', 'medium', 'high', 'urgent'],
            statuses: ['pending', 'in-progress', 'completed', 'cancelled'],
            maxSubtasks: 10,
            maxDependencies: 5
        };
        
        res.json({
            success: true,
            data: { rules },
            message: 'Rules configuration retrieved successfully',
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

// 更新模型配置
router.put('/models', async (req, res, next) => {
    try {
        const { models } = req.body;
        
        if (!models) {
            return res.status(400).json({
                success: false,
                error: 'Models configuration is required',
                requestId: req.requestId
            });
        }
        
        const configManager = req.configManager;
        const globalConfig = configManager.getGlobalConfig();
        
        // 更新模型配置
        globalConfig.models = { ...globalConfig.models, ...models };
        await configManager.saveGlobalConfig(globalConfig);
        
        res.json({
            success: true,
            data: { models: globalConfig.models },
            message: 'Models configuration updated successfully',
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

// 更新规则配置
router.put('/rules', async (req, res, next) => {
    try {
        const { rules } = req.body;
        
        if (!rules) {
            return res.status(400).json({
                success: false,
                error: 'Rules configuration is required',
                requestId: req.requestId
            });
        }
        
        const configManager = req.configManager;
        const globalConfig = configManager.getGlobalConfig();
        
        // 更新规则配置
        globalConfig.rules = { ...globalConfig.rules, ...rules };
        await configManager.saveGlobalConfig(globalConfig);
        
        res.json({
            success: true,
            data: { rules: globalConfig.rules },
            message: 'Rules configuration updated successfully',
            requestId: req.requestId
        });
        
    } catch (error) {
        next(error);
    }
});

export default router;
