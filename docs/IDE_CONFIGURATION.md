# Claude Task Master - IDE 配置指南

## 概述

Claude Task Master 支持通过 MCP (Model Context Protocol) 与多种 IDE 和 AI 助手集成。本指南提供了详细的配置步骤。

## 支持的 IDE 和工具

- **Claude Desktop**: Anthropic 官方桌面应用
- **Cursor**: AI 代码编辑器
- **VS Code**: 通过 MCP 扩展
- **Cline**: VS Code 扩展
- **Windsurf**: Codeium 的 AI IDE
- **其他**: 支持 MCP 协议的工具

## 通用配置

### 1. 启动 Claude Task Master 服务

```bash
cd claude-task-master
npm start
```

服务将在 `http://localhost:3000` 启动。

### 2. 验证服务状态

```bash
curl http://localhost:3000/health
```

## Claude Desktop 配置

### 1. 安装 Claude Desktop

从 [Anthropic 官网](https://claude.ai/download) 下载并安装 Claude Desktop。

### 2. 配置 MCP 服务器

编辑 Claude Desktop 配置文件：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "claude-task-master": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:3000/mcp"
      ],
      "headers": {
        "X-PROJECT": "my-project",
        "X-USERNAME": "your-username",
        "X-PASSWORD": "your-password"
      }
    }
  }
}
```

### 3. 重启 Claude Desktop

重启应用以加载新配置。

## Cursor 配置

### 1. 安装 Cursor

从 [Cursor 官网](https://cursor.sh/) 下载并安装。

### 2. 配置 MCP 连接

在 Cursor 设置中添加 MCP 服务器：

```json
{
  "mcp": {
    "servers": {
      "claude-task-master": {
        "command": "npx",
        "args": [
          "mcp-remote", 
          "http://localhost:3000/mcp"
        ],
        "headers": {
          "X-PROJECT": "my-project"
        }
      }
    }
  }
}
```

## VS Code + Cline 配置

### 1. 安装 Cline 扩展

在 VS Code 扩展市场搜索并安装 "Cline"。

### 2. 配置 MCP 服务器

在 VS Code 设置中添加：

```json
{
  "cline.mcpServers": {
    "claude-task-master": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:3000/mcp"
      ],
      "headers": {
        "X-PROJECT": "my-project"
      }
    }
  }
}
```

## Windsurf 配置

### 1. 安装 Windsurf

从 [Codeium 官网](https://codeium.com/windsurf) 下载并安装。

### 2. 配置 MCP 连接

在 Windsurf 设置中配置：

```json
{
  "mcp": {
    "servers": {
      "claude-task-master": {
        "transport": "http",
        "url": "http://localhost:3000/mcp",
        "headers": {
          "X-PROJECT": "my-project"
        }
      }
    }
  }
}
```

## 项目特定配置

### 1. 多项目支持

为不同项目创建不同的配置：

```json
{
  "mcpServers": {
    "project-a": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3000/mcp"],
      "headers": {
        "X-PROJECT": "project-a"
      }
    },
    "project-b": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3000/mcp"],
      "headers": {
        "X-PROJECT": "project-b"
      }
    }
  }
}
```

### 2. 环境变量配置

支持的请求头：

- `X-PROJECT`: 项目ID（必需）
- `X-USERNAME`: 用户名（可选，开发模式下可省略）
- `X-PASSWORD`: 密码（生产模式必需，开发模式可省略）

**注意**: 在开发模式下（NODE_ENV=development），用户名和密码是可选的，系统会在控制台打印接收到的请求头信息以便调试。

### 3. 工作区配置

在项目根目录创建 `.vscode/settings.json`：

```json
{
  "cline.mcpServers": {
    "claude-task-master": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:3000/mcp"
      ],
      "headers": {
        "X-PROJECT": "${workspaceFolderBasename}"
      }
    }
  }
}
```

## 高级配置

### 1. 自定义服务器地址

如果服务器运行在不同地址：

```json
{
  "env": {
    "MCP_SERVER_URL": "http://your-server:3000/mcp"
  }
}
```

### 2. 超时配置

```json
{
  "timeout": 30000,
  "retries": 3
}
```

### 3. 调试模式

启用调试日志：

```json
{
  "env": {
    "DEBUG": "mcp:*"
  }
}
```

## 使用示例

### 1. 初始化项目

在 IDE 中使用 AI 助手：

```
请使用 initialize_project 工具创建一个新的 Web 应用项目
```

### 2. 解析 PRD

```
请使用 parse_prd 工具解析以下 PRD 文档并生成任务：
[粘贴 PRD 内容]
```

### 3. 管理任务

```
请使用 get_tasks 工具显示所有待处理的任务
```

```
请使用 add_task 工具添加一个新任务：实现用户登录功能
```

### 4. 生成文档

```
请使用 sync_readme 工具将当前任务同步到 README.md 文件
```

## 故障排除

### 1. 连接问题

检查服务器状态：

```bash
curl http://localhost:3000/health
```

检查 MCP 端点：

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-PROJECT: test-project" \
  -d '{"method": "tools/list"}'
```

### 2. 权限问题

确保项目目录有正确的权限：

```bash
chmod -R 755 projects/
```

### 3. 配置验证

验证 JSON 配置文件格式：

```bash
cat claude_desktop_config.json | jq .
```

### 4. 日志查看

查看服务器日志：

```bash
tail -f logs/app.log
```

### 5. 常见错误

**错误**: "Project not found"
**解决**: 检查 `X-PROJECT` 头部是否正确设置

**错误**: "Connection refused"
**解决**: 确保服务器正在运行并且端口正确

**错误**: "Tool not found"
**解决**: 检查工具名称是否正确，使用 `help` 工具查看可用工具

## 最佳实践

### 1. 项目命名

- 使用小写字母和连字符
- 避免特殊字符和空格
- 保持名称简短且描述性

### 2. 配置管理

- 为每个项目创建独立的配置
- 使用环境变量管理敏感信息
- 定期备份配置文件

### 3. 性能优化

- 限制并发连接数
- 使用适当的超时设置
- 定期清理日志文件

### 4. 安全考虑

- 不要在配置中硬编码密码
- 使用 HTTPS（生产环境）
- 限制网络访问权限
