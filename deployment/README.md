# TaskMaster 部署指南

## 🚀 Docker 快速部署

### 1. 环境准备

确保已安装：
- Docker (>= 20.10)
- Docker Compose (>= 2.0)

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.docker .env

# 编辑环境变量（必须配置API密钥）
vim .env
```

### 3. 一键部署

```bash
# 生产环境部署
npm run docker:deploy

# 开发环境部署
npm run docker:deploy:dev

# 生产环境 + Nginx
npm run docker:deploy:nginx
```

### 4. 服务访问

- **Express API服务器**: http://localhost:3000
- **MCP HTTP服务器**: http://localhost:3001
- **健康检查**: http://localhost:3000/health

### 5. 管理命令

```bash
# 查看服务状态
npm run docker:logs

# 停止服务
npm run docker:stop

# 完全清理
npm run docker:clean
```

## 📁 部署文件说明

```
deployment/
├── README.md                 # 本文件
├── DOCKER_DEPLOYMENT.md      # 详细部署文档
├── scripts/
│   ├── deploy.sh             # Docker部署脚本
│   ├── stop.sh               # 停止和清理脚本
│   └── start-services.sh     # 传统部署脚本
└── nginx/
    └── nginx.conf            # Nginx反向代理配置
```

## 🔧 自定义配置

### 修改端口

编辑 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "8000:3000"  # 将API服务器映射到8000端口
  - "8001:3001"  # 将MCP服务器映射到8001端口
```

### 添加SSL

1. 将SSL证书放入 `nginx/ssl/` 目录
2. 修改 `nginx/nginx.conf` 配置
3. 使用Nginx模式部署

## 📖 详细文档

请查看 [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) 获取完整的部署和管理指南。
