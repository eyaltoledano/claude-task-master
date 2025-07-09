# Claude Task Master 远程服务开发文档

## 📋 目录

1. [项目概述](#项目概述)
2. [架构设计](#架构设计)
3. [技术栈](#技术栈)
4. [目录结构](#目录结构)
5. [核心功能](#核心功能)
6. [服务架构](#服务架构)
7. [API文档](#api文档)
8. [MCP工具文档](#mcp工具文档)
9. [部署指南](#部署指南)
10. [开发流程](#开发流程)
11. [故障排除](#故障排除)
12. [未来规划](#未来规划)

---

## 📖 项目概述

### 项目背景
Claude Task Master 是一个基于 Node.js 的 AI 驱动任务管理系统，采用 MCP（Model Context Protocol）架构。项目从单机版本演进为支持多项目、多用户的远程服务系统。

### 核心特性
- 🤖 **AI 驱动**：支持 10+ 种 AI 提供商（OpenRouter、Anthropic、OpenAI 等）
- 🔧 **MCP 架构**：提供标准化的 AI 工具接口
- 🌐 **远程服务**：支持多用户、多项目并发访问
- 🎯 **IDE 集成**：支持 Cursor、VS Code、Claude 等多种 IDE
- 📝 **PRD 解析**：自动从产品需求文档生成结构化任务
- 🔄 **任务管理**：完整的 CRUD 操作和状态管理

### 设计原则
1. **保持兼容性**：不修改原始 TaskMaster 代码
2. **适配器模式**：通过适配器扩展功能
3. **分层架构**：清晰的 API、服务、数据分层
4. **多租户支持**：项目和用户隔离
5. **可扩展性**：模块化设计，易于扩展

---

## 🏗️ 架构设计

### 整体架构图
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cursor IDE    │    │   VS Code IDE   │    │   Web Browser   │
│                 │    │                 │    │                 │
│  MCP Client     │    │  MCP Client     │    │  Web Frontend   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ MCP Protocol         │ MCP Protocol         │ HTTP
          │                      │                      │
          └──────────┬───────────┘                      │
                     │                                  │
┌────────────────────▼────────────────────┐            │
│         MCP HTTP Server                 │            │
│         (Port 3001)                     │            │
│                                         │            │
│  • 42 MCP Tools                        │            │
│  • Project Management                  │            │
│  • Task Operations                     │            │
│  • IDE Config Management               │            │
└────────────────────┬────────────────────┘            │
                     │                                  │
                     │ Internal API                     │
                     │                                  │
┌────────────────────▼────────────────────┐            │
│         Express API Server              │◄───────────┘
│         (Port 3000)                     │
│                                         │
│  • RESTful APIs                        │
│  • Project CRUD                        │
│  • Task Management                     │
│  • PRD Processing                      │
│  • File Management                     │
└────────────────────┬────────────────────┘
                     │
                     │
┌────────────────────▼────────────────────┐
│         Core TaskMaster                 │
│                                         │
│  • Original Scripts (Unmodified)       │
│  • Config Manager                      │
│  • AI Service Integration              │
│  • Task Processing Logic               │
└─────────────────────────────────────────┘
```

### 数据流架构
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │    │   Service   │    │    Data     │
│             │    │             │    │             │
│ • IDE       │───▶│ • MCP HTTP  │───▶│ • Projects  │
│ • Web UI    │    │ • Express   │    │ • Tasks     │
│ • API       │    │ • Adapters  │    │ • Config    │
└─────────────┘    └─────────────┘    └─────────────┘
```

---

## 💻 技术栈

### 后端技术
- **Node.js** (v18+): 运行时环境
- **ES6 Modules**: 模块系统
- **Express.js**: Web 框架
- **MCP Protocol**: AI 工具协议
- **File System**: 数据存储

### AI 集成
- **OpenRouter**: 主要 AI 提供商
- **Anthropic Claude**: 备用提供商
- **OpenAI**: 备用提供商
- **其他**: Perplexity, Google, XAI, Mistral 等

### 前端技术
- **HTML5/CSS3**: 基础结构和样式
- **Vanilla JavaScript**: 交互逻辑
- **Fetch API**: HTTP 请求
- **响应式设计**: 多设备支持

### 开发工具
- **Git**: 版本控制
- **npm**: 包管理
- **ESLint**: 代码规范
- **Cursor/VS Code**: 开发环境

---

## 📁 目录结构

### 项目根目录
```
claude-task-master/
├── docs/                          # 📚 文档目录
│   ├── DEVELOPMENT.md             # 开发文档
│   ├── API.md                     # API 文档
│   └── DEPLOYMENT.md              # 部署文档
├── express-api/                   # 🌐 Express API 服务
│   ├── routes/                    # 路由定义
│   ├── services/                  # 业务服务
│   ├── middleware/                # 中间件
│   └── server.js                  # 服务入口
├── mcp-http/                      # 🔧 MCP HTTP 服务
│   └── server.js                  # MCP 服务器
├── web-frontend/                  # 🎨 Web 前端
│   ├── public/                    # 静态资源
│   ├── src/                       # 源代码
│   └── server.js                  # 前端服务器
├── scripts/                       # 📜 原始 TaskMaster 脚本
│   ├── modules/                   # 核心模块
│   ├── init.js                    # 项目初始化
│   └── *.js                       # 其他脚本
├── projects/                      # 📂 项目数据目录
│   ├── project-1/                 # 项目 1
│   ├── project-2/                 # 项目 2
│   └── .../                       # 其他项目
├── .cursor/                       # 🎯 Cursor IDE 配置
├── .vscode/                       # 💻 VS Code 配置
├── .github/                       # 🐙 GitHub 配置
├── package.json                   # 📦 项目配置
└── README.md                      # 📖 项目说明
```

### 项目数据结构
```
projects/{project-id}/
├── .taskmaster/                   # TaskMaster 数据
│   ├── tasks.json                # 任务数据
│   ├── config.json               # 项目配置
│   └── metadata.json             # 元数据
├── .cursor/                       # IDE 配置（可选）
├── .vscode/                       # IDE 配置（可选）
└── README.md                      # 项目说明
```

---

## ⚙️ 核心功能

### 1. 项目管理
- **创建项目**: 支持模板和自定义配置
- **项目列表**: 分页、搜索、过滤
- **项目详情**: 查看项目信息和统计
- **项目删除**: 安全删除和数据清理

### 2. 任务管理
- **任务 CRUD**: 创建、读取、更新、删除
- **状态管理**: pending, in_progress, done, blocked
- **优先级**: high, medium, low
- **标签系统**: 灵活的标签分类
- **子任务**: 层级任务结构

### 3. PRD 解析
- **智能解析**: AI 驱动的需求文档分析
- **任务生成**: 自动生成结构化任务列表
- **多格式支持**: 文本、Markdown、PDF
- **自定义模板**: 可配置的生成模板

### 4. AI 集成
- **多提供商**: 支持 10+ AI 服务商
- **智能路由**: 自动选择最佳提供商
- **错误恢复**: 提供商故障自动切换
- **成本优化**: 基于成本的模型选择

### 5. IDE 配置管理
- **配置同步**: 服务器到客户端的配置同步
- **多 IDE 支持**: Cursor, VS Code, Claude 等
- **自动化脚本**: 一键配置部署
- **版本管理**: 配置文件版本控制

---

## 🏢 服务架构

### 三层服务架构

#### 1. Express API 服务 (Port 3000)
**职责**: 核心业务逻辑和数据管理
- **项目管理**: CRUD 操作
- **任务管理**: 完整的任务生命周期
- **PRD 处理**: AI 驱动的需求解析
- **文件管理**: 项目文件和配置
- **用户认证**: 基于 Header 的认证

**关键特性**:
- RESTful API 设计
- 中间件架构
- 错误处理和日志
- 数据验证
- 缓存机制

#### 2. MCP HTTP 服务 (Port 3001)
**职责**: MCP 协议实现和工具提供
- **42 个 MCP 工具**: 完整的任务管理工具集
- **协议适配**: MCP 2025-03-26 协议支持
- **多项目支持**: 基于 Header 的项目切换
- **实时通信**: 支持 HTTP 和 SSE
- **工具路由**: 智能工具分发

**工具分组**:
- Group 1: 基础任务操作 (8 个工具)
- Group 2: 高级任务管理 (6 个工具)
- Group 3: 项目和配置 (4 个工具)
- Group 4: 文件和模板 (6 个工具)
- Group 5: 分析和报告 (5 个工具)
- Group 6: 导入导出 (4 个工具)
- Group 7: 实用工具 (4 个工具)
- Group 8: 研究功能 (1 个工具)
- Group 8.5: IDE 配置管理 (1 个工具)
- Group 9: PRD 范围管理 (3 个工具)

#### 3. Web 前端服务 (Port 3002)
**职责**: 用户界面和交互体验
- **项目管理界面**: 可视化项目操作
- **任务看板**: 直观的任务管理
- **PRD 上传**: 拖拽式文件上传
- **实时反馈**: 操作状态显示
- **响应式设计**: 多设备适配

**技术实现**:
- 单页应用 (SPA)
- 组件化设计
- API 代理功能
- 实时数据更新
- 错误处理

### 服务间通信

#### Express API ↔ MCP HTTP
```javascript
// MCP HTTP 调用 Express API
const response = await fetch(`${this.apiUrl}/api/projects/${projectId}/tasks`);
```

#### Web Frontend ↔ Express API
```javascript
// Web 前端调用 Express API
const response = await this.apiRequest('/api/projects', 'POST', projectData);
```

#### Web Frontend ↔ MCP HTTP (代理)
```javascript
// Web 前端代理 MCP 请求
app.get('/api/projects/:projectId/ide-config/:ideType?', async (req, res) => {
  const response = await fetch(`${expressApiUrl}${apiPath}`);
  response.body.pipe(res);
});
```

---

## 📡 API 文档

### Express API 端点

#### 项目管理 API

**GET /api/projects**
- **描述**: 获取项目列表
- **参数**:
  - `page`: 页码 (默认: 1)
  - `limit`: 每页数量 (默认: 10)
  - `search`: 搜索关键词
- **响应**:
```json
{
  "success": true,
  "data": {
    "projects": [...],
    "pagination": {...}
  }
}
```

**POST /api/projects**
- **描述**: 创建新项目
- **请求体**:
```json
{
  "id": "project-id",
  "name": "项目名称",
  "description": "项目描述",
  "template": "default"
}
```

**GET /api/projects/:projectId**
- **描述**: 获取项目详情
- **响应**: 项目完整信息

**DELETE /api/projects/:projectId**
- **描述**: 删除项目
- **响应**: 删除确认

#### 任务管理 API

**GET /api/projects/:projectId/tasks**
- **描述**: 获取任务列表
- **参数**:
  - `status`: 任务状态过滤
  - `priority`: 优先级过滤
  - `tag`: 标签过滤
  - `withSubtasks`: 包含子任务

**POST /api/projects/:projectId/tasks**
- **描述**: 创建新任务
- **请求体**:
```json
{
  "title": "任务标题",
  "description": "任务描述",
  "priority": "high",
  "tags": ["tag1", "tag2"]
}
```

**PUT /api/projects/:projectId/tasks/:taskId**
- **描述**: 更新任务
- **请求体**: 任务更新数据

**DELETE /api/projects/:projectId/tasks/:taskId**
- **描述**: 删除任务

#### PRD 处理 API

**POST /api/projects/:projectId/tasks/generate-from-prd**
- **描述**: 从 PRD 生成任务
- **请求体**:
```json
{
  "prdContent": "PRD 文档内容",
  "numTasks": 10
}
```
- **响应**: 生成的任务列表和遥测数据

#### IDE 配置 API

**GET /api/projects/:projectId/ide-config/:ideType?**
- **描述**: 下载 IDE 配置文件
- **参数**:
  - `ideType`: IDE 类型 (可选)
- **响应**: ZIP 文件流

---

## 🔧 MCP 工具文档

### 工具总览
MCP HTTP 服务提供 42 个专业工具，涵盖任务管理的各个方面。

### 核心工具分类

#### Group 1: 基础任务操作
- `get-tasks`: 获取任务列表
- `get-task`: 获取单个任务详情
- `add-task`: 添加新任务
- `update-task`: 更新任务信息
- `delete-task`: 删除任务
- `complete-task`: 标记任务完成
- `set-task-status`: 设置任务状态
- `set-task-priority`: 设置任务优先级

#### Group 2: 高级任务管理
- `add-subtask`: 添加子任务
- `move-task`: 移动任务位置
- `duplicate-task`: 复制任务
- `bulk-update-tasks`: 批量更新任务
- `search-tasks`: 搜索任务
- `filter-tasks`: 过滤任务

#### Group 3: 项目和配置
- `get-project-info`: 获取项目信息
- `get-config`: 获取配置信息
- `update-config`: 更新配置
- `reset-config`: 重置配置

#### Group 4: 文件和模板
- `save-tasks-to-file`: 保存任务到文件
- `load-tasks-from-file`: 从文件加载任务
- `export-tasks`: 导出任务
- `import-tasks`: 导入任务
- `get-templates`: 获取模板
- `apply-template`: 应用模板

#### Group 5: 分析和报告
- `get-task-stats`: 获取任务统计
- `get-progress-report`: 获取进度报告
- `get-time-tracking`: 获取时间跟踪
- `analyze-productivity`: 分析生产力
- `generate-summary`: 生成摘要

#### Group 6: 导入导出
- `export-to-json`: 导出为 JSON
- `export-to-csv`: 导出为 CSV
- `import-from-json`: 从 JSON 导入
- `import-from-csv`: 从 CSV 导入

#### Group 7: 实用工具
- `validate-tasks`: 验证任务
- `cleanup-tasks`: 清理任务
- `backup-data`: 备份数据
- `restore-data`: 恢复数据

#### Group 8: 研究功能
- `research`: 研究功能工具

#### Group 8.5: IDE 配置管理
- `get_ide_config_content`: 获取 IDE 配置内容

#### Group 9: PRD 范围管理
- `validate_prd_scope`: 验证 PRD 范围
- `track_scope_changes`: 跟踪范围变更
- `generate_change_request`: 生成变更请求

### 重点工具详解

#### `get_ide_config_content`
**功能**: 获取 IDE 配置文件内容，支持客户端文件创建

**参数**:
```json
{
  "ideType": "cursor",  // 可选: cursor, vscode, claude 等
  "format": "script"    // content 或 script
}
```

**使用场景**:
1. **获取配置内容**: 查看所有 IDE 配置文件
2. **生成创建脚本**: 自动生成客户端部署脚本
3. **配置同步**: 将服务器配置同步到客户端

**输出格式**:
- `content`: 显示文件路径和内容
- `script`: 生成可执行的 bash 脚本

#### `research`
**功能**: AI 驱动的研究和分析工具

**参数**:
```json
{
  "query": "研究主题",
  "scope": "project",
  "depth": "detailed"
}
```

---

## 🚀 部署指南

### 环境要求
- **Node.js**: v18.0.0 或更高版本
- **npm**: v8.0.0 或更高版本
- **操作系统**: macOS, Linux, Windows
- **内存**: 最少 2GB RAM
- **存储**: 最少 1GB 可用空间

### 安装步骤

#### 1. 克隆项目
```bash
git clone https://github.com/mrhaoqi/claude-task-master.git
cd claude-task-master
```

#### 2. 安装依赖
```bash
npm install
```

#### 3. 配置环境变量
创建 `.env` 文件：
```bash
# AI 服务配置
OPENROUTER_API_KEY=your_openrouter_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key

# 服务配置
EXPRESS_API_PORT=3000
MCP_HTTP_PORT=3001
WEB_FRONTEND_PORT=3002

# 数据目录
PROJECTS_DIR=./projects
```

#### 4. 初始化项目结构
```bash
mkdir -p projects
mkdir -p logs
```

### 启动服务

#### 开发模式
```bash
# 启动所有服务
npm run dev

# 或分别启动
npm run server:dev      # Express API (Port 3000)
npm run mcp-http       # MCP HTTP (Port 3001)
npm run web-frontend   # Web Frontend (Port 3002)
```

#### 生产模式
```bash
npm run start
```

### 服务验证

#### 1. Express API 健康检查
```bash
curl http://localhost:3000/health
```

#### 2. MCP HTTP 健康检查
```bash
curl http://localhost:3001/health
```

#### 3. Web 前端访问
```bash
open http://localhost:3002
```

### IDE 配置

#### Cursor IDE 配置
1. 在项目根目录创建 `.cursor/mcp.json`：
```json
{
  "mcpServers": {
    "claude-task-master": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3001/mcp"],
      "env": {
        "X-PROJECT": "your-project-id",
        "X-USERNAME": "your-username",
        "X-PASSWORD": "your-password"
      }
    }
  }
}
```

2. 重启 Cursor IDE
3. 验证 MCP 连接和工具列表

#### VS Code 配置
类似 Cursor 配置，使用 VS Code MCP 扩展。

---

## 🔄 开发流程

### 核心开发原则

#### 1. 保持原始代码不变
- **原则**: 不修改 `scripts/` 目录下的原始 TaskMaster 代码
- **实现**: 通过适配器模式扩展功能
- **好处**: 保持与原版的兼容性，便于升级

#### 2. 适配器模式设计
```javascript
// 示例：CoreAdapter 适配原始功能
class CoreAdapter {
  constructor(projectManager) {
    this.projectManager = projectManager;
  }

  async parsePRD(projectId, options) {
    // 适配原始 parsePRD 功能到新架构
    return await this.generateObjectService.generateObject(prompt, options);
  }
}
```

#### 3. 分层架构实现
```
┌─────────────────┐
│   API Layer     │  ← Express Routes
├─────────────────┤
│  Service Layer  │  ← Business Logic & Adapters
├─────────────────┤
│   Data Layer    │  ← File System & Original Scripts
└─────────────────┘
```

### 开发工作流

#### 1. 功能开发流程
1. **需求分析**: 明确功能需求和设计目标
2. **架构设计**: 设计适配器和服务层
3. **接口定义**: 定义 API 和 MCP 工具接口
4. **实现开发**: 编写适配器和业务逻辑
5. **测试验证**: 单元测试和集成测试
6. **文档更新**: 更新 API 文档和使用说明

#### 2. 代码提交规范
- **提交频率**: 功能完成后分批提交
- **提交信息**: 使用中文，描述清晰
- **提交范围**: 每次提交一个完整功能
- **权限控制**: 需要用户明确允许才能提交

#### 3. 版本管理策略
```bash
# 功能分支开发
git checkout -b feature/new-feature
git commit -m "新增：XXX功能实现"

# 合并到主分支
git checkout main
git merge feature/new-feature
```

### 代码规范

#### 1. 文件命名
- **kebab-case**: 文件和目录使用短横线命名
- **camelCase**: JavaScript 变量和函数
- **PascalCase**: 类名和构造函数

#### 2. 代码结构
```javascript
// 标准模块结构
import { dependency } from 'module';

class ServiceClass {
  constructor(options) {
    this.options = options;
  }

  async publicMethod() {
    // 公共方法实现
  }

  _privateMethod() {
    // 私有方法实现
  }
}

export default ServiceClass;
```

#### 3. 错误处理
```javascript
// 统一错误处理模式
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  logger.error('操作失败', { error: error.message });
  return { success: false, error: error.message };
}
```

---

## 🔍 故障排除

### 常见问题和解决方案

#### 1. 服务启动问题

**问题**: 端口被占用
```bash
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方案**:
```bash
# 查找占用端口的进程
lsof -ti:3000

# 终止进程
lsof -ti:3000 | xargs kill -9

# 或使用 npm 脚本
npm run kill-ports
```

**问题**: 依赖安装失败
```bash
npm ERR! peer dep missing
```

**解决方案**:
```bash
# 清理缓存
npm cache clean --force

# 删除 node_modules 重新安装
rm -rf node_modules package-lock.json
npm install
```

#### 2. MCP 连接问题

**问题**: IDE 无法连接 MCP 服务
```
MCP connection failed: ECONNREFUSED
```

**解决方案**:
1. 检查 MCP HTTP 服务状态
2. 验证端口配置 (3001)
3. 检查防火墙设置
4. 验证 IDE 配置文件

**问题**: MCP 工具列表为空
```
No tools available
```

**解决方案**:
1. 检查项目 ID 配置
2. 验证认证信息
3. 查看服务器日志
4. 重启 MCP 服务

#### 3. API 调用问题

**问题**: 404 Not Found
```bash
POST /api/projects/xxx/tasks/generate-from-prd 404
```

**解决方案**:
1. 检查路由定义
2. 验证项目 ID 存在
3. 检查请求格式
4. 查看服务器日志

**问题**: AI 服务调用失败
```
Failed to generate tasks: API key invalid
```

**解决方案**:
1. 检查 API 密钥配置
2. 验证 AI 服务商状态
3. 检查网络连接
4. 尝试备用提供商

#### 4. 文件系统问题

**问题**: 项目目录不存在
```
ENOENT: no such file or directory, open 'projects/xxx'
```

**解决方案**:
```bash
# 创建项目目录
mkdir -p projects

# 检查权限
chmod 755 projects

# 验证目录结构
ls -la projects/
```

### 调试技巧

#### 1. 日志调试
```javascript
// 启用详细日志
process.env.DEBUG = 'taskmaster:*';

// 查看实时日志
tail -f logs/app.log
```

#### 2. 网络调试
```bash
# 测试 API 连接
curl -v http://localhost:3000/health

# 测试 MCP 连接
curl -v http://localhost:3001/health

# 检查端口监听
netstat -tulpn | grep :300
```

#### 3. 性能监控
```javascript
// 添加性能监控
console.time('operation');
await operation();
console.timeEnd('operation');
```

---

## 🚀 未来规划

### 短期目标 (1-3 个月)

#### 1. 功能完善
- **认证系统**: 实现用户认证和权限管理
- **实时通知**: WebSocket 实时消息推送
- **数据分析**: 任务和项目数据分析报告
- **移动端**: 响应式设计优化

#### 2. 性能优化
- **缓存机制**: Redis 缓存热点数据
- **数据库**: 从文件系统迁移到数据库
- **负载均衡**: 支持多实例部署
- **CDN**: 静态资源 CDN 加速

#### 3. 开发体验
- **单元测试**: 完善测试覆盖率
- **CI/CD**: 自动化部署流水线
- **文档**: 完善 API 和开发文档
- **监控**: 应用性能监控 (APM)

### 中期目标 (3-6 个月)

#### 1. 架构升级
- **微服务**: 拆分为独立微服务
- **容器化**: Docker 容器化部署
- **服务网格**: Istio 服务治理
- **云原生**: Kubernetes 编排

#### 2. 功能扩展
- **插件系统**: 第三方插件支持
- **工作流**: 可视化工作流编辑器
- **集成**: 更多第三方工具集成
- **AI 增强**: 更智能的 AI 助手

#### 3. 企业特性
- **多租户**: 企业级多租户支持
- **SSO**: 单点登录集成
- **审计**: 操作审计和合规
- **备份**: 自动化数据备份

### 长期目标 (6-12 个月)

#### 1. 生态建设
- **开源社区**: 建立开源社区
- **插件市场**: 第三方插件市场
- **开发者工具**: SDK 和开发工具
- **培训**: 用户培训和认证

#### 2. 商业化
- **SaaS 服务**: 云端 SaaS 版本
- **企业版**: 私有化部署版本
- **技术支持**: 专业技术支持服务
- **咨询服务**: 实施和咨询服务

#### 3. 技术创新
- **AI 原生**: 深度 AI 集成
- **边缘计算**: 边缘节点部署
- **区块链**: 去中心化特性
- **量子计算**: 量子算法优化

---

## 📞 联系和支持

### 开发团队
- **项目负责人**: 好奇 (mrhaoqi@163.com)
- **技术架构**: Claude Sonnet 4 + Augment Agent
- **项目地址**: https://github.com/mrhaoqi/claude-task-master

### 技术支持
- **文档**: 查看项目文档和 README
- **Issues**: GitHub Issues 提交问题
- **讨论**: GitHub Discussions 技术讨论
- **邮件**: 技术支持邮箱

### 贡献指南
欢迎社区贡献！请遵循以下流程：
1. Fork 项目仓库
2. 创建功能分支
3. 提交代码变更
4. 创建 Pull Request
5. 代码审查和合并

---

*本文档持续更新，最后更新时间: 2025-07-09*
