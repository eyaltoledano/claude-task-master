# Claude Task Master 系统完整文档

## 目录

1. [系统概述](#1-系统概述)
2. [架构设计](#2-架构设计)
3. [核心功能](#3-核心功能)
4. [技术栈](#4-技术栈)
5. [项目结构](#5-项目结构)
6. [安装部署](#6-安装部署)
7. [配置管理](#7-配置管理)
8. [API文档](#8-api文档)
9. [MCP协议](#9-mcp协议)
10. [开发指南](#10-开发指南)
11. [运维监控](#11-运维监控)
12. [故障排除](#12-故障排除)
13. [扩展开发](#13-扩展开发)

---

## 1. 系统概述

### 1.1 项目简介

Claude Task Master 是一个基于AI驱动的智能任务管理系统，采用现代化的微服务架构设计。系统支持多项目管理、智能任务生成、PRD范围检测、变更请求管理等功能，为软件开发团队提供完整的项目管理解决方案。

### 1.2 核心特性

- **AI驱动任务生成**：基于自然语言描述自动生成详细任务
- **多项目支持**：支持同时管理多个项目，项目间数据隔离
- **PRD范围检测**：智能检测任务是否超出项目需求文档范围
- **MCP协议支持**：支持Model Context Protocol，可与各种IDE集成
- **RESTful API**：提供完整的REST API接口
- **Web管理界面**：现代化的Web管理界面
- **实时协作**：支持多用户实时协作
- **变更请求管理**：自动生成和管理项目变更请求

### 1.3 系统架构概览

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   IDE Clients   │    │  External APIs  │
│   (Port 3002)   │    │   (MCP Client)  │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway / Load Balancer                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Web API     │ │ Express API │ │ MCP Server  │
│ Service     │ │ Service     │ │ Service     │
│ (Port 3002) │ │ (Port 3000) │ │ (Port 3001) │
└─────────────┘ └─────────────┘ └─────────────┘
          │           │           │
          └───────────┼───────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Core Services Layer                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ Task        │ │ Project     │ │ PRD         │ │ AI        │ │
│  │ Management  │ │ Management  │ │ Analysis    │ │ Services  │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Data Storage Layer                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ File System │ │ JSON Files  │ │ Cache       │ │ Logs      │ │
│  │ Storage     │ │ Database    │ │ (Memory)    │ │ Storage   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 1.4 设计原则

- **模块化设计**：各功能模块独立，便于维护和扩展
- **微服务架构**：服务间松耦合，支持独立部署和扩展
- **API优先**：所有功能通过API提供，支持多种客户端
- **数据隔离**：多项目间数据完全隔离，确保安全性
- **可扩展性**：支持水平扩展和功能扩展
- **容错设计**：具备完善的错误处理和恢复机制

---

## 2. 架构设计

### 2.1 整体架构

系统采用分层架构设计，从上到下分为：

1. **表示层（Presentation Layer）**
   - Web前端界面
   - IDE客户端（通过MCP协议）
   - API客户端

2. **API网关层（API Gateway Layer）**
   - 请求路由和负载均衡
   - 身份验证和授权
   - 请求限流和监控

3. **服务层（Service Layer）**
   - Web API服务（端口3002）
   - Express API服务（端口3000）
   - MCP服务器（端口3001）

4. **业务逻辑层（Business Logic Layer）**
   - 任务管理服务
   - 项目管理服务
   - PRD分析服务
   - AI集成服务

5. **数据访问层（Data Access Layer）**
   - 文件系统存储
   - JSON数据库
   - 缓存管理

### 2.2 服务架构详解

#### 2.2.1 Express API服务（核心服务）

**端口**: 3000
**职责**: 核心业务逻辑处理

**主要组件**:
```
server/
├── app.js                 # 应用入口
├── routes/               # 路由层
│   ├── tasks.js         # 任务管理路由
│   ├── projects.js      # 项目管理路由
│   ├── prd.js          # PRD管理路由
│   └── crs.js          # 变更请求路由
├── middleware/          # 中间件层
│   ├── auth.js         # 身份验证
│   ├── scope-check.js  # 范围检测
│   ├── file-lock.js    # 文件锁
│   └── cache.js        # 缓存管理
├── services/           # 服务层
│   ├── task-service.js
│   ├── project-service.js
│   ├── prd-analyzer.js
│   └── scope-checker.js
└── utils/              # 工具层
    ├── logger.js
    ├── config.js
    └── helpers.js
```

#### 2.2.2 MCP服务器（协议服务）

**端口**: 3001
**职责**: MCP协议支持，IDE集成

**特性**:
- 支持HTTP传输协议
- 多用户并发支持
- 项目隔离
- 工具调用支持

#### 2.2.3 Web API服务（前端服务）

**端口**: 3002
**职责**: Web界面和前端API

**特性**:
- RESTful API设计
- Swagger文档集成
- 前端资源服务
- 用户界面支持

### 2.3 数据流架构

#### 2.3.1 请求处理流程

```
Client Request → API Gateway → Service Router → Business Logic → Data Access → Response
```

**详细流程**:
1. **请求接收**: API网关接收客户端请求
2. **身份验证**: 验证用户身份和权限
3. **路由分发**: 根据请求类型分发到相应服务
4. **业务处理**: 执行具体业务逻辑
5. **数据操作**: 读写数据存储
6. **响应返回**: 返回处理结果

#### 2.3.2 数据存储架构

**文件系统结构**:
```
projects/
├── {project-id}/
│   ├── .taskmaster/
│   │   ├── config.json          # 项目配置
│   │   ├── tasks/
│   │   │   ├── tasks.json       # 任务数据
│   │   │   └── archive/         # 归档任务
│   │   ├── prd/
│   │   │   ├── requirements.md  # PRD文档
│   │   │   └── analysis/        # 分析结果
│   │   ├── crs/
│   │   │   └── *.json          # 变更请求
│   │   └── logs/
│   │       └── *.log           # 操作日志
│   └── README.md               # 项目说明
```

### 2.4 安全架构

#### 2.4.1 身份验证机制

- **多层验证**: API Key + 用户名密码
- **会话管理**: JWT Token机制
- **权限控制**: 基于角色的访问控制(RBAC)

#### 2.4.2 数据安全

- **项目隔离**: 严格的项目级数据隔离
- **文件权限**: 操作系统级文件权限控制
- **API限流**: 防止恶意请求和DDoS攻击

---

## 3. 核心功能

### 3.1 任务管理系统

#### 3.1.1 功能概述

任务管理是系统的核心功能，提供完整的任务生命周期管理。

**主要特性**:
- AI驱动的任务生成
- 任务依赖关系管理
- 任务状态跟踪
- 任务优先级管理
- 任务标签和分类

#### 3.1.2 任务数据结构

```json
{
  "id": 1,
  "title": "任务标题",
  "description": "任务描述",
  "details": "详细实现步骤",
  "testStrategy": "测试策略",
  "status": "pending|in-progress|completed|cancelled",
  "priority": "low|medium|high|critical",
  "dependencies": [2, 3],
  "tags": ["frontend", "api"],
  "assignee": "user@example.com",
  "estimatedHours": 8,
  "actualHours": 6,
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z",
  "dueDate": "2025-01-15T00:00:00Z"
}
```

#### 3.1.3 任务操作API

**创建任务**:
```http
POST /api/projects/{projectId}/tasks
Content-Type: application/json

{
  "title": "新任务",
  "description": "任务描述",
  "priority": "medium"
}
```

**更新任务**:
```http
PUT /api/projects/{projectId}/tasks/{taskId}
Content-Type: application/json

{
  "status": "in-progress",
  "assignee": "developer@example.com"
}
```

**查询任务**:
```http
GET /api/projects/{projectId}/tasks?status=pending&priority=high
```

### 3.2 项目管理系统

#### 3.2.1 项目结构

每个项目都是独立的工作空间，包含：
- 项目配置信息
- 任务数据
- PRD文档
- 变更请求
- 操作日志

#### 3.2.2 项目配置

```json
{
  "projectId": "demo-project",
  "name": "演示项目",
  "description": "项目描述",
  "version": "1.0.0",
  "status": "active",
  "owner": "admin@example.com",
  "members": ["dev1@example.com", "dev2@example.com"],
  "settings": {
    "aiProvider": "openrouter",
    "defaultPriority": "medium",
    "autoAssignment": true
  },
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### 3.3 PRD范围检测系统

#### 3.3.1 功能原理

PRD范围检测系统通过AI分析任务内容，判断是否超出项目需求文档(PRD)定义的范围。

**检测流程**:
1. 任务创建/修改时触发检测
2. 提取任务关键信息
3. 加载PRD需求基线
4. AI分析任务与需求的匹配度
5. 生成检测报告
6. 自动创建变更请求(如需要)

#### 3.3.2 范围检测配置

```javascript
// 中间件配置
const scopeCheckMiddlewares = {
  addTask: createScopeCheckMiddleware({
    operation: 'add',
    autoCreateCR: true,
    blockOutOfScope: false,
    confidenceThreshold: 0.7
  }),

  modifyTask: createScopeCheckMiddleware({
    operation: 'modify',
    autoCreateCR: true,
    blockOutOfScope: false
  })
};
```

#### 3.3.3 检测结果结构

```json
{
  "inScope": false,
  "confidence": 0.85,
  "reasoning": "该任务涉及区块链支付功能，超出了原始PRD中定义的项目管理系统范围",
  "matchedRequirements": [],
  "suggestedRequirements": ["REQ-NEW-001"],
  "riskLevel": "high",
  "recommendations": [
    "建议创建变更请求",
    "需要更新PRD文档",
    "评估对现有架构的影响"
  ]
}
```

### 3.4 变更请求管理

#### 3.4.1 自动CR生成

当检测到超出范围的任务时，系统自动生成变更请求：

```json
{
  "id": "CR-2025-001",
  "title": "添加区块链支付功能",
  "type": "scope_expansion",
  "status": "pending",
  "priority": "medium",
  "description": "检测到任务超出PRD范围，需要评估是否扩展项目范围",
  "triggerTask": {
    "id": 15,
    "title": "区块链支付系统"
  },
  "scopeAnalysis": {
    "confidence": 0.85,
    "riskLevel": "high"
  },
  "impact": {
    "timeline": "可能延长项目周期2-3周",
    "resources": "需要区块链开发专家",
    "budget": "预计增加成本30%"
  },
  "createdAt": "2025-01-01T00:00:00Z"
}
```

---

## 4. 技术栈

### 4.1 后端技术栈

#### 4.1.1 核心框架
- **Node.js**: JavaScript运行时环境
- **Express.js**: Web应用框架
- **ES6+ Modules**: 现代JavaScript模块系统

#### 4.1.2 AI集成
- **OpenRouter API**: 多模型AI服务聚合平台
- **DeepSeek**: 主要AI模型提供商
- **Structured Output**: JSON Schema验证的结构化输出

#### 4.1.3 数据存储
- **File System**: 基于文件系统的数据存储
- **JSON**: 结构化数据格式
- **Memory Cache**: 内存缓存系统

#### 4.1.4 协议支持
- **MCP (Model Context Protocol)**: AI模型上下文协议
- **HTTP/HTTPS**: 标准Web协议
- **WebSocket**: 实时通信协议

### 4.2 前端技术栈

#### 4.2.1 Web界面
- **HTML5**: 现代Web标准
- **CSS3**: 样式和布局
- **Vanilla JavaScript**: 原生JavaScript
- **Responsive Design**: 响应式设计

#### 4.2.2 UI组件
- **Bootstrap**: UI组件库
- **Chart.js**: 图表组件
- **Monaco Editor**: 代码编辑器

### 4.3 开发工具

#### 4.3.1 代码质量
- **ESLint**: JavaScript代码检查
- **Prettier**: 代码格式化
- **Jest**: 单元测试框架

#### 4.3.2 文档工具
- **Swagger/OpenAPI**: API文档生成
- **JSDoc**: JavaScript文档生成
- **Markdown**: 文档编写

### 4.4 部署技术

#### 4.4.1 容器化
- **Docker**: 容器化平台
- **Docker Compose**: 多容器编排
- **Nginx**: 反向代理和负载均衡

#### 4.4.2 监控日志
- **Winston**: 日志管理
- **PM2**: 进程管理
- **Health Checks**: 健康检查

---

## 5. 项目结构

### 5.1 根目录结构

```
claude-task-master/
├── README.md                    # 项目说明
├── package.json                 # 项目依赖
├── .env.example                # 环境变量模板
├── .gitignore                  # Git忽略文件
├── docker-compose.yml          # Docker编排配置
├── scripts/                    # 原始TaskMaster脚本
│   ├── modules/               # 核心模块
│   ├── taskmaster.js         # 主程序入口
│   └── config/               # 配置文件
├── server/                     # Express API服务
│   ├── app.js                # 服务器入口
│   ├── routes/               # 路由定义
│   ├── middleware/           # 中间件
│   ├── services/             # 业务服务
│   └── utils/                # 工具函数
├── web-api/                   # Web API服务
│   ├── src/                  # 源代码
│   ├── public/               # 静态资源
│   ├── Dockerfile            # Docker配置
│   └── package.json          # 依赖配置
├── mcp-server/                # MCP服务器
│   ├── src/                  # 源代码
│   ├── tools/                # MCP工具
│   └── package.json          # 依赖配置
├── projects/                  # 项目数据目录
│   └── {project-id}/         # 具体项目
└── docs/                      # 文档目录
    ├── api/                  # API文档
    ├── deployment/           # 部署文档
    └── development/          # 开发文档
```

### 5.2 服务器目录详解

#### 5.2.1 Express API服务 (server/)

```
server/
├── app.js                     # 应用主入口
├── routes/                    # 路由层
│   ├── index.js              # 路由汇总
│   ├── tasks.js              # 任务管理路由
│   ├── projects.js           # 项目管理路由
│   ├── prd.js                # PRD管理路由
│   ├── crs.js                # 变更请求路由
│   ├── tags.js               # 标签管理路由
│   └── research.js           # 研究功能路由
├── middleware/                # 中间件层
│   ├── auth.js               # 身份验证中间件
│   ├── project-validator.js  # 项目验证中间件
│   ├── scope-check.js        # 范围检测中间件
│   ├── file-lock.js          # 文件锁中间件
│   ├── response-cache.js     # 响应缓存中间件
│   ├── error-handler.js      # 错误处理中间件
│   └── performance-monitor.js # 性能监控中间件
├── services/                  # 业务服务层
│   ├── task-service.js       # 任务服务
│   ├── project-service.js    # 项目服务
│   ├── prd-analyzer.js       # PRD分析服务
│   ├── scope-checker.js      # 范围检查服务
│   ├── cr-service.js         # 变更请求服务
│   └── task-enhancement.js   # 任务增强服务
├── adapters/                  # 适配器层
│   ├── core-adapter.js       # 核心适配器
│   ├── task-scope-adapter.js # 任务范围适配器
│   └── mcp-adapter.js        # MCP适配器
├── utils/                     # 工具层
│   ├── logger.js             # 日志工具
│   ├── config-manager.js     # 配置管理
│   ├── cache-manager.js      # 缓存管理
│   ├── file-utils.js         # 文件工具
│   └── validation.js         # 数据验证
└── config/                    # 配置文件
    ├── database.js           # 数据库配置
    ├── ai-services.js        # AI服务配置
    └── security.js           # 安全配置
```

#### 5.2.2 Web API服务 (web-api/)

```
web-api/
├── src/                       # 源代码目录
│   ├── server.js             # 服务器入口
│   ├── server-debug.js       # 调试模式服务器
│   ├── server-simple.js      # 简化模式服务器
│   ├── config/               # 配置管理
│   │   └── config.js         # 主配置文件
│   ├── routes/               # 路由定义
│   │   ├── tasks.js          # 任务路由
│   │   ├── projects.js       # 项目路由
│   │   ├── prs.js            # PRD路由
│   │   ├── crs.js            # 变更请求路由
│   │   ├── tags.js           # 标签路由
│   │   └── research.js       # 研究路由
│   ├── services/             # 服务层
│   │   └── taskmaster-service.js # TaskMaster服务适配器
│   ├── middleware/           # 中间件
│   │   └── auth.js           # 身份验证
│   ├── docs/                 # 文档
│   │   └── swagger.js        # Swagger配置
│   └── utils/                # 工具
│       └── logger.js         # 日志工具
├── public/                    # 静态资源
│   ├── index.html            # 主页面
│   └── js/                   # JavaScript文件
│       └── app.js            # 前端应用
├── examples/                  # 示例代码
│   └── api-examples.md       # API使用示例
├── Dockerfile                # Docker配置
├── docker-compose.yml        # Docker编排
├── nginx.conf.example        # Nginx配置示例
├── jest.config.js            # 测试配置
├── .env.example              # 环境变量示例
└── package.json              # 项目配置
```

### 5.3 项目数据结构

#### 5.3.1 项目目录结构

```
projects/{project-id}/
├── .taskmaster/               # TaskMaster配置目录
│   ├── config.json           # 项目配置文件
│   ├── tasks/                # 任务数据
│   │   ├── tasks.json        # 主任务文件
│   │   ├── archive/          # 归档任务
│   │   │   └── {year}/       # 按年份归档
│   │   └── backup/           # 备份文件
│   ├── prd/                  # PRD相关文件
│   │   ├── requirements.md   # 需求文档
│   │   ├── analysis/         # 分析结果
│   │   │   ├── prd-requirements-latest.json
│   │   │   └── scope-analysis.json
│   │   └── versions/         # 版本历史
│   ├── crs/                  # 变更请求
│   │   ├── pending/          # 待处理CR
│   │   ├── approved/         # 已批准CR
│   │   └── rejected/         # 已拒绝CR
│   ├── tags/                 # 标签管理
│   │   └── tags.json         # 标签定义
│   ├── research/             # 研究数据
│   │   └── research.json     # 研究记录
│   └── logs/                 # 操作日志
│       ├── access.log        # 访问日志
│       ├── error.log         # 错误日志
│       └── audit.log         # 审计日志
├── README.md                 # 项目说明
├── .gitignore               # Git忽略文件
└── docs/                    # 项目文档
    ├── architecture.md      # 架构文档
    ├── api.md              # API文档
    └── deployment.md       # 部署文档
```

---

## 6. 安装部署

### 6.1 环境要求

#### 6.1.1 系统要求
- **操作系统**: Linux/macOS/Windows
- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **内存**: >= 4GB RAM
- **存储**: >= 10GB 可用空间

#### 6.1.2 依赖服务
- **AI服务**: OpenRouter API或其他兼容服务
- **反向代理**: Nginx (生产环境推荐)
- **进程管理**: PM2 (生产环境推荐)

### 6.2 快速安装

#### 6.2.1 克隆项目

```bash
git clone https://github.com/mrhaoqi/claude-task-master.git
cd claude-task-master
```

#### 6.2.2 安装依赖

```bash
# 安装主项目依赖
npm install

# 安装Web API服务依赖
cd web-api
npm install
cd ..

# 安装MCP服务器依赖
cd mcp-server
npm install
cd ..
```

#### 6.2.3 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env
cp web-api/.env.example web-api/.env

# 编辑配置文件
nano .env
```

**主要配置项**:
```env
# AI服务配置
OPENROUTER_API_KEY=your_openrouter_api_key
AI_PROVIDER=openrouter
DEFAULT_MODEL=deepseek/deepseek-chat-v3-0324:free

# 服务端口配置
EXPRESS_PORT=3000
WEB_API_PORT=3002
MCP_SERVER_PORT=3001

# 数据目录
PROJECTS_DIR=./projects
LOGS_DIR=./logs

# 安全配置
JWT_SECRET=your_jwt_secret
API_KEY=your_api_key

# 调试配置
NODE_ENV=development
LOG_LEVEL=debug
```

### 6.3 启动服务

#### 6.3.1 开发模式

```bash
# 启动Express API服务
npm run server:dev

# 启动Web API服务
npm run web-api:dev

# 启动MCP服务器
npm run mcp-server:dev

# 或者同时启动所有服务
npm run dev:all
```

#### 6.3.2 生产模式

```bash
# 构建项目
npm run build

# 启动生产服务
npm run start

# 使用PM2管理进程
npm run pm2:start
```

### 6.4 Docker部署

#### 6.4.1 使用Docker Compose

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 6.4.2 Docker Compose配置

```yaml
version: '3.8'

services:
  express-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PROJECTS_DIR=/app/data/projects
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped

  web-api:
    build: ./web-api
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - TASKMASTER_API_URL=http://express-api:3000
    depends_on:
      - express-api
    restart: unless-stopped

  mcp-server:
    build: ./mcp-server
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - EXPRESS_API_URL=http://express-api:3000
    depends_on:
      - express-api
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - web-api
      - express-api
      - mcp-server
    restart: unless-stopped
```

### 6.5 验证安装

#### 6.5.1 健康检查

```bash
# 检查Express API服务
curl http://localhost:3000/health

# 检查Web API服务
curl http://localhost:3002/health

# 检查MCP服务器
curl http://localhost:3001/health
```

#### 6.5.2 功能测试

```bash
# 创建测试项目
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "test-project", "description": "测试项目"}'

# 创建测试任务
curl -X POST http://localhost:3000/api/projects/test-project/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "测试任务", "description": "这是一个测试任务"}'
```

---

## 7. 配置管理

### 7.1 配置文件结构

#### 7.1.1 全局配置 (config/global-config.json)

```json
{
  "version": "1.0.0",
  "ai": {
    "providers": {
      "openrouter": {
        "baseUrl": "https://openrouter.ai/api/v1",
        "models": {
          "main": "deepseek/deepseek-r1-0528:free",
          "fallback": "deepseek/deepseek-chat-v3-0324:free",
          "research": "deepseek/deepseek-chat-v3-0324:free"
        },
        "maxTokens": 8000,
        "temperature": 0.2
      }
    },
    "defaultProvider": "openrouter",
    "timeout": 30000,
    "retryAttempts": 3
  },
  "server": {
    "ports": {
      "express": 3000,
      "webApi": 3002,
      "mcpServer": 3001
    },
    "cors": {
      "enabled": true,
      "origins": ["http://localhost:3002", "http://localhost:3000"]
    },
    "rateLimit": {
      "windowMs": 900000,
      "max": 100
    }
  },
  "storage": {
    "projectsDir": "./projects",
    "logsDir": "./logs",
    "cacheDir": "./cache",
    "backupDir": "./backup"
  },
  "logging": {
    "level": "info",
    "format": "json",
    "maxFiles": 10,
    "maxSize": "10m"
  },
  "security": {
    "jwtExpiration": "24h",
    "bcryptRounds": 12,
    "sessionTimeout": 3600000
  }
}
```

#### 7.1.2 项目配置 (projects.json)

```json
{
  "projects": [
    {
      "id": "demo-complete-project",
      "name": "完整演示项目",
      "description": "包含所有功能的演示项目",
      "status": "active",
      "owner": "admin@example.com",
      "members": ["dev1@example.com", "dev2@example.com"],
      "settings": {
        "aiProvider": "openrouter",
        "defaultPriority": "medium",
        "autoAssignment": true,
        "scopeCheck": {
          "enabled": true,
          "autoCreateCR": true,
          "confidenceThreshold": 0.7
        }
      },
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z"
    }
  ],
  "metadata": {
    "totalProjects": 1,
    "activeProjects": 1,
    "lastUpdated": "2025-01-01T00:00:00Z"
  }
}
```

### 7.2 环境变量配置

#### 7.2.1 开发环境 (.env.development)

```env
# 环境设置
NODE_ENV=development
LOG_LEVEL=debug

# 服务端口
EXPRESS_PORT=3000
WEB_API_PORT=3002
MCP_SERVER_PORT=3001

# AI服务配置
OPENROUTER_API_KEY=your_development_api_key
AI_PROVIDER=openrouter
DEFAULT_MODEL=deepseek/deepseek-chat-v3-0324:free

# 数据目录
PROJECTS_DIR=./projects
LOGS_DIR=./logs
CACHE_DIR=./cache

# 安全配置
JWT_SECRET=development_jwt_secret
API_KEY=development_api_key

# 调试选项
DEBUG=taskmaster:*
ENABLE_SWAGGER=true
ENABLE_CORS=true
```

#### 7.2.2 生产环境 (.env.production)

```env
# 环境设置
NODE_ENV=production
LOG_LEVEL=info

# 服务端口
EXPRESS_PORT=3000
WEB_API_PORT=3002
MCP_SERVER_PORT=3001

# AI服务配置
OPENROUTER_API_KEY=your_production_api_key
AI_PROVIDER=openrouter
DEFAULT_MODEL=deepseek/deepseek-r1-0528:free

# 数据目录
PROJECTS_DIR=/app/data/projects
LOGS_DIR=/app/logs
CACHE_DIR=/app/cache

# 安全配置
JWT_SECRET=production_jwt_secret_very_long_and_secure
API_KEY=production_api_key_very_long_and_secure

# 性能配置
MAX_CONCURRENT_REQUESTS=100
CACHE_TTL=300000
REQUEST_TIMEOUT=30000

# 监控配置
ENABLE_METRICS=true
METRICS_PORT=9090
```

### 7.3 配置管理API

#### 7.3.1 获取配置

```http
GET /api/config
Authorization: Bearer {jwt_token}

Response:
{
  "ai": {
    "provider": "openrouter",
    "model": "deepseek/deepseek-chat-v3-0324:free"
  },
  "server": {
    "version": "1.0.0",
    "environment": "development"
  }
}
```

#### 7.3.2 更新配置

```http
PUT /api/config
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "ai": {
    "defaultModel": "deepseek/deepseek-r1-0528:free"
  }
}
```

### 7.4 配置验证

#### 7.4.1 配置检查脚本

```javascript
// scripts/check-config.js
const fs = require('fs');
const path = require('path');

function validateConfig() {
  const requiredEnvVars = [
    'OPENROUTER_API_KEY',
    'JWT_SECRET',
    'API_KEY'
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    process.exit(1);
  }

  console.log('Configuration validation passed');
}

validateConfig();
```

---

## 8. API文档

### 8.1 API概述

系统提供完整的RESTful API，支持所有核心功能的操作。API遵循REST设计原则，使用JSON格式进行数据交换。

#### 8.1.1 API基础信息

- **Base URL**: `http://localhost:3000/api` (开发环境)
- **API版本**: v1
- **数据格式**: JSON
- **字符编码**: UTF-8
- **认证方式**: JWT Token + API Key

#### 8.1.2 通用响应格式

**成功响应**:
```json
{
  "success": true,
  "data": {
    // 具体数据
  },
  "message": "操作成功",
  "timestamp": "2025-01-01T00:00:00Z"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": {
      "field": "title",
      "reason": "标题不能为空"
    }
  },
  "timestamp": "2025-01-01T00:00:00Z"
}
```

### 8.2 认证API

#### 8.2.1 用户登录

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}

Response:
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user123",
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin"
    },
    "expiresIn": "24h"
  }
}
```

#### 8.2.2 刷新Token

```http
POST /api/auth/refresh
Authorization: Bearer {jwt_token}

Response:
{
  "success": true,
  "data": {
    "token": "new_jwt_token",
    "expiresIn": "24h"
  }
}
```

### 8.3 项目管理API

#### 8.3.1 获取项目列表

```http
GET /api/projects
Authorization: Bearer {jwt_token}

Query Parameters:
- status: active|inactive|archived
- owner: 项目所有者
- limit: 分页大小 (默认: 20)
- offset: 分页偏移 (默认: 0)

Response:
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "demo-project",
        "name": "演示项目",
        "description": "项目描述",
        "status": "active",
        "owner": "admin@example.com",
        "memberCount": 3,
        "taskCount": 15,
        "createdAt": "2025-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

#### 8.3.2 创建项目

```http
POST /api/projects
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "name": "新项目",
  "description": "项目描述",
  "owner": "admin@example.com",
  "members": ["dev1@example.com"],
  "settings": {
    "aiProvider": "openrouter",
    "defaultPriority": "medium"
  }
}

Response:
{
  "success": true,
  "data": {
    "project": {
      "id": "new-project-123",
      "name": "新项目",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  }
}
```

### 8.4 任务管理API

#### 8.4.1 获取任务列表

```http
GET /api/projects/{projectId}/tasks
Authorization: Bearer {jwt_token}

Query Parameters:
- status: pending|in-progress|completed|cancelled
- priority: low|medium|high|critical
- assignee: 任务分配者
- tags: 标签过滤 (逗号分隔)
- search: 搜索关键词
- sortBy: createdAt|updatedAt|priority|dueDate
- sortOrder: asc|desc
- limit: 分页大小
- offset: 分页偏移

Response:
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": 1,
        "title": "实现用户登录功能",
        "description": "开发用户登录和认证系统",
        "status": "in-progress",
        "priority": "high",
        "assignee": "dev1@example.com",
        "tags": ["backend", "auth"],
        "estimatedHours": 8,
        "actualHours": 5,
        "progress": 60,
        "createdAt": "2025-01-01T00:00:00Z",
        "updatedAt": "2025-01-02T00:00:00Z",
        "dueDate": "2025-01-15T00:00:00Z"
      }
    ],
    "pagination": {
      "total": 15,
      "limit": 20,
      "offset": 0
    },
    "summary": {
      "totalTasks": 15,
      "pendingTasks": 5,
      "inProgressTasks": 3,
      "completedTasks": 7
    }
  }
}
```

#### 8.4.2 创建任务

```http
POST /api/projects/{projectId}/tasks
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "title": "新任务标题",
  "description": "任务描述",
  "priority": "medium",
  "assignee": "dev1@example.com",
  "tags": ["frontend", "ui"],
  "estimatedHours": 6,
  "dueDate": "2025-01-20T00:00:00Z",
  "dependencies": [2, 3]
}

Response:
{
  "success": true,
  "data": {
    "task": {
      "id": 16,
      "title": "新任务标题",
      "status": "pending",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  }
}
```

#### 8.4.3 更新任务

```http
PUT /api/projects/{projectId}/tasks/{taskId}
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "status": "completed",
  "actualHours": 7,
  "progress": 100,
  "notes": "任务已完成，测试通过"
}

Response:
{
  "success": true,
  "data": {
    "task": {
      "id": 16,
      "status": "completed",
      "updatedAt": "2025-01-03T00:00:00Z"
    }
  }
}
```

#### 8.4.4 删除任务

```http
DELETE /api/projects/{projectId}/tasks/{taskId}
Authorization: Bearer {jwt_token}

Response:
{
  "success": true,
  "message": "任务已删除"
}
```

### 8.5 PRD管理API

#### 8.5.1 获取PRD文档

```http
GET /api/projects/{projectId}/prd
Authorization: Bearer {jwt_token}

Response:
{
  "success": true,
  "data": {
    "prd": {
      "content": "# 项目需求文档\n\n## 概述\n...",
      "version": "1.0.0",
      "lastModified": "2025-01-01T00:00:00Z",
      "author": "admin@example.com"
    },
    "analysis": {
      "requirementsCount": 10,
      "lastAnalyzed": "2025-01-01T00:00:00Z",
      "baseline": {
        "version": "1.0.0",
        "requirements": [...]
      }
    }
  }
}
```

#### 8.5.2 更新PRD文档

```http
PUT /api/projects/{projectId}/prd
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "content": "# 更新的PRD文档内容",
  "version": "1.1.0",
  "changeLog": "添加了新的功能需求"
}

Response:
{
  "success": true,
  "data": {
    "prd": {
      "version": "1.1.0",
      "lastModified": "2025-01-02T00:00:00Z"
    }
  }
}
```

### 8.6 变更请求API

#### 8.6.1 获取变更请求列表

```http
GET /api/projects/{projectId}/crs
Authorization: Bearer {jwt_token}

Query Parameters:
- status: pending|approved|rejected|implemented
- type: scope_expansion|requirement_change|technical_change
- priority: low|medium|high|critical

Response:
{
  "success": true,
  "data": {
    "crs": [
      {
        "id": "CR-2025-001",
        "title": "添加区块链支付功能",
        "type": "scope_expansion",
        "status": "pending",
        "priority": "medium",
        "description": "检测到任务超出PRD范围",
        "triggerTask": {
          "id": 15,
          "title": "区块链支付系统"
        },
        "impact": {
          "timeline": "2-3周",
          "resources": "区块链开发专家",
          "budget": "30%增加"
        },
        "createdAt": "2025-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### 8.6.2 审批变更请求

```http
PUT /api/projects/{projectId}/crs/{crId}/approve
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "decision": "approved",
  "comments": "同意添加此功能，但需要调整时间计划",
  "conditions": [
    "需要额外的安全审查",
    "预算需要重新评估"
  ]
}

Response:
{
  "success": true,
  "data": {
    "cr": {
      "id": "CR-2025-001",
      "status": "approved",
      "approvedAt": "2025-01-02T00:00:00Z",
      "approver": "admin@example.com"
    }
  }
}
```

---

## 9. MCP协议

### 9.1 MCP协议概述

Model Context Protocol (MCP) 是一个开放标准，用于AI模型与外部工具和数据源的安全连接。Claude Task Master 实现了完整的MCP服务器，支持与各种IDE和AI客户端的集成。

#### 9.1.1 MCP特性

- **标准化接口**: 遵循MCP 1.0规范
- **多传输协议**: 支持HTTP、SSE、Streamable HTTP
- **工具调用**: 提供39个专业工具
- **多用户支持**: 支持并发多用户访问
- **项目隔离**: 严格的项目级数据隔离

#### 9.1.2 支持的传输协议

1. **HTTP Transport**: 基于HTTP的请求-响应模式
2. **Server-Sent Events (SSE)**: 支持实时数据推送
3. **Streamable HTTP**: 支持流式数据传输

### 9.2 MCP工具列表

#### 9.2.1 任务管理工具

| 工具名称 | 功能描述 | 参数 |
|---------|---------|------|
| `add_task` | 创建新任务 | title, description, priority |
| `get_task` | 获取任务详情 | taskId |
| `list_tasks` | 获取任务列表 | status, priority, assignee |
| `update_task` | 更新任务 | taskId, updates |
| `delete_task` | 删除任务 | taskId |
| `enhance_task` | AI增强任务 | taskId, enhancementType |
| `assign_task` | 分配任务 | taskId, assignee |
| `complete_task` | 完成任务 | taskId, notes |

#### 9.2.2 项目管理工具

| 工具名称 | 功能描述 | 参数 |
|---------|---------|------|
| `create_project` | 创建项目 | name, description |
| `get_project` | 获取项目信息 | projectId |
| `list_projects` | 获取项目列表 | status, owner |
| `update_project` | 更新项目 | projectId, updates |
| `delete_project` | 删除项目 | projectId |
| `switch_project` | 切换当前项目 | projectId |

#### 9.2.3 PRD管理工具

| 工具名称 | 功能描述 | 参数 |
|---------|---------|------|
| `get_prd` | 获取PRD文档 | projectId |
| `update_prd` | 更新PRD文档 | projectId, content |
| `analyze_prd` | 分析PRD文档 | projectId |
| `validate_prd_scope` | 验证PRD范围 | projectId, taskDescription |

#### 9.2.4 变更请求工具

| 工具名称 | 功能描述 | 参数 |
|---------|---------|------|
| `list_crs` | 获取变更请求列表 | projectId, status |
| `get_cr` | 获取变更请求详情 | projectId, crId |
| `create_cr` | 创建变更请求 | projectId, title, description |
| `approve_cr` | 审批变更请求 | projectId, crId, decision |
| `implement_cr` | 实施变更请求 | projectId, crId |

### 9.3 MCP客户端配置

#### 9.3.1 Cursor IDE配置

在Cursor IDE中配置MCP客户端：

```json
{
  "mcpServers": {
    "claude-task-master": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:3001/mcp"
      ],
      "env": {
        "MCP_PROJECT": "demo-complete-project",
        "MCP_USERNAME": "admin",
        "MCP_PASSWORD": "password"
      }
    }
  }
}
```

#### 9.3.2 Claude Desktop配置

```json
{
  "mcpServers": {
    "taskmaster": {
      "command": "node",
      "args": [
        "/path/to/claude-task-master/mcp-server/src/index.js"
      ],
      "env": {
        "PROJECT_ID": "demo-complete-project",
        "API_URL": "http://localhost:3000"
      }
    }
  }
}
```

### 9.4 MCP工具使用示例

#### 9.4.1 创建任务

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "add_task",
    "arguments": {
      "title": "实现用户认证",
      "description": "开发JWT基础的用户认证系统",
      "priority": "high"
    }
  }
}
```

**响应**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "任务创建成功！\n\n任务ID: 16\n标题: 实现用户认证\n状态: pending\n优先级: high\n创建时间: 2025-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### 9.4.2 获取任务列表

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "list_tasks",
    "arguments": {
      "status": "pending",
      "priority": "high"
    }
  }
}
```

#### 9.4.3 PRD范围验证

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "validate_prd_scope",
    "arguments": {
      "taskDescription": "添加区块链支付功能"
    }
  }
}
```

### 9.5 MCP服务器部署

#### 9.5.1 独立部署

```bash
# 启动MCP服务器
cd mcp-server
npm install
npm start

# 或使用PM2
pm2 start src/index.js --name mcp-server
```

#### 9.5.2 Docker部署

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY mcp-server/package*.json ./
RUN npm install --production

COPY mcp-server/src ./src
EXPOSE 3001

CMD ["node", "src/index.js"]
```

---

## 10. 开发指南

### 10.1 开发环境搭建

#### 10.1.1 前置要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- Git
- 代码编辑器 (推荐 VS Code 或 Cursor)

#### 10.1.2 开发工具配置

**VS Code扩展推荐**:
```json
{
  "recommendations": [
    "ms-vscode.vscode-json",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

**ESLint配置** (.eslintrc.js):
```javascript
module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'error',
    'prefer-const': 'error',
    'no-var': 'error'
  }
};
```

### 10.2 代码结构规范

#### 10.2.1 文件命名规范

- **文件名**: 使用kebab-case (例: `task-service.js`)
- **类名**: 使用PascalCase (例: `TaskService`)
- **函数名**: 使用camelCase (例: `createTask`)
- **常量**: 使用UPPER_SNAKE_CASE (例: `MAX_RETRY_ATTEMPTS`)

#### 10.2.2 目录结构规范

```
src/
├── controllers/     # 控制器层
├── services/       # 业务逻辑层
├── middleware/     # 中间件
├── utils/          # 工具函数
├── config/         # 配置文件
├── models/         # 数据模型
└── tests/          # 测试文件
```

#### 10.2.3 代码注释规范

```javascript
/**
 * 创建新任务
 * @param {Object} taskData - 任务数据
 * @param {string} taskData.title - 任务标题
 * @param {string} taskData.description - 任务描述
 * @param {string} [taskData.priority='medium'] - 任务优先级
 * @returns {Promise<Object>} 创建的任务对象
 * @throws {ValidationError} 当任务数据无效时
 * @example
 * const task = await createTask({
 *   title: '实现登录功能',
 *   description: '开发用户登录系统',
 *   priority: 'high'
 * });
 */
async function createTask(taskData) {
  // 实现代码
}
```

### 10.3 测试开发

#### 10.3.1 测试框架配置

**Jest配置** (jest.config.js):
```javascript
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/config/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js']
};
```

#### 10.3.2 单元测试示例

```javascript
// src/tests/services/task-service.test.js
const TaskService = require('../../services/task-service');
const { ValidationError } = require('../../utils/errors');

describe('TaskService', () => {
  let taskService;

  beforeEach(() => {
    taskService = new TaskService();
  });

  describe('createTask', () => {
    it('should create task with valid data', async () => {
      const taskData = {
        title: '测试任务',
        description: '这是一个测试任务',
        priority: 'medium'
      };

      const result = await taskService.createTask(taskData);

      expect(result).toHaveProperty('id');
      expect(result.title).toBe(taskData.title);
      expect(result.status).toBe('pending');
    });

    it('should throw ValidationError for invalid data', async () => {
      const invalidData = {
        description: '缺少标题的任务'
      };

      await expect(taskService.createTask(invalidData))
        .rejects.toThrow(ValidationError);
    });
  });
});
```

#### 10.3.3 集成测试示例

```javascript
// src/tests/integration/api.test.js
const request = require('supertest');
const app = require('../../app');

describe('Task API Integration', () => {
  let authToken;

  beforeAll(async () => {
    // 获取认证token
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'testpass'
      });

    authToken = response.body.data.token;
  });

  describe('POST /api/projects/:projectId/tasks', () => {
    it('should create new task', async () => {
      const taskData = {
        title: '集成测试任务',
        description: '这是集成测试创建的任务',
        priority: 'low'
      };

      const response = await request(app)
        .post('/api/projects/test-project/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.task).toHaveProperty('id');
    });
  });
});
```

### 10.4 调试技巧

#### 10.4.1 日志调试

```javascript
const logger = require('../utils/logger');

// 不同级别的日志
logger.debug('调试信息', { taskId: 123 });
logger.info('操作成功', { operation: 'createTask' });
logger.warn('警告信息', { reason: 'deprecated API' });
logger.error('错误信息', { error: error.message, stack: error.stack });
```

#### 10.4.2 性能监控

```javascript
const performanceMonitor = require('../middleware/performance-monitor');

// 监控函数执行时间
async function createTask(taskData) {
  const timer = performanceMonitor.startTimer('createTask');

  try {
    // 业务逻辑
    const result = await processTask(taskData);
    timer.end({ success: true });
    return result;
  } catch (error) {
    timer.end({ success: false, error: error.message });
    throw error;
  }
}
```

---

## 11. 运维监控

### 11.1 系统监控

#### 11.1.1 健康检查

系统提供多层次的健康检查机制：

**基础健康检查**:
```http
GET /health

Response:
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production"
}
```

**详细健康检查**:
```http
GET /health/detailed

Response:
{
  "status": "healthy",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 15,
      "lastCheck": "2025-01-01T00:00:00Z"
    },
    "aiService": {
      "status": "healthy",
      "provider": "openrouter",
      "responseTime": 250,
      "lastCheck": "2025-01-01T00:00:00Z"
    },
    "fileSystem": {
      "status": "healthy",
      "freeSpace": "85%",
      "lastCheck": "2025-01-01T00:00:00Z"
    }
  },
  "metrics": {
    "requestsPerMinute": 45,
    "averageResponseTime": 120,
    "errorRate": 0.02,
    "activeConnections": 12
  }
}
```

#### 11.1.2 性能指标

**关键性能指标 (KPI)**:
- **响应时间**: API平均响应时间 < 500ms
- **吞吐量**: 每分钟处理请求数
- **错误率**: 错误请求占比 < 1%
- **可用性**: 系统正常运行时间 > 99.9%

**监控脚本**:
```javascript
// scripts/monitor.js
const axios = require('axios');
const logger = require('../src/utils/logger');

class SystemMonitor {
  constructor() {
    this.metrics = {
      responseTime: [],
      errorCount: 0,
      requestCount: 0
    };
  }

  async checkHealth() {
    try {
      const start = Date.now();
      const response = await axios.get('http://localhost:3000/health');
      const responseTime = Date.now() - start;

      this.metrics.responseTime.push(responseTime);
      this.metrics.requestCount++;

      if (response.status !== 200) {
        this.metrics.errorCount++;
        logger.warn('Health check failed', { status: response.status });
      }

      return {
        healthy: response.status === 200,
        responseTime,
        data: response.data
      };
    } catch (error) {
      this.metrics.errorCount++;
      logger.error('Health check error', { error: error.message });
      return { healthy: false, error: error.message };
    }
  }

  getMetrics() {
    const avgResponseTime = this.metrics.responseTime.length > 0
      ? this.metrics.responseTime.reduce((a, b) => a + b) / this.metrics.responseTime.length
      : 0;

    const errorRate = this.metrics.requestCount > 0
      ? this.metrics.errorCount / this.metrics.requestCount
      : 0;

    return {
      averageResponseTime: Math.round(avgResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      totalRequests: this.metrics.requestCount,
      totalErrors: this.metrics.errorCount
    };
  }
}

// 定期监控
const monitor = new SystemMonitor();
setInterval(async () => {
  const health = await monitor.checkHealth();
  const metrics = monitor.getMetrics();

  logger.info('System metrics', { health, metrics });
}, 60000); // 每分钟检查一次
```

### 11.2 日志管理

#### 11.2.1 日志配置

**Winston日志配置**:
```javascript
// src/utils/logger.js
const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'claude-task-master',
    version: process.env.npm_package_version
  },
  transports: [
    // 错误日志
    new winston.transports.File({
      filename: path.join(process.env.LOGS_DIR || './logs', 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),

    // 综合日志
    new winston.transports.File({
      filename: path.join(process.env.LOGS_DIR || './logs', 'combined.log'),
      maxsize: 10485760,
      maxFiles: 10
    }),

    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// 生产环境不输出到控制台
if (process.env.NODE_ENV === 'production') {
  logger.remove(winston.transports.Console);
}

module.exports = logger;
```

#### 11.2.2 日志分析

**日志分析脚本**:
```bash
#!/bin/bash
# scripts/analyze-logs.sh

LOG_DIR=${LOGS_DIR:-./logs}
DATE=$(date +%Y-%m-%d)

echo "=== 日志分析报告 ($DATE) ==="

# 错误统计
echo "错误统计:"
grep -c "\"level\":\"error\"" $LOG_DIR/combined.log

# 响应时间分析
echo "平均响应时间:"
grep "responseTime" $LOG_DIR/combined.log | \
  jq -r '.responseTime' | \
  awk '{sum+=$1; count++} END {print sum/count "ms"}'

# 最频繁的错误
echo "最频繁的错误:"
grep "\"level\":\"error\"" $LOG_DIR/combined.log | \
  jq -r '.message' | \
  sort | uniq -c | sort -nr | head -5

# API调用统计
echo "API调用统计:"
grep "\"method\":" $LOG_DIR/combined.log | \
  jq -r '.method + " " + .path' | \
  sort | uniq -c | sort -nr | head -10
```

### 11.3 备份策略

#### 11.3.1 数据备份

**自动备份脚本**:
```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR=${BACKUP_DIR:-./backup}
PROJECTS_DIR=${PROJECTS_DIR:-./projects}
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR/$DATE

# 备份项目数据
echo "备份项目数据..."
tar -czf $BACKUP_DIR/$DATE/projects_$DATE.tar.gz $PROJECTS_DIR

# 备份配置文件
echo "备份配置文件..."
tar -czf $BACKUP_DIR/$DATE/config_$DATE.tar.gz config/

# 备份日志文件
echo "备份日志文件..."
tar -czf $BACKUP_DIR/$DATE/logs_$DATE.tar.gz logs/

# 清理旧备份 (保留30天)
find $BACKUP_DIR -type d -mtime +30 -exec rm -rf {} \;

echo "备份完成: $BACKUP_DIR/$DATE"
```

#### 11.3.2 恢复策略

**数据恢复脚本**:
```bash
#!/bin/bash
# scripts/restore.sh

if [ $# -ne 1 ]; then
  echo "使用方法: $0 <备份日期>"
  echo "示例: $0 20250101_120000"
  exit 1
fi

BACKUP_DATE=$1
BACKUP_DIR=${BACKUP_DIR:-./backup}
RESTORE_PATH=$BACKUP_DIR/$BACKUP_DATE

if [ ! -d "$RESTORE_PATH" ]; then
  echo "错误: 备份目录不存在: $RESTORE_PATH"
  exit 1
fi

echo "开始恢复数据..."

# 停止服务
echo "停止服务..."
pm2 stop all

# 备份当前数据
echo "备份当前数据..."
mv projects projects.backup.$(date +%Y%m%d_%H%M%S)
mv config config.backup.$(date +%Y%m%d_%H%M%S)

# 恢复数据
echo "恢复项目数据..."
tar -xzf $RESTORE_PATH/projects_$BACKUP_DATE.tar.gz

echo "恢复配置文件..."
tar -xzf $RESTORE_PATH/config_$BACKUP_DATE.tar.gz

# 重启服务
echo "重启服务..."
pm2 start all

echo "数据恢复完成"
```

### 11.4 告警系统

#### 11.4.1 告警配置

**告警规则**:
```javascript
// src/utils/alerting.js
const logger = require('./logger');

class AlertManager {
  constructor() {
    this.rules = [
      {
        name: 'high_error_rate',
        condition: (metrics) => metrics.errorRate > 0.05,
        severity: 'critical',
        message: '错误率过高'
      },
      {
        name: 'slow_response',
        condition: (metrics) => metrics.averageResponseTime > 1000,
        severity: 'warning',
        message: '响应时间过慢'
      },
      {
        name: 'low_disk_space',
        condition: (metrics) => metrics.diskUsage > 0.9,
        severity: 'warning',
        message: '磁盘空间不足'
      }
    ];
  }

  checkAlerts(metrics) {
    const alerts = [];

    for (const rule of this.rules) {
      if (rule.condition(metrics)) {
        const alert = {
          rule: rule.name,
          severity: rule.severity,
          message: rule.message,
          timestamp: new Date().toISOString(),
          metrics
        };

        alerts.push(alert);
        this.sendAlert(alert);
      }
    }

    return alerts;
  }

  sendAlert(alert) {
    logger.error('ALERT', alert);

    // 发送邮件通知
    if (process.env.SMTP_ENABLED === 'true') {
      this.sendEmailAlert(alert);
    }

    // 发送Webhook通知
    if (process.env.WEBHOOK_URL) {
      this.sendWebhookAlert(alert);
    }
  }

  async sendEmailAlert(alert) {
    // 邮件发送实现
  }

  async sendWebhookAlert(alert) {
    // Webhook发送实现
  }
}

module.exports = AlertManager;
```

---

## 12. 故障排除

### 12.1 常见问题

#### 12.1.1 服务启动问题

**问题**: 服务无法启动
```
Error: listen EADDRINUSE :::3000
```

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死占用进程
kill -9 <PID>

# 或者修改端口配置
export EXPRESS_PORT=3001
npm start
```

**问题**: 依赖安装失败
```
npm ERR! peer dep missing
```

**解决方案**:
```bash
# 清理npm缓存
npm cache clean --force

# 删除node_modules重新安装
rm -rf node_modules package-lock.json
npm install

# 或使用yarn
yarn install
```

#### 12.1.2 AI服务问题

**问题**: AI API调用失败
```
Error: Request failed with status code 401
```

**解决方案**:
1. 检查API密钥配置
```bash
echo $OPENROUTER_API_KEY
```

2. 验证API密钥有效性
```bash
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
     https://openrouter.ai/api/v1/models
```

3. 检查网络连接
```bash
ping openrouter.ai
```

**问题**: AI响应超时
```
Error: timeout of 30000ms exceeded
```

**解决方案**:
```javascript
// 增加超时时间
const config = {
  timeout: 60000, // 60秒
  retryAttempts: 3
};
```

#### 12.1.3 数据存储问题

**问题**: 文件权限错误
```
Error: EACCES: permission denied, open 'projects/demo/tasks.json'
```

**解决方案**:
```bash
# 修复文件权限
chmod -R 755 projects/
chown -R $USER:$USER projects/

# 检查磁盘空间
df -h
```

**问题**: 数据文件损坏
```
SyntaxError: Unexpected token in JSON
```

**解决方案**:
```bash
# 从备份恢复
cp backup/latest/projects_*.tar.gz ./
tar -xzf projects_*.tar.gz

# 或手动修复JSON文件
node scripts/repair-json.js projects/demo/tasks.json
```

### 12.2 性能问题

#### 12.2.1 响应时间慢

**诊断步骤**:
1. 检查系统资源使用
```bash
top
htop
iostat -x 1
```

2. 分析日志中的响应时间
```bash
grep "responseTime" logs/combined.log | \
  jq '.responseTime' | \
  sort -n | tail -10
```

3. 检查AI服务响应时间
```bash
curl -w "@curl-format.txt" -o /dev/null -s \
  "http://localhost:3000/api/projects/demo/tasks"
```

**优化方案**:
```javascript
// 添加缓存
const cache = require('./utils/cache');

async function getTasks(projectId) {
  const cacheKey = `tasks:${projectId}`;
  let tasks = await cache.get(cacheKey);

  if (!tasks) {
    tasks = await loadTasksFromFile(projectId);
    await cache.set(cacheKey, tasks, 300); // 5分钟缓存
  }

  return tasks;
}
```

#### 12.2.2 内存泄漏

**检测内存泄漏**:
```javascript
// 内存监控
setInterval(() => {
  const usage = process.memoryUsage();
  console.log({
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB'
  });
}, 10000);
```

**解决方案**:
```javascript
// 正确清理事件监听器
process.on('SIGTERM', () => {
  clearInterval(monitorInterval);
  server.close(() => {
    process.exit(0);
  });
});
```

### 12.3 调试工具

#### 12.3.1 日志分析工具

**实时日志监控**:
```bash
# 实时查看错误日志
tail -f logs/error.log | jq '.'

# 过滤特定错误
tail -f logs/combined.log | grep "ERROR" | jq '.'

# 统计错误类型
grep "ERROR" logs/combined.log | \
  jq -r '.message' | \
  sort | uniq -c | sort -nr
```

#### 12.3.2 性能分析工具

**Node.js性能分析**:
```bash
# 使用clinic.js分析性能
npm install -g clinic
clinic doctor -- node src/server.js

# 使用0x进行火焰图分析
npm install -g 0x
0x src/server.js
```

#### 12.3.3 网络调试

**API调试脚本**:
```bash
#!/bin/bash
# scripts/debug-api.sh

BASE_URL="http://localhost:3000/api"
TOKEN="your_jwt_token"

# 测试健康检查
echo "=== 健康检查 ==="
curl -s "$BASE_URL/../health" | jq '.'

# 测试认证
echo "=== 认证测试 ==="
curl -s -H "Authorization: Bearer $TOKEN" \
     "$BASE_URL/projects" | jq '.'

# 测试任务创建
echo "=== 任务创建测试 ==="
curl -s -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"title":"调试任务","description":"测试任务创建"}' \
     "$BASE_URL/projects/demo/tasks" | jq '.'
```

---

## 13. 扩展开发

### 13.1 插件系统

#### 13.1.1 插件架构

系统支持插件化扩展，允许开发者添加自定义功能：

```javascript
// src/plugins/plugin-manager.js
class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
  }

  registerPlugin(name, plugin) {
    if (this.plugins.has(name)) {
      throw new Error(`Plugin ${name} already registered`);
    }

    // 验证插件接口
    this.validatePlugin(plugin);

    // 注册插件
    this.plugins.set(name, plugin);

    // 注册钩子
    if (plugin.hooks) {
      for (const [hookName, handler] of Object.entries(plugin.hooks)) {
        this.registerHook(hookName, handler);
      }
    }

    // 初始化插件
    if (plugin.init) {
      plugin.init();
    }
  }

  validatePlugin(plugin) {
    const required = ['name', 'version', 'description'];
    for (const field of required) {
      if (!plugin[field]) {
        throw new Error(`Plugin missing required field: ${field}`);
      }
    }
  }

  registerHook(name, handler) {
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }
    this.hooks.get(name).push(handler);
  }

  async executeHook(name, context) {
    const handlers = this.hooks.get(name) || [];
    let result = context;

    for (const handler of handlers) {
      result = await handler(result);
    }

    return result;
  }
}

module.exports = PluginManager;
```

#### 13.1.2 插件示例

**任务增强插件**:
```javascript
// plugins/task-enhancer/index.js
const TaskEnhancerPlugin = {
  name: 'task-enhancer',
  version: '1.0.0',
  description: '任务智能增强插件',

  hooks: {
    'task:beforeCreate': async (taskData) => {
      // 自动生成任务标签
      taskData.tags = await generateTags(taskData.description);
      return taskData;
    },

    'task:afterCreate': async (task) => {
      // 自动估算工时
      task.estimatedHours = await estimateHours(task.description);
      return task;
    }
  },

  init() {
    console.log('Task Enhancer Plugin initialized');
  }
};

async function generateTags(description) {
  // AI生成标签逻辑
  const keywords = await extractKeywords(description);
  return keywords.slice(0, 5);
}

async function estimateHours(description) {
  // AI估算工时逻辑
  const complexity = await analyzeComplexity(description);
  return complexity * 2; // 简单的估算公式
}

module.exports = TaskEnhancerPlugin;
```

### 13.2 自定义MCP工具

#### 13.2.1 工具开发框架

```javascript
// src/mcp/tool-framework.js
class MCPTool {
  constructor(name, description, inputSchema) {
    this.name = name;
    this.description = description;
    this.inputSchema = inputSchema;
  }

  async execute(args, context) {
    throw new Error('execute method must be implemented');
  }

  validate(args) {
    // JSON Schema验证
    const Ajv = require('ajv');
    const ajv = new Ajv();
    const validate = ajv.compile(this.inputSchema);

    if (!validate(args)) {
      throw new Error(`Invalid arguments: ${ajv.errorsText(validate.errors)}`);
    }
  }
}

// 自定义工具示例
class CustomAnalyticsTool extends MCPTool {
  constructor() {
    super(
      'analyze_project_metrics',
      '分析项目指标和统计数据',
      {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          timeRange: { type: 'string', enum: ['week', 'month', 'quarter'] },
          metrics: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['projectId']
      }
    );
  }

  async execute(args, context) {
    this.validate(args);

    const { projectId, timeRange = 'month', metrics = ['tasks', 'performance'] } = args;

    // 获取项目数据
    const project = await context.projectService.getProject(projectId);
    const tasks = await context.taskService.getTasks(projectId);

    // 计算指标
    const analytics = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      averageCompletionTime: this.calculateAverageCompletionTime(tasks),
      productivityTrend: this.calculateProductivityTrend(tasks, timeRange)
    };

    return {
      content: [{
        type: 'text',
        text: this.formatAnalyticsReport(analytics)
      }]
    };
  }

  calculateAverageCompletionTime(tasks) {
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.completedAt);
    if (completedTasks.length === 0) return 0;

    const totalTime = completedTasks.reduce((sum, task) => {
      const created = new Date(task.createdAt);
      const completed = new Date(task.completedAt);
      return sum + (completed - created);
    }, 0);

    return Math.round(totalTime / completedTasks.length / (1000 * 60 * 60 * 24)); // 天数
  }

  formatAnalyticsReport(analytics) {
    return `
# 项目分析报告

## 任务统计
- 总任务数: ${analytics.totalTasks}
- 已完成任务: ${analytics.completedTasks}
- 完成率: ${Math.round(analytics.completedTasks / analytics.totalTasks * 100)}%

## 性能指标
- 平均完成时间: ${analytics.averageCompletionTime} 天
- 生产力趋势: ${analytics.productivityTrend}
    `;
  }
}

