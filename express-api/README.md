# TaskMaster Remote Server

TaskMaster远程服务器将现有的CLI工具改造成可远程访问的HTTP API服务，支持多项目管理和多用户并发使用。

## 🚀 快速开始

### 启动服务器

```bash
# 开发模式（带调试日志）
npm run remote-server:dev

# 生产模式
npm run remote-server

# 或者直接运行
node server/app.js
```

### 环境变量

```bash
PORT=3000                    # 服务器端口
HOST=0.0.0.0                # 服务器主机
PROJECTS_DIR=./projects      # 项目存储目录
LOG_LEVEL=info              # 日志级别 (error, warn, info, debug)
NODE_ENV=development        # 环境模式
```

### 测试服务器

```bash
# 运行API测试
node test-remote-server.js
```

## 📁 项目结构

```
server/
├── app.js                  # Express主应用
├── start.js               # 启动脚本
├── routes/                # API路由
│   ├── projects.js        # 项目管理API
│   ├── tasks.js          # 任务管理API
│   ├── prd.js            # PRD解析API
│   └── files.js          # 文件管理API
├── services/              # 业务服务
│   └── core-adapter.js   # 核心函数适配器
├── middleware/            # 中间件
│   ├── error-handler.js  # 错误处理
│   └── project-validator.js # 项目验证
└── utils/                 # 工具函数
    ├── logger.js         # 日志工具
    └── project-manager.js # 项目管理器
```

## 🔌 API 端点

### 健康检查
- `GET /health` - 服务器健康状态

### 项目管理
- `GET /api/projects` - 获取所有项目
- `POST /api/projects` - 创建新项目
- `GET /api/projects/:id` - 获取项目详情
- `PUT /api/projects/:id` - 更新项目
- `DELETE /api/projects/:id` - 删除项目

### 任务管理
- `GET /api/projects/:id/tasks` - 获取任务列表
- `POST /api/projects/:id/tasks` - 添加新任务
- `GET /api/projects/:id/tasks/:taskId` - 获取任务详情
- `PUT /api/projects/:id/tasks/:taskId` - 更新任务
- `DELETE /api/projects/:id/tasks/:taskId` - 删除任务
- `POST /api/projects/:id/tasks/:taskId/expand` - 扩展任务
- `PUT /api/projects/:id/tasks/:taskId/status` - 设置任务状态

### PRD管理
- `POST /api/projects/:id/prd/parse` - 解析PRD生成任务
- `POST /api/projects/:id/prd/upload` - 上传PRD文件
- `GET /api/projects/:id/prd/files` - 列出PRD文件
- `GET /api/projects/:id/prd/files/:filename` - 获取PRD文件内容

### 文件管理
- `POST /api/projects/:id/files/generate` - 生成任务文件
- `GET /api/projects/:id/files` - 列出项目文件
- `GET /api/projects/:id/files/:filename` - 下载文件
- `POST /api/projects/:id/files/upload` - 上传文件

## 📝 API 使用示例

### 创建项目

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-web-app",
    "name": "My Web Application",
    "description": "A modern web application",
    "template": "web-app"
  }'
```

### 添加任务

```bash
curl -X POST http://localhost:3000/api/projects/my-web-app/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Setup Development Environment",
    "description": "Configure development tools and dependencies",
    "priority": "high"
  }'
```

### 解析PRD

```bash
curl -X POST http://localhost:3000/api/projects/my-web-app/prd/parse \
  -H "Content-Type: application/json" \
  -d '{
    "prdContent": "# My App PRD\n\n## Features\n- User login\n- Dashboard\n- Settings",
    "numTasks": 5,
    "useResearch": false
  }'
```

## 🗂️ 项目目录结构

每个项目在`projects/`目录下有独立的结构：

```
projects/
└── my-web-app/
    └── .taskmaster/
        ├── tasks/
        │   ├── tasks.json      # 任务数据
        │   ├── task_001.txt    # 个别任务文件
        │   └── task_002.txt
        ├── docs/
        │   └── prd.txt         # PRD文档
        ├── reports/
        │   └── complexity-report.json
        ├── config.json         # 项目配置
        └── state.json          # 项目状态
```

## 🔧 核心特性

### 多项目隔离
- 每个项目有独立的`.taskmaster`目录
- 项目间完全隔离，互不影响
- 支持项目模板（web-app, mobile-app等）

### 现有功能保持
- 所有现有的CLI功能都通过API提供
- 核心函数通过适配器无缝集成
- 保持与现有MCP工具的兼容性

### 并发安全
- 支持多个客户端同时访问
- 项目级别的操作隔离
- 完整的错误处理和日志记录

## 🐛 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   Error: listen EADDRINUSE :::3000
   ```
   解决：更改端口 `PORT=3001 npm run remote-server`

2. **项目目录权限问题**
   ```bash
   Error: EACCES: permission denied
   ```
   解决：确保`projects/`目录有写权限

3. **模块导入错误**
   ```bash
   Error: Cannot find module
   ```
   解决：确保运行`npm install`安装依赖

### 日志调试

```bash
# 启用调试日志
LOG_LEVEL=debug npm run remote-server:dev
```

## 🔮 下一步

1. 实现MCP服务器集成
2. 添加并发控制机制
3. 完善错误处理和日志
4. 添加单元测试和集成测试
5. 编写完整的API文档
