import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import prdRoutes from './routes/prd.js';
import prsRoutes from './routes/prs.js';
import crsRoutes from './routes/crs.js';
import fileRoutes from './routes/files.js';
import globalRoutes from './routes/global.js';
import mcpRoutes from './routes/mcp.js';
import scopeManagementRoutes from './routes/scope-management.js';
import adminRoutes from './routes/admin.js';

import { errorHandler } from './middleware/error-handler.js';
import { getLockStatus } from './middleware/file-lock.js';
import { performanceMonitor, getPerformanceStatsHandler, resetPerformanceStatsHandler, healthCheckHandler } from './middleware/performance-monitor.js';
import { getCacheStatsHandler, clearCacheHandler } from './middleware/response-cache.js';
import { createLogger } from './utils/logger.js';
import ProjectManager from './utils/project-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('express-server');

class TaskMasterServer {
    constructor(config = {}) {
        this.app = express();
        this.port = config.port || 3000;
        this.host = config.host || '0.0.0.0';
        this.projectsDir = config.projectsDir ? path.resolve(config.projectsDir) : path.join(process.cwd(), 'projects');
        
        this.projectManager = new ProjectManager(this.projectsDir);
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // 安全中间件
        this.app.use(helmet());
        this.app.use(cors({
            origin: true, // 允许所有origin访问
            credentials: true,
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Project', 'X-Username', 'X-Password'],
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
        }));

        // 请求解析
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // 性能监控中间件
        this.app.use(performanceMonitor({
            logSlowRequests: true,
            slowRequestThreshold: 2000, // 2秒
            logAllRequests: false,
            collectMetrics: true
        }));

        // 请求ID和日志
        this.app.use((req, res, next) => {
            req.requestId = uuidv4();
            req.projectManager = this.projectManager;

            // 开发模式下打印详细的请求信息
            if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
                const projectId = req.headers['x-project'];
                const username = req.headers['x-username'];
                const password = req.headers['x-password'];

                if (projectId || username || password) {
                    console.log('🔍 [Express API] 接收到的请求头:');
                    console.log(`  📁 X-PROJECT: ${projectId || '(未设置)'}`);
                    console.log(`  👤 X-USERNAME: ${username || '(未设置)'}`);
                    console.log(`  🔐 X-PASSWORD: ${password ? '***' : '(未设置)'}`);
                    console.log(`  📍 请求路径: ${req.method} ${req.path}`);
                    console.log(`  🆔 请求ID: ${req.requestId}`);
                    console.log('');
                }
            }

            logger.info(`${req.method} ${req.path}`, {
                requestId: req.requestId,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                projectId: req.headers['x-project'],
                username: req.headers['x-username']
            });
            next();
        });
    }

    setupRoutes() {
        // 健康检查（增强版）
        this.app.get('/health', healthCheckHandler);



        // MCP路由 - 必须在API路由之前
        this.app.use('/mcp', mcpRoutes);

        // API路由
        this.app.use('/api', globalRoutes);
        this.app.use('/api/admin', adminRoutes);
        this.app.use('/api/projects', projectRoutes);
        this.app.use('/api/projects/:projectId/tasks', taskRoutes);
        this.app.use('/api/projects/:projectId/prd', prdRoutes);
        this.app.use('/api/projects/:projectId/prs', prsRoutes);
        this.app.use('/api/projects/:projectId/crs', crsRoutes);
        this.app.use('/api/projects/:projectId/files', fileRoutes);
        this.app.use('/api/projects/:projectId/scope', scopeManagementRoutes);

        // 锁状态查询
        this.app.get('/api/locks', getLockStatus);
        this.app.get('/api/projects/:projectId/locks', getLockStatus);

        // 性能统计
        this.app.get('/api/stats', getPerformanceStatsHandler);
        this.app.post('/api/stats/reset', resetPerformanceStatsHandler);

        // 缓存管理
        this.app.get('/api/cache', getCacheStatsHandler);
        this.app.delete('/api/cache', clearCacheHandler);

        // 根路径
        this.app.get('/', (req, res) => {
            res.json({
                name: 'TaskMaster Remote Server',
                version: '1.0.0',
                endpoints: {
                    health: '/health',
                    projects: '/api/projects',
                    tasks: '/api/projects/:projectId/tasks',
                    prd: '/api/projects/:projectId/prd',
                    files: '/api/projects/:projectId/files'
                }
            });
        });
    }

    setupErrorHandling() {
        // 404处理
        this.app.use((req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found',
                path: req.path,
                requestId: req.requestId
            });
        });

        // 全局错误处理
        this.app.use(errorHandler);
    }

    async start() {
        try {
            // 初始化项目管理器
            await this.projectManager.init();
            
            // 启动服务器
            this.server = this.app.listen(this.port, this.host, () => {
                logger.info(`TaskMaster Server started on ${this.host}:${this.port}`);
                logger.info(`Projects directory: ${this.projectsDir}`);
            });

            return this.server;
        } catch (error) {
            logger.error('Failed to start server', { error: error.message });
            throw error;
        }
    }

    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    logger.info('TaskMaster Server stopped');
                    resolve();
                });
            });
        }
    }
}

export default TaskMasterServer;

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new TaskMasterServer({
        port: process.env.PORT || 3000,
        projectsDir: process.env.PROJECTS_DIR || './projects'
    });

    // 优雅关闭
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

    server.start().catch((error) => {
        logger.error('Failed to start server', { error: error.message });
        process.exit(1);
    });
}
