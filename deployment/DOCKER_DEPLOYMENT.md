# TaskMaster Docker 部署指南

## 📋 概述

本指南介绍如何使用Docker和Docker Compose部署TaskMaster服务。

## 🚀 快速开始

### 1. 环境准备

确保已安装以下软件：
- Docker (>= 20.10)
- Docker Compose (>= 2.0)

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.docker .env

# 编辑环境变量
vim .env
```

必须配置的环境变量：
- `OPENROUTER_API_KEY`: OpenRouter API密钥
- `DASHSCOPE_API_KEY`: DashScope API密钥

### 3. 一键部署

```bash
# 生产环境部署
npm run docker:deploy

# 开发环境部署
npm run docker:deploy:dev

# 生产环境 + Nginx
npm run docker:deploy:nginx
```

## 📦 部署模式

### 生产模式

```bash
# 使用部署脚本
./scripts/docker/deploy.sh

# 或使用npm脚本
npm run docker:deploy
```

**特点：**
- 优化的生产镜像
- 最小化的依赖
- 性能监控
- 健康检查

### 开发模式

```bash
# 使用部署脚本
./scripts/docker/deploy.sh development

# 或使用npm脚本
npm run docker:deploy:dev
```

**特点：**
- 包含开发工具
- 代码热重载
- 调试端口开放
- 详细日志

### Nginx反向代理模式

```bash
# 生产环境 + Nginx
./scripts/docker/deploy.sh production true

# 或使用npm脚本
npm run docker:deploy:nginx
```

**特点：**
- Nginx反向代理
- SSL终止
- 负载均衡
- 静态文件服务

## 🔧 服务配置

### 端口映射

| 服务 | 内部端口 | 外部端口 | 说明 |
|------|----------|----------|------|
| Express API | 3000 | 3000 | REST API服务 |
| MCP HTTP | 3001 | 3001 | MCP协议服务 |
| Nginx | 80/443 | 80/443 | 反向代理 |
| Debug | 9229 | 9229 | Node.js调试 |

### 数据卷

| 卷名称 | 容器路径 | 主机路径 | 说明 |
|--------|----------|----------|------|
| projects | /app/projects | ./projects | 项目数据 |
| data | /app/data | ./data | 应用数据 |
| logs | /app/logs | ./logs | 日志文件 |
| config | /app/config | ./config | 配置文件 |

## 🛠️ 管理命令

### 基本操作

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down
```

### 使用npm脚本

```bash
# 构建镜像
npm run docker:build

# 启动服务
npm run docker:up

# 停止服务
npm run docker:down

# 查看日志
npm run docker:logs

# 完全清理
npm run docker:clean
```

### 使用部署脚本

```bash
# 停止服务
./scripts/docker/stop.sh

# 停止并清理数据卷
./scripts/docker/stop.sh production true

# 停止并清理所有
./scripts/docker/stop.sh production true true
```

## 🔍 监控和调试

### 健康检查

```bash
# 检查API服务器
curl http://localhost:3000/health

# 检查MCP服务器
curl http://localhost:3001/health
```

### 日志查看

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f taskmaster

# 查看最近100行日志
docker-compose logs --tail=100 taskmaster
```

### 进入容器

```bash
# 进入主容器
docker-compose exec taskmaster bash

# 以root用户进入
docker-compose exec --user root taskmaster bash
```

## 🔒 安全配置

### 环境变量安全

- 不要在代码中硬编码敏感信息
- 使用`.env`文件管理环境变量
- 生产环境使用Docker secrets

### 网络安全

- 使用内部网络隔离服务
- 配置防火墙规则
- 启用SSL/TLS

### 数据安全

- 定期备份数据卷
- 设置适当的文件权限
- 加密敏感数据

## 🚨 故障排除

### 常见问题

1. **端口冲突**
   ```bash
   # 检查端口占用
   lsof -i :3000
   lsof -i :3001
   ```

2. **权限问题**
   ```bash
   # 修复权限
   sudo chown -R $USER:$USER projects data logs
   ```

3. **内存不足**
   ```bash
   # 增加Docker内存限制
   # 在Docker Desktop中调整资源分配
   ```

4. **镜像构建失败**
   ```bash
   # 清理Docker缓存
   docker system prune -a
   
   # 重新构建
   docker-compose build --no-cache
   ```

### 日志分析

```bash
# 查看错误日志
docker-compose logs taskmaster | grep ERROR

# 查看启动日志
docker-compose logs taskmaster | head -50

# 实时监控日志
docker-compose logs -f taskmaster | grep -E "(ERROR|WARN)"
```

## 📈 性能优化

### 资源限制

在`docker-compose.yml`中添加资源限制：

```yaml
services:
  taskmaster:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

### 缓存优化

- 使用多阶段构建
- 优化Docker层缓存
- 使用.dockerignore减少构建上下文

## 🔄 更新和维护

### 更新应用

```bash
# 拉取最新代码
git pull

# 重新构建和部署
npm run docker:deploy
```

### 备份数据

```bash
# 备份数据卷
docker run --rm -v taskmaster_projects:/data -v $(pwd):/backup alpine tar czf /backup/projects-backup.tar.gz -C /data .

# 恢复数据
docker run --rm -v taskmaster_projects:/data -v $(pwd):/backup alpine tar xzf /backup/projects-backup.tar.gz -C /data
```

## 📞 支持

如果遇到问题，请：

1. 查看日志文件
2. 检查GitHub Issues
3. 提交新的Issue
4. 联系维护团队
