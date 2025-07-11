#!/usr/bin/env node

// 加载环境变量
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取项目根目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 确保使用正确的项目根目录（在加载 .env 之前设置，以防 .env 中没有此变量）
if (!process.env.TASK_MASTER_PROJECT_ROOT) {
    process.env.TASK_MASTER_PROJECT_ROOT = projectRoot;
}

// 加载 .env 文件
dotenv.config({ path: path.join(projectRoot, '.env') });

import TaskMasterServer from './app.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('startup');

async function main() {
    try {
        // 验证必要的环境变量
        const requiredEnvVars = ['OPENROUTER_API_KEY'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

        if (missingVars.length > 0) {
            logger.warn('Missing environment variables:', missingVars);
            logger.warn('Please check your .env file. Server will continue but some features may not work.');
        }

        // 验证项目根目录设置
        logger.info('Project root directory:', process.env.TASK_MASTER_PROJECT_ROOT);
        logger.info('Current working directory:', process.cwd());

        // 配置服务器
        const config = {
            port: parseInt(process.env.PORT) || 3000,
            host: process.env.HOST || '0.0.0.0',
            projectsDir: process.env.PROJECTS_DIR || '../projects',
            nodeEnv: process.env.NODE_ENV || 'development',
            logLevel: process.env.LOG_LEVEL || 'info',
            debug: process.env.DEBUG === 'true'
        };

        // 设置日志级别
        if (config.logLevel) {
            logger.level = config.logLevel;
        }

        logger.info('Starting TaskMaster Remote Server...', {
            port: config.port,
            host: config.host,
            projectsDir: config.projectsDir,
            nodeEnv: config.nodeEnv,
            logLevel: config.logLevel,
            debug: config.debug
        });

        // 创建并启动服务器
        const server = new TaskMasterServer(config);
        
        // 优雅关闭处理
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down gracefully...');
            await server.stop();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down gracefully...');
            await server.stop();
            process.exit(0);
        });

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception', { error: error.message, stack: error.stack });
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled rejection', { reason, promise });
            process.exit(1);
        });

        // 启动服务器
        await server.start();
        
        logger.info('TaskMaster Remote Server is ready!');
        logger.info(`Health check: http://${config.host}:${config.port}/health`);
        logger.info(`API docs: http://${config.host}:${config.port}/`);

    } catch (error) {
        logger.error('Failed to start server', { error: error.message, stack: error.stack });
        process.exit(1);
    }
}

// 运行主函数
main();
