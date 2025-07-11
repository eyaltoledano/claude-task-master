import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { taskMasterService } from './services/taskmaster-service.js';
import { config } from './config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// 配置文件上传
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// 基础中间件
app.use(cors());
app.use(express.json());

// 请求ID中间件
app.use((req, res, next) => {
  req.requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// 静态文件服务 - 提供public目录下的文件
app.use(express.static(join(__dirname, '../public')));

// 简单日志
const log = {
  info: (msg, meta) => console.log(`INFO: ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`ERROR: ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`WARN: ${msg}`, meta || ''),
  debug: (msg, meta) => console.log(`DEBUG: ${msg}`, meta || '')
};

// 项目根目录中间件
const projectRoot = (req, res, next) => {
  req.projectRoot = config.taskmaster.projectRoot;
  next();
};

// ========== 基础路由 ==========
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    taskMasterIntegrated: taskMasterService.initialized
  });
});

// 导入路由模块
import projectsRouter from './routes/projects.js';
import prsRouter from './routes/prs.js';
import crsRouter from './routes/crs.js';
import tasksRouter from './routes/tasks.js';
import researchRouter from './routes/research.js';
import tagsRouter from './routes/tags.js';

// ========== 新的API路由结构 ==========
app.use('/api/projects', projectRoot, projectsRouter);
app.use('/api/projects/:projectId/prs', projectRoot, prsRouter);
app.use('/api/projects/:projectId/crs', projectRoot, crsRouter);
app.use('/api/projects/:projectId/tasks', projectRoot, tasksRouter);

// 保留现有的研究和标签路由（向后兼容）
app.use('/api/research', projectRoot, researchRouter);
app.use('/api/tags', projectRoot, tagsRouter);

// ========== 向后兼容的旧路由（将被弃用）==========
app.get('/api/tasks', projectRoot, async (req, res) => {
  try {
    // 重定向到新的项目任务API
    res.status(301).json({
      success: false,
      error: 'deprecated_endpoint',
      message: '此端点已弃用，请使用 /api/projects/{projectId}/tasks',
      newEndpoint: '/api/projects/{projectId}/tasks',
      requestId: req.requestId
    });
  } catch (error) {
    log.error('获取任务列表失败', error.message);
    res.status(500).json({
      success: false,
      error: '获取任务列表失败',
      details: error.message,
      requestId: req.requestId
    });
  }
});

app.get('/api/tasks/next', projectRoot, async (req, res) => {
  res.status(301).json({
    success: false,
    error: 'deprecated_endpoint',
    message: '此端点已弃用，请使用 /api/projects/{projectId}/tasks/next',
    newEndpoint: '/api/projects/{projectId}/tasks/next',
    requestId: req.requestId
  });
});

app.get('/api/tasks/:id', projectRoot, async (req, res) => {
  res.status(301).json({
    success: false,
    error: 'deprecated_endpoint',
    message: '此端点已弃用，请使用 /api/projects/{projectId}/tasks/{taskId}',
    newEndpoint: '/api/projects/{projectId}/tasks/{taskId}',
    requestId: req.requestId
  });
});

app.post('/api/tasks', projectRoot, async (req, res) => {
  res.status(410).json({
    success: false,
    error: 'deprecated_endpoint',
    message: '此端点已弃用。任务创建现在通过PRD解析完成，请使用 /api/projects/{projectId}/prd/parse',
    newEndpoint: '/api/projects/{projectId}/prd/parse',
    requestId: req.requestId
  });
});

app.put('/api/tasks/:id/status', projectRoot, async (req, res) => {
  res.status(410).json({
    success: false,
    error: 'deprecated_endpoint',
    message: '此端点已弃用。Web API现在是只读的，任务状态更新请使用MCP工具',
    suggestion: 'Use MCP tools for task status updates',
    requestId: req.requestId
  });
});

app.post('/api/tasks/:id/expand', projectRoot, async (req, res) => {
  res.status(410).json({
    success: false,
    error: 'deprecated_endpoint',
    message: '此端点已弃用。Web API现在是只读的，任务展开请使用MCP工具',
    suggestion: 'Use MCP tools for task expansion',
    requestId: req.requestId
  });
});