module.exports = { MCPTool, CustomAnalyticsTool };
```

### 13.3 API扩展

#### 13.3.1 自定义路由

```javascript
// src/routes/custom/analytics.js
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const AnalyticsService = require('../../services/analytics-service');

// 项目分析API
router.get('/projects/:projectId/analytics', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { timeRange, metrics } = req.query;

    const analyticsService = new AnalyticsService();
    const analytics = await analyticsService.analyzeProject(projectId, {
      timeRange,
      metrics: metrics ? metrics.split(',') : undefined
    });

    res.json({
      success: true,
      data: { analytics }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

// 团队生产力分析
router.get('/teams/:teamId/productivity', auth, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { startDate, endDate } = req.query;

    const analyticsService = new AnalyticsService();
    const productivity = await analyticsService.analyzeTeamProductivity(teamId, {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    });

    res.json({
      success: true,
      data: { productivity }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

module.exports = router;
```

#### 13.3.2 中间件扩展

```javascript
// src/middleware/custom/rate-limiter.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

// 创建Redis客户端
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

// 自定义限流中间件
const createCustomRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15分钟
    max = 100, // 最大请求数
    keyGenerator = (req) => req.ip,
    skipSuccessfulRequests = false
  } = options;

  return rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:'
    }),
    windowMs,
    max,
    keyGenerator,
    skipSuccessfulRequests,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '请求过于频繁，请稍后再试',
          retryAfter: Math.round(windowMs / 1000)
        }
      });
    }
  });
};

