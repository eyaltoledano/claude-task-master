/**
 * server.js
 * Main Task Master Web API server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swagger.js';
import { logger } from './utils/logger.js';
import { config } from './config/config.js';
import { apiKeyAuth as authMiddleware, validateProjectRoot as projectRootMiddleware, requestId as requestIdMiddleware } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// 基础中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors(config.cors));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求ID中间件
app.use(requestIdMiddleware);

// 速率限制
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: 'rate_limit_exceeded',
    message: '请求过于频繁，请稍后再试'
  }
});
app.use(limiter);

// 静态文件服务
app.use(express.static(join(__dirname, '../public')));

// API文档
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 导入路由模块
import projectsRouter from './routes/projects.js';
import prsRouter from './routes/prs.js';
import crsRouter from './routes/crs.js';
import tasksRouter from './routes/tasks.js';
import researchRouter from './routes/research.js';
import tagsRouter from './routes/tags.js';

// API路由注册
app.use('/api/projects', projectRootMiddleware, projectsRouter);
app.use('/api/projects/:projectId/prs', projectRootMiddleware, prsRouter);
app.use('/api/projects/:projectId/crs', projectRootMiddleware, crsRouter);
app.use('/api/projects/:projectId/tasks', projectRootMiddleware, tasksRouter);

// 保留现有的研究和标签路由（向后兼容）
app.use('/api/research', projectRootMiddleware, researchRouter);
app.use('/api/tags', projectRootMiddleware, tagsRouter);

// 调试路由 - 显示所有注册的路由
app.get('/debug/routes', (req, res) => {
  const routes = [];

  // 收集所有路由信息
  const collectRoutes = (stack, basePath = '') => {
    stack.forEach((layer) => {
      if (layer.route) {
        routes.push({
          path: basePath + layer.route.path,
          methods: Object.keys(layer.route.methods).map(m => m.toUpperCase())
        });
      } else if (layer.name === 'router' && layer.handle.stack) {
        // 提取路由器的基础路径
        let routerPath = '';
        if (layer.regexp && layer.regexp.source) {
          routerPath = layer.regexp.source
            .replace(/\\\//g, '/')
            .replace(/\^/g, '')
            .replace(/\$.*/, '')
            .replace(/\?\(\?\=/g, '')
            .replace(/\|.*/, '')
            .replace(/\).*/, '');
        }
        collectRoutes(layer.handle.stack, basePath + routerPath);
      }
    });
  };

  collectRoutes(app._router.stack);

  res.json({
    success: true,
    message: 'Available API routes for TaskMaster Web API',
    routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
    totalRoutes: routes.length,
    newApiStructure: {
      projects: '/api/projects',
      projectDetails: '/api/projects/:projectId',
      prd: '/api/projects/:projectId/prd',
      productRequirements: '/api/projects/:projectId/prs',
      changeRequests: '/api/projects/:projectId/crs',
      tasks: '/api/projects/:projectId/tasks'
    },
    timestamp: new Date().toISOString()
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'not_found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    requestId: req.requestId,
    availableRoutes: [
      '/health',
      '/api/projects',
      '/api/projects/:projectId',
      '/api/projects/:projectId/prd',
      '/api/projects/:projectId/prs',
      '/api/projects/:projectId/crs',
      '/api/projects/:projectId/tasks',
      '/api/research',
      '/api/tags',
      '/debug/routes',
      '/docs'
    ]
  });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  logger.error('服务器错误:', error);
  
  res.status(error.status || 500).json({
    success: false,
    error: error.code || 'internal_server_error',
    message: error.message || '服务器内部错误',
    requestId: req.requestId,
    ...(config.server.env === 'development' && { stack: error.stack })
  });
});

// 启动服务器
const server = app.listen(config.server.port, config.server.host, () => {
  logger.info('Task Master Web API server started', {
    host: config.server.host,
    port: config.server.port,
    environment: config.server.env,
    apiPrefix: config.api.prefix,
    documentation: `http://${config.server.host}:${config.server.port}/docs`,
    debugRoutes: `http://${config.server.host}:${config.server.port}/debug/routes`
  });
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，正在关闭服务器...');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，正在关闭服务器...');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

export default app;