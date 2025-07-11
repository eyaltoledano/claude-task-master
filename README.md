# Claude Task Master

一个基于 Node.js 的 AI 驱动任务管理系统，采用 MCP (Model Context Protocol) 架构，支持多种 AI 提供商和 IDE 集成。从单机版本演进为支持多项目、多用户的远程服务系统。

## ✨ 特性

- 🤖 **AI 驱动**: 支持 10+ 种 AI 提供商（OpenRouter、Anthropic、OpenAI 等）
- 🔧 **MCP 架构**: 提供标准化的 AI 工具接口，42 个专业工具
- 🌐 **远程服务**: 支持多用户、多项目并发访问
- 🎯 **IDE 集成**: 支持 Cursor、VS Code、Claude 等多种 IDE
- 📝 **PRD 解析**: 自动从产品需求文档生成结构化任务
- 🔄 **任务管理**: 完整的 CRUD 操作和状态管理
- 📁 **IDE 配置同步**: 一键同步 IDE 配置文件到客户端
- 🎨 **Web 界面**: 现代化的 Web 管理界面

## 🏗️ 架构概览

### 三层服务架构
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cursor IDE    │    │   VS Code IDE   │    │   Web Browser   │
│  MCP Client     │    │  MCP Client     │    │  Web Frontend   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │ MCP Protocol         │ MCP Protocol         │ HTTP
          └──────────┬───────────┘                      │
                     │                                  │
┌────────────────────▼────────────────────┐            │
│         MCP HTTP Server                 │            │
│         (Port 3001)                     │            │
│  • 42 MCP Tools                        │            │
│  • Project Management                  │            │
│  • IDE Config Management               │            │
└────────────────────┬────────────────────┘            │
                     │ Internal API                     │
┌────────────────────▼────────────────────┐            │
│         Express API Server              │◄───────────┘
│         (Port 3000)                     │
│  • RESTful APIs                        │
│  • Project CRUD                        │
│  • Task Management                     │
│  • PRD Processing                      │
└─────────────────────────────────────────┘
```

### 核心服务
- **Express API** (Port 3000): RESTful API 服务，核心业务逻辑
- **MCP HTTP** (Port 3001): MCP 协议服务，42 个专业工具
- **Web Frontend** (Port 3002): Web 界面服务，项目管理界面

## 🚀 快速开始

### 环境要求
- **Node.js**: v18.0.0 或更高版本
- **npm**: v8.0.0 或更高版本
- **操作系统**: macOS, Linux, Windows
- **内存**: 最少 2GB RAM

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/mrhaoqi/claude-task-master.git
cd claude-task-master

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，添加 AI 服务 API 密钥

# 4. 启动服务
npm run dev
```

### 环境配置

创建 `.env` 文件：

```bash
# AI 服务配置（至少配置一个）
OPENROUTER_API_KEY=your_openrouter_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# 服务端口配置
EXPRESS_API_PORT=3000
MCP_HTTP_PORT=3001
WEB_FRONTEND_PORT=3002
```

### 验证部署

```bash
# 检查服务状态
curl http://localhost:3000/health  # Express API
curl http://localhost:3001/health  # MCP HTTP
curl http://localhost:3002/        # Web Frontend

# 访问 Web 界面
open http://localhost:3002
```

## 💻 使用方法

### 1. Web 界面管理

访问 `http://localhost:3002` 使用现代化的 Web 界面：

- **项目管理**: 创建、查看、删除项目
- **任务管理**: 可视化任务看板
- **PRD 上传**: 拖拽上传 PRD 文档，自动生成任务
- **IDE 配置下载**: 一键下载 IDE 配置文件

### 2. IDE 集成（推荐）

#### Cursor IDE 配置
在项目根目录创建 `.cursor/mcp.json`：

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

#### 可用的 MCP 工具（42 个）
- **基础任务操作**: get-tasks, add-task, update-task, delete-task 等
- **高级任务管理**: search-tasks, bulk-update-tasks, move-task 等
- **项目配置**: get-project-info, update-config 等
- **IDE 配置管理**: get_ide_config_content（获取 IDE 配置）
- **PRD 范围管理**: validate_prd_scope, track_scope_changes 等

#### IDE 配置同步
使用 `get_ide_config_content` 工具：

```json
{
  "name": "get_ide_config_content",
  "arguments": {
    "ideType": "cursor",
    "format": "script"
  }
}
```

生成的脚本可以一键在客户端创建所有 IDE 配置文件。

### 3. API 调用

```bash
# 获取项目列表
curl -H "X-PROJECT: my-project" \
     -H "X-USERNAME: user" \
     -H "X-PASSWORD: pass" \
     http://localhost:3000/api/projects

# 创建新项目
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "X-PROJECT: my-project" \
  -d '{"id":"new-project","name":"New Project"}'

# 从 PRD 生成任务
curl -X POST http://localhost:3000/api/projects/my-project/tasks/generate-from-prd \
  -H "Content-Type: application/json" \
  -d '{"prdContent":"产品需求文档内容...","numTasks":10}'
```

## 📚 文档

- [📖 开发文档](docs/DEVELOPMENT.md) - 详细的架构设计和开发指南
- [📡 API 文档](docs/API.md) - 完整的 API 接口文档
- [🚀 部署指南](docs/DEPLOYMENT.md) - 生产环境部署指南

## 🔧 开发

### 开发脚本

```bash
# 开发模式（推荐）
npm run dev                 # 启动所有服务

# 单独启动服务
npm run server:dev          # Express API 开发模式
npm run mcp-http           # MCP HTTP 服务
npm run web-frontend       # Web 前端服务

# 代码质量
npm run lint               # ESLint 检查
npm run test               # 运行测试
```

### 项目结构

```
claude-task-master/
├── docs/                  # 📚 文档
├── express-api/           # 🌐 Express API 服务
├── mcp-http/             # 🔧 MCP HTTP 服务
├── web-frontend/         # 🎨 Web 前端服务
├── scripts/              # 📜 原始 TaskMaster 脚本
├── projects/             # 📂 项目数据目录
├── .cursor/              # 🎯 Cursor IDE 配置
├── .vscode/              # 💻 VS Code 配置
└── package.json          # 📦 项目配置
```

## 🤝 贡献

欢迎贡献代码！请遵循以下流程：

1. Fork 项目仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交变更 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系方式

- **项目负责人**: 好奇 (mrhaoqi@163.com)
- **项目地址**: https://github.com/mrhaoqi/claude-task-master
- **问题反馈**: [GitHub Issues](https://github.com/mrhaoqi/claude-task-master/issues)

---

*最后更新时间: 2025-07-09*