// ========== 项目管理路由 ==========
app.get('/api/projects', projectRoot, async (req, res) => {
  try {
    // 返回项目相关信息
    res.json({
      success: true,
      data: {
        projects: [{
          id: 'current',
          name: 'Task Master CLI',
          description: 'Current project context',
          status: 'active',
          created: new Date().toISOString()
        }],
        currentProject: 'current',
        service: 'web-api'
      },
      requestId: req.requestId
    });
  } catch (error) {
    log.error('获取项目列表失败', error.message);
    res.status(500).json({
      success: false,
      error: '获取项目列表失败',
      details: error.message,
      requestId: req.requestId
    });
  }
});

app.post('/api/projects/initialize', projectRoot, async (req, res) => {
  try {
    const result = await taskMasterService.initializeProject({
      ...req.body,
      projectRoot: req.projectRoot,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      message: '项目初始化成功',
      data: result.data,
      requestId: req.requestId
    });
  } catch (error) {
    log.error('项目初始化失败', error.message);
    res.status(500).json({
      success: false,
      error: '项目初始化失败',
      details: error.message,
      requestId: req.requestId
    });
  }
});

app.post('/api/projects/parse-prd', projectRoot, async (req, res) => {
  try {
    const result = await taskMasterService.parsePrd({
      ...req.body,
      projectRoot: req.projectRoot,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      message: 'PRD解析成功',
      data: result.data,
      requestId: req.requestId
    });
  } catch (error) {
    log.error('PRD解析失败', error.message);
    res.status(500).json({
      success: false,
      error: 'PRD解析失败',
      details: error.message,
      requestId: req.requestId
    });
  }
});

app.post('/api/projects/parse-prd-file', projectRoot, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传PRD文件',
        requestId: req.requestId
      });
    }

    // 读取上传的文件内容
    const fs = await import('fs');
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    
    // 清理临时文件
    fs.unlinkSync(req.file.path);
    
    const result = await taskMasterService.parsePrd({
      input: fileContent,
      numTasks: req.body.numTasks ? parseInt(req.body.numTasks) : undefined,
      force: req.body.force === 'true',
      tag: req.body.tag,
      projectRoot: req.projectRoot,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      message: 'PRD文件解析成功',
      data: result.data,
      requestId: req.requestId
    });
  } catch (error) {
    // 清理临时文件（如果存在）
    if (req.file) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cleanupError) {
        log.warn('清理临时文件失败', cleanupError.message);
      }
    }
    
    log.error('PRD文件解析失败', error.message);
    res.status(500).json({
      success: false,
      error: 'PRD文件解析失败',
      details: error.message,
      requestId: req.requestId
    });
  }
});

// ========== 标签管理路由 ==========
app.get('/api/tags', projectRoot, async (req, res) => {
  try {
    const result = await taskMasterService.listTags({
      projectRoot: req.projectRoot,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      data: result.data,
      requestId: req.requestId
    });
  } catch (error) {
    log.error('获取标签列表失败', error.message);
    res.status(500).json({
      success: false,
      error: '获取标签列表失败',
      details: error.message,
      requestId: req.requestId
    });
  }
});

// ========== AI研究路由 ==========
app.post('/api/research', projectRoot, async (req, res) => {
  try {
    const result = await taskMasterService.research({
      ...req.body,
      projectRoot: req.projectRoot,
      requestId: req.requestId
    });
    
    res.json({
      success: true,
      message: '研究查询完成',
      data: result.data,
      requestId: req.requestId
    });
  } catch (error) {
    log.error('AI研究失败', error.message);
    res.status(500).json({
      success: false,
      error: 'AI研究失败',
      details: error.message,
      requestId: req.requestId
    });
  }
});