module.exports = createCustomRateLimit;
```

### 13.4 数据库扩展

#### 13.4.1 数据模型扩展

```javascript
// src/models/extended/team.js
class Team {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.members = data.members || [];
    this.projects = data.projects || [];
    this.settings = data.settings || {};
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  addMember(userId, role = 'member') {
    if (this.members.find(m => m.userId === userId)) {
      throw new Error('User already in team');
    }

    this.members.push({
      userId,
      role,
      joinedAt: new Date().toISOString()
    });

    this.updatedAt = new Date().toISOString();
  }

  removeMember(userId) {
    const index = this.members.findIndex(m => m.userId === userId);
    if (index === -1) {
      throw new Error('User not in team');
    }

    this.members.splice(index, 1);
    this.updatedAt = new Date().toISOString();
  }

  assignProject(projectId) {
    if (!this.projects.includes(projectId)) {
      this.projects.push(projectId);
      this.updatedAt = new Date().toISOString();
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      members: this.members,
      projects: this.projects,
      settings: this.settings,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Team;
```

---

## 结语

Claude Task Master 是一个功能完整、架构清晰的AI驱动任务管理系统。本文档详细介绍了系统的各个方面，从架构设计到具体实现，从安装部署到运维监控，为开发者和运维人员提供了全面的指导。

系统的模块化设计和插件架构使其具有良好的可扩展性，可以根据具体需求进行定制和扩展。通过MCP协议的支持，系统可以与各种IDE和AI工具无缝集成，为开发团队提供强大的项目管理能力。

希望这份文档能够帮助您更好地理解、使用和维护Claude Task Master系统。如有任何问题或建议，欢迎通过GitHub Issues或其他渠道与我们联系。
```
```
```
```
```
```
```