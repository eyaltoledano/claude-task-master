# TaskMaster 统一配置指南

## 📋 概述

TaskMaster 现在使用统一的配置文件系统，所有配置都集中在一个 `.env` 文件中，包括：
- AI API 密钥
- 服务器配置  
- 环境设置
- 安全配置

## 🔄 配置架构变更

### 新架构优势
- **统一管理**: 所有配置在一个文件中
- **简化部署**: 不需要管理多个环境文件
- **减少混淆**: 避免配置分散在不同文件
- **易于维护**: 集中式配置管理

### 配置文件结构
```
claude-task-master/
├── .env                    # 统一配置文件 (不提交到git)
├── .env.example           # 配置模板 (提交到git)
├── express-api/
│   ├── config.json             # Express API适配器配置
│   └── ...
├── projects/
│   └── .registry/
│       └── projects.json       # 项目注册表
└── projects/
    └── {project-id}/
        └── .taskmaster/
            ├── tasks/
            ├── docs/
            └── state.json  # 项目状态 (不再有config.json)
```

## 🚀 快速开始

### 1. 复制配置模板
```bash
cp .env.example .env
```

### 2. 编辑配置文件
```bash
nano .env
```

### 3. 配置示例
```env
# ================================
# AI API Keys
# ================================
OPENROUTER_API_KEY="sk-or-v1-your-key-here"
ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"

# ================================
# 服务器配置
# ================================
PORT=3000
HOST=0.0.0.0
PROJECTS_DIR=./projects

# ================================
# 环境配置
# ================================
NODE_ENV=development
LOG_LEVEL=debug
```

## 🔧 配置分层

### 1. 环境变量 (.env)
- AI API 密钥
- 服务器配置
- 环境设置

### 2. Express API配置 (express-api/config.json)
- Express API适配器配置
- 默认设置
- 系统参数

### 3. 项目注册表 (config/projects.json)
- 项目列表
- 项目元信息
- 模板配置

## 🛠️ 使用方式

### CLI 模式
```bash
npm run task-master
```

### 远程服务器模式
```bash
# 开发模式
npm run remote-server:dev

# 生产模式  
npm run remote-server
```

### MCP 模式
```bash
npm run mcp-server
```

## 🔄 从旧版本迁移

如果您从使用分离配置文件的版本升级：

### 自动迁移
```bash
# 运行迁移脚本
node scripts/migrate-config.js
```

### 手动迁移
1. 合并 `.env.remote` 到 `.env`
2. 删除项目中的 `config.json` 文件
3. 更新 package.json 脚本

## 📚 完整配置示例

### 开发环境
```env
# AI服务
OPENROUTER_API_KEY="sk-or-v1-your-key-here"
ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"

# 服务器
PORT=3000
HOST=0.0.0.0
PROJECTS_DIR=./projects

# 环境
NODE_ENV=development
LOG_LEVEL=debug
```

### 生产环境
```env
# AI服务
ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"
OPENROUTER_API_KEY="sk-or-v1-your-key-here"
PERPLEXITY_API_KEY="pplx-your-key-here"

# 服务器
PORT=3000
HOST=0.0.0.0
PROJECTS_DIR=./projects

# 环境
NODE_ENV=production
LOG_LEVEL=info

# 安全
JWT_SECRET="your-secure-secret-key"
ALLOWED_ORIGINS="https://yourdomain.com"
```

## 🔒 安全注意事项

1. **永远不要提交 `.env` 文件到版本控制**
2. **设置正确的文件权限**:
   ```bash
   chmod 600 .env
   ```
3. **定期轮换API密钥**
4. **使用环境特定的配置**

## 🆘 故障排除

### 常见问题

1. **配置文件未找到**
   ```bash
   # 确保 .env 文件存在
   ls -la .env
   ```

2. **API密钥无效**
   ```bash
   # 检查密钥格式
   grep "API_KEY" .env
   ```

3. **服务器启动失败**
   ```bash
   # 检查端口占用
   lsof -i :3000
   ```

### 调试模式
```env
LOG_LEVEL=debug
NODE_ENV=development
```

## 📖 相关文档

- [API 文档](./API.md)
- [部署指南](./DEPLOYMENT.md)
- [MCP 集成](./MCP.md)
- [故障排除](./TROUBLESHOOTING.md)
