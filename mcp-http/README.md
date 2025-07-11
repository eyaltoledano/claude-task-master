# TaskMaster MCP Remote Server

TaskMaster MCP远程服务器支持两种运行模式：

## 🔄 运行模式

### 1. **Stdio模式**（传统方式）
IDE通过子进程的stdin/stdout与MCP服务器通信。

### 2. **HTTP模式**（推荐）
MCP服务器作为HTTP服务运行，支持通过`mcp-remote`包连接。

## 🚀 HTTP模式使用方法

### 启动HTTP MCP服务器

```bash
# 方式1: 使用npm脚本
npm run mcp-http

# 方式2: 使用环境变量直接运行
MCP_HTTP_MODE=true node mcp-remote/server.js

# 方式3: 自定义端口和API地址
MCP_HTTP_MODE=true MCP_PORT=3001 TASKMASTER_API_URL=http://localhost:3000 node mcp-remote/server.js
```

## 🔧 IDE配置方法

### 方式1: HTTP模式（推荐）✨

**优势**: 无需本地安装，支持远程访问，简单易用

在Claude Desktop或其他支持MCP的IDE中配置：

```json
{
  "mcpServers": {
    "taskmaster-remote": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:3001/mcp",
        "--allow-http",
        "--header",
        "X-PROJECT:test-project",
        "--header",
        "X-USERNAME:admin",
        "--header",
        "X-PASSWORD:password123"
      ]
    }
  }
}
```

**远程服务器配置**（替换localhost为实际IP）：
```json
{
  "mcpServers": {
    "taskmaster-remote": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://192.168.10.93:3001/mcp",
        "--allow-http",
        "--header",
        "X-PROJECT:my-project",
        "--header",
        "X-USERNAME:your-username",
        "--header",
        "X-PASSWORD:your-password"
      ]
    }
  }
}
```

### 方式2: Stdio模式（传统）

**适用场景**: 本地开发，需要直接访问项目文件

```json
{
  "mcpServers": {
    "taskmaster-local": {
      "command": "node",
      "args": ["/path/to/claude-task-master/mcp-remote/server.js"],
      "env": {
        "TASKMASTER_PROJECT_ID": "my-project",
        "TASKMASTER_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

## ⚙️ 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `MCP_PORT` | `3001` | HTTP服务器端口 |
| `TASKMASTER_API_URL` | `http://localhost:3000` | TaskMaster API地址 |
| `MCP_HTTP_MODE` | `false` | 是否启用HTTP模式 |

## 🔧 HTTP头认证

| 头名称 | 必需 | 说明 |
|--------|------|------|
| `X-PROJECT` | ✅ | 项目ID |
| `X-USERNAME` | ✅ | 用户名 |
| `X-PASSWORD` | ✅ | 密码 |

## 📡 API端点

- `GET /health` - 健康检查
- `POST /mcp` - MCP协议端点

## 📋 完整使用流程

### 🚀 快速开始（HTTP模式）

1. **启动服务器**
   ```bash
   # 终端1: 启动TaskMaster API服务器
   npm run remote-server

   # 终端2: 启动MCP HTTP服务器
   npm run mcp-http
   ```

2. **配置IDE**
   ```json
   {
     "mcpServers": {
       "taskmaster": {
         "command": "npx",
         "args": [
           "-y", "mcp-remote",
           "http://localhost:3001/mcp",
           "--allow-http",
           "--header", "X-PROJECT:test-project",
           "--header", "X-USERNAME:admin",
           "--header", "X-PASSWORD:password123"
         ]
       }
     }
   }
   ```

3. **测试连接**
   ```bash
   # 健康检查
   curl http://localhost:3001/health

   # 测试MCP工具
   curl -X POST http://localhost:3001/mcp \
     -H "Content-Type: application/json" \
     -H "X-PROJECT: test-project" \
     -H "X-USERNAME: admin" \
     -H "X-PASSWORD: password123" \
     -d '{"method": "tools/list"}'
   ```

## 🎯 优势对比

### HTTP模式 vs Stdio模式

| 特性 | HTTP模式 ✨ | Stdio模式 |
|------|----------|-----------|
| 部署复杂度 | ✅ 简单 | ❌ 复杂 |
| 用户安装 | ✅ 无需本地安装 | ❌ 需要本地安装 |
| 认证支持 | ✅ HTTP头认证 | ❌ 环境变量 |
| 多项目支持 | ✅ 动态切换 | ❌ 启动时绑定 |
| 网络访问 | ✅ 远程访问 | ❌ 仅本地 |
| 推荐程度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

## 🔍 故障排除

### 1. 连接失败
```bash
# 检查服务器是否运行
curl http://localhost:3001/health

# 检查MCP端点
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "X-PROJECT: test-project" \
  -H "X-USERNAME: admin" \
  -H "X-PASSWORD: password" \
  -d '{"method": "tools/list"}'
```

### 2. 认证错误
确保HTTP头正确设置：
- `X-PROJECT`: 有效的项目ID
- `X-USERNAME`: 用户名
- `X-PASSWORD`: 密码

### 3. 端口冲突
```bash
# 使用不同端口
MCP_PORT=3002 npm run mcp-http
```