// ========== 调试路由 ==========
app.get('/debug/routes', (req, res) => {
  res.json({
    success: true,
    message: 'TaskMaster Web API - New Project-Based Structure',
    newApiStructure: {
      projects: {
        list: 'GET /api/projects',
        create: 'POST /api/projects',
        details: 'GET /api/projects/:projectId',
        prd: {
          view: 'GET /api/projects/:projectId/prd',
          upload: 'POST /api/projects/:projectId/prd/upload',
          parse: 'POST /api/projects/:projectId/prd/parse'
        },
        productRequirements: {
          list: 'GET /api/projects/:projectId/prs',
          details: 'GET /api/projects/:projectId/prs/:reqId',
          stats: 'GET /api/projects/:projectId/prs/stats'
        },
        changeRequests: {
          list: 'GET /api/projects/:projectId/crs',
          details: 'GET /api/projects/:projectId/crs/:crId',
          stats: 'GET /api/projects/:projectId/crs/stats'
        },
        tasks: {
          list: 'GET /api/projects/:projectId/tasks',
          details: 'GET /api/projects/:projectId/tasks/:taskId',
          next: 'GET /api/projects/:projectId/tasks/next',
          stats: 'GET /api/projects/:projectId/tasks/stats'
        }
      }
    },
    deprecatedEndpoints: {
      '/api/tasks': 'Use /api/projects/{projectId}/tasks',
      '/api/tasks/:id': 'Use /api/projects/{projectId}/tasks/{taskId}',
      '/api/tasks/next': 'Use /api/projects/{projectId}/tasks/next'
    },
    testCommands: {
      health: 'curl http://localhost:3000/health',
      listProjects: `curl -H "X-API-Key: ${config.security.apiKey}" http://localhost:3000/api/projects`,
      createProject: `curl -X POST -H "X-API-Key: ${config.security.apiKey}" -H "Content-Type: application/json" -d '{"id":"test-project","name":"测试项目","description":"测试项目描述"}' http://localhost:3000/api/projects`,
      uploadPrd: `curl -X POST -H "X-API-Key: ${config.security.apiKey}" -F "file=@prd.txt" http://localhost:3000/api/projects/test-project/prd/upload`,
      parsePrd: `curl -X POST -H "X-API-Key: ${config.security.apiKey}" -H "Content-Type: application/json" -d '{"numTasks":5}' http://localhost:3000/api/projects/test-project/prd/parse`,
      listTasks: `curl -H "X-API-Key: ${config.security.apiKey}" http://localhost:3000/api/projects/test-project/tasks`,
      listPrs: `curl -H "X-API-Key: ${config.security.apiKey}" http://localhost:3000/api/projects/test-project/prs`,
      listCrs: `curl -H "X-API-Key: ${config.security.apiKey}" http://localhost:3000/api/projects/test-project/crs`,
      research: `curl -X POST -H "X-API-Key: ${config.security.apiKey}" -H "Content-Type: application/json" -d '{"query":"React最佳实践"}' http://localhost:3000/api/research`
    },
    taskMasterIntegration: {
      status: taskMasterService.initialized ? 'connected' : 'fallback',
      description: taskMasterService.initialized ? 'Connected to remote TaskMaster server' : 'Using fallback data (remote server not available)'
    }
  });
});

// ========== 404和错误处理 ==========
// 注意：这个通配符路由必须放在最后，以免干扰静态文件服务
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'not_found',
    message: `API route ${req.method} ${req.originalUrl} not found`,
    requestId: req.requestId,
    hint: 'Visit /debug/routes for available endpoints'
  });
});

// 对于非API路由，如果静态文件不存在，返回index.html（支持SPA路由）
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

app.use((error, req, res, next) => {
  log.error('服务器错误', error.message);
  res.status(500).json({
    success: false,
    error: 'internal_server_error',
    message: error.message,
    requestId: req.requestId
  });
});

// ========== 启动服务器 ==========
const PORT = process.env.PORT || 3002;  // 改为3002避免冲突
app.listen(PORT, '0.0.0.0', () => {
  log.info('Task Master Web API server started', {
    port: PORT,
    host: '0.0.0.0',
    environment: 'development'
  });
  console.log(`\n🚀 Task Master Web API 服务器启动成功!`);
  console.log(`📍 Web界面: http://localhost:${PORT}/`);
  console.log(`📍 健康检查: http://localhost:${PORT}/health`);
  console.log(`🔍 调试信息: http://localhost:${PORT}/debug/routes`);
  console.log(`📚 完整功能列表: curl http://localhost:${PORT}/debug/routes`);
}); 