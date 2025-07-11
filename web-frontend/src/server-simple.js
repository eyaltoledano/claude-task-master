import express from 'express';
import cors from 'cors';
import { config } from './config/config.js';

const app = express();

// 基础中间件
app.use(cors());
app.use(express.json());

// 简单的请求ID中间件
app.use((req, res, next) => {
  req.requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  next();
});

// 简单的认证中间件
const simpleAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== 'test-api-key-123') {
    return res.status(401).json({
      success: false,
      error: 'unauthorized',
      message: 'API密钥无效或缺失'
    });
  }
  next();
};

// 项目根目录中间件
const projectRootMiddleware = (req, res, next) => {
  req.projectRoot = '/Users/liuqinwang/workspace/PycharmProjects/claude-task-master';
  next();
};

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// 测试路由
app.get('/api/tasks', simpleAuth, projectRootMiddleware, (req, res) => {
  res.json({
    success: true,
    message: '任务路由工作正常',
    data: { tasks: [] }
  });
});

app.get('/api/tags', simpleAuth, projectRootMiddleware, (req, res) => {
  res.json({
    success: true,
    message: '标签路由工作正常',
    data: { tags: [] }
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'not_found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// 启动服务器
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`测试任务API: curl -H "X-API-Key: test-api-key-123" http://localhost:${PORT}/api/tasks`);
}); 