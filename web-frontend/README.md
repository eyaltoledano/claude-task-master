# TaskMaster Web API

TaskMaster Web API 是一个现代化的任务管理系统，提供项目管理、产品需求管理、变更请求管理和任务管理功能。

## 🚀 功能特性

- **项目管理**: 创建、查看和管理项目
- **产品需求 (PRs)**: 管理产品需求文档和规格说明
- **变更请求 (CRs)**: 跟踪和管理项目变更请求
- **任务管理**: 查看任务列表、详情和统计信息
- **PRD文档上传**: 支持上传和解析PRD文档
- **Web界面**: 现代化的响应式Web界面
- **API文档**: 完整的Swagger API文档

## 📋 系统要求

- Node.js 18.0 或更高版本
- npm 或 yarn 包管理器

## 🛠️ 安装和运行

### 1. 安装依赖

```bash
cd web-api
npm install
```

### 2. 环境配置

创建 `.env` 文件（可选）：

```env
PORT=3000
NODE_ENV=development
API_KEY=your-api-key-here
```

### 3. 启动服务

```bash
# 开发模式（带热重载）
npm run dev

# 生产模式
npm start

# 完整模式（集成TaskMaster核心）
npm run start-full
```

### 4. 访问应用

- **Web界面**: http://localhost:3000
- **API文档**: http://localhost:3000/docs
- **健康检查**: http://localhost:3000/health

## 📚 API 文档

### 认证

API使用API密钥进行认证。在请求头中包含：

```
X-API-Key: your-api-key
```

### 主要端点

#### 项目管理

- `GET /api/projects` - 获取所有项目
- `POST /api/projects` - 创建新项目
- `GET /api/projects/{id}` - 获取项目详情
- `POST /api/projects/{id}/upload-prd` - 上传PRD文档

#### 产品需求 (PRs)

- `GET /api/projects/{projectId}/prs` - 获取项目的产品需求列表
- `GET /api/projects/{projectId}/prs/{id}` - 获取产品需求详情

#### 变更请求 (CRs)

- `GET /api/projects/{projectId}/crs` - 获取项目的变更请求列表
- `GET /api/projects/{projectId}/crs/{id}` - 获取变更请求详情

#### 任务管理

- `GET /api/projects/{projectId}/tasks` - 获取项目的任务列表
- `GET /api/projects/{projectId}/tasks/{id}` - 获取任务详情
- `GET /api/projects/{projectId}/tasks/stats` - 获取任务统计信息

### 请求示例

#### 创建项目

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "id": "my-web-app",
    "name": "My Web Application",
    "description": "A modern web application for task management"
  }'
```

#### 获取项目列表

```bash
curl -X GET http://localhost:3000/api/projects \
  -H "X-API-Key: your-api-key"
```

#### 上传PRD文档

```bash
curl -X POST http://localhost:3000/api/projects/my-web-app/upload-prd \
  -H "X-API-Key: your-api-key" \
  -F "file=@prd-document.txt"
```

## 🏗️ 架构设计

### 目录结构

```
web-api/
├── src/
│   ├── routes/          # API路由
│   │   ├── projects.js  # 项目管理路由
│   │   ├── prs.js       # 产品需求路由
│   │   ├── crs.js       # 变更请求路由
│   │   └── tasks.js     # 任务管理路由
│   ├── services/        # 业务逻辑服务
│   ├── middleware/      # 中间件
│   ├── utils/          # 工具函数
│   ├── docs/           # API文档配置
│   └── config/         # 配置文件
├── public/             # 静态文件和Web界面
│   ├── index.html      # 主页面
│   ├── js/            # JavaScript文件
│   └── css/           # 样式文件
└── uploads/           # 文件上传目录
```

### 核心组件

1. **Express服务器**: 提供RESTful API和静态文件服务
2. **TaskMaster服务**: 与TaskMaster核心系统集成
3. **路由层**: 处理HTTP请求和响应
4. **服务层**: 业务逻辑处理
5. **中间件**: 认证、日志、错误处理等

## 🔧 配置选项

### 服务器配置

- `PORT`: 服务器端口（默认: 3000）
- `NODE_ENV`: 运行环境（development/production）
- `API_KEY`: API认证密钥

### 功能配置

- `REQUIRE_AUTH`: 是否需要API认证（默认: true）
- `UPLOAD_LIMIT`: 文件上传大小限制（默认: 10MB）
- `CORS_ORIGIN`: CORS允许的源（默认: *）

## 🧪 测试

```bash
# 运行测试
npm test

# 运行测试覆盖率
npm run test:coverage
```

## 📝 开发指南

### 添加新的API端点

1. 在相应的路由文件中添加路由处理函数
2. 添加Swagger文档注释
3. 在服务层实现业务逻辑
4. 添加相应的测试用例

### 代码风格

- 使用ES6+语法
- 遵循ESLint规则
- 使用JSDoc注释
- 保持代码简洁和可读性

## 🐛 故障排除

### 常见问题

1. **端口被占用**: 修改PORT环境变量或停止占用端口的进程
2. **API认证失败**: 检查X-API-Key请求头是否正确设置
3. **文件上传失败**: 检查文件大小和格式是否符合要求
4. **TaskMaster集成问题**: 确保TaskMaster核心服务正常运行

### 日志查看

应用日志会输出到控制台，包含以下信息：
- 请求日志
- 错误日志
- 性能指标
- 调试信息

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 📞 支持

如有问题，请通过以下方式联系：
- 创建GitHub Issue
- 发送邮件至: support@taskmaster.dev
