# Claude Task Master - 远程 MCP 服务

## 概述

Claude Task Master 现在支持作为远程 HTTP MCP 服务运行，允许多个 IDE 和用户同时连接并管理不同的项目。这个新架构提供了更好的可扩展性和多用户支持。

## 🚀 新特性

### 多项目支持
- 每个项目独立的任务文件和配置
- 项目级别的隔离和安全性
- 支持无限数量的项目

### 远程 MCP 服务器
- HTTP 协议支持，无需本地安装
- 支持多个并发连接
- 实时任务同步和状态更新

### 完整的 MCP 工具集
- **37个 MCP 工具**，覆盖完整的任务管理生命周期
- 与原始 TaskMaster 功能完全兼容
- 新增工具：`sync_readme`、`help`、`migrate`

### IDE 集成
- Claude Desktop
- Cursor
- VS Code (通过 Cline)
- Windsurf
- 任何支持 MCP 协议的工具

## 🏗️ 架构设计

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Claude Desktop │    │     Cursor      │    │    VS Code      │
│                 │    │                 │    │   + Cline       │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │              HTTP MCP Protocol              │
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   Remote MCP Server       │
                    │   (Port 3000)             │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Express.js API Server   │
                    │   - Project Management    │
                    │   - Task Management       │
                    │   - File Management       │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Project Storage         │
                    │   projects/               │
                    │   ├── project-a/          │
                    │   │   ├── tasks.json      │
                    │   │   └── config.json     │
                    │   └── project-b/          │
                    │       ├── tasks.json      │
                    │       └── config.json     │
                    └───────────────────────────┘
```

## 📦 安装和部署

### 快速开始

1. **克隆项目**
   ```bash
   git clone https://github.com/mrhaoqi/claude-task-master.git
   cd claude-task-master
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，添加 AI API 密钥
   ```

4. **启动服务**
   ```bash
   npm start
   ```

5. **验证服务**
   ```bash
   curl http://localhost:3000/health
   ```

### Docker 部署

```bash
# 构建镜像
docker build -t claude-task-master .

# 运行容器
docker run -d \
  --name claude-task-master \
  -p 3000:3000 \
  -v $(pwd)/projects:/app/projects \
  --env-file .env \
  claude-task-master
```

## 🔧 IDE 配置

### Claude Desktop

编辑配置文件 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "claude-task-master": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:3000/mcp"
      ],
      "env": {
        "X-PROJECT": "my-project"
      }
    }
  }
}
```

### Cursor

在 Cursor 设置中添加：

```json
{
  "mcp": {
    "servers": {
      "claude-task-master": {
        "command": "npx",
        "args": ["mcp-remote", "http://localhost:3000/mcp"],
        "env": {
          "X-PROJECT": "my-project"
        }
      }
    }
  }
}
```

### VS Code + Cline

在 VS Code 设置中配置：

```json
{
  "cline.mcpServers": {
    "claude-task-master": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3000/mcp"],
      "env": {
        "X-PROJECT": "${workspaceFolderBasename}"
      }
    }
  }
}
```

## 🛠️ MCP 工具参考

### 项目管理
- `initialize_project` - 初始化新项目
- `migrate` - 迁移项目结构
- `models` - 配置 AI 模型
- `rules` - 管理项目规则

### 任务管理
- `get_tasks` - 获取任务列表
- `get_task` - 获取任务详情
- `add_task` - 添加新任务
- `update_task` - 更新任务
- `remove_task` - 删除任务
- `set_task_status` - 设置任务状态
- `next_task` - 获取下一个任务
- `move_task` - 移动任务位置

### 子任务管理
- `add_subtask` - 添加子任务
- `update_subtask` - 更新子任务
- `remove_subtask` - 删除子任务
- `clear_subtasks` - 清除所有子任务

### 任务分析
- `analyze` - 分析项目复杂度
- `expand_task` - 扩展任务为子任务
- `expand_all` - 扩展所有任务
- `complexity_report` - 生成复杂度报告

### 依赖管理
- `add_dependency` - 添加任务依赖
- `remove_dependency` - 删除任务依赖
- `validate_dependencies` - 验证依赖关系
- `fix_dependencies` - 修复依赖问题

### 标签管理
- `list_tags` - 列出所有标签
- `add_tag` - 添加新标签
- `delete_tag` - 删除标签
- `use_tag` - 切换标签
- `rename_tag` - 重命名标签
- `copy_tag` - 复制标签

### 文档和帮助
- `sync_readme` - 同步任务到 README
- `help` - 显示帮助信息
- `get_operation_status` - 获取操作状态

### 其他功能
- `parse_prd` - 解析 PRD 文档
- `generate` - 生成任务文件
- `research` - AI 研究功能
- `update` - 更新任务文件

## 🔄 使用示例

### 1. 初始化新项目

```
请使用 initialize_project 工具创建一个名为 "web-app" 的新项目
```

### 2. 解析 PRD 文档

```
请使用 parse_prd 工具解析以下 PRD 并生成任务：

# 用户认证系统 PRD

## 功能需求
1. 用户注册
2. 用户登录
3. 密码重置
4. 用户资料管理

## 技术要求
- 使用 JWT 认证
- 密码加密存储
- 邮件验证
```

### 3. 管理任务

```
请使用 get_tasks 工具显示所有待处理的任务
```

```
请使用 add_task 工具添加一个新任务：
- 标题：实现用户登录 API
- 描述：创建 POST /api/auth/login 端点
- 优先级：高
```

### 4. 生成文档

```
请使用 sync_readme 工具将当前任务列表同步到 README.md 文件
```

## 📊 性能和扩展性

### 并发支持
- 支持多个 IDE 同时连接
- 每个项目独立的文件锁定
- 智能缓存机制

### 资源使用
- 内存使用：~100MB（基础）+ ~10MB/项目
- CPU 使用：低（事件驱动架构）
- 存储：每个项目 ~1-10MB

### 扩展性
- 水平扩展：支持负载均衡
- 垂直扩展：支持大型项目
- 插件系统：可扩展新功能

## 🔒 安全考虑

### 项目隔离
- 每个项目独立的数据目录
- 项目级别的访问控制
- 文件系统权限保护

### API 安全
- 请求验证和清理
- 错误信息脱敏
- 速率限制

### 数据保护
- 定期自动备份
- 数据完整性检查
- 恢复机制

## 📈 监控和维护

### 健康检查
```bash
curl http://localhost:3000/health
```

### 日志监控
```bash
tail -f logs/app.log
```

### 性能监控
```bash
curl http://localhost:3000/api/admin/stats
```

## 🆕 版本更新

### 从原始 TaskMaster 迁移

1. **备份数据**
   ```bash
   cp -r .taskmaster backup/
   ```

2. **使用迁移工具**
   ```
   请使用 migrate 工具迁移现有项目到新结构
   ```

3. **验证迁移**
   ```bash
   curl http://localhost:3000/api/projects
   ```

## 📚 更多文档

- [API 文档](API.md)
- [部署指南](DEPLOYMENT.md)
- [IDE 配置](IDE_CONFIGURATION.md)
- [故障排除](TROUBLESHOOTING.md)
