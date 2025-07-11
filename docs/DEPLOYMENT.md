# Claude Task Master - 部署指南

## 系统要求

### 最低要求
- **Node.js**: 18.0.0 或更高版本
- **npm**: 8.0.0 或更高版本
- **内存**: 512MB RAM
- **存储**: 1GB 可用空间
- **操作系统**: Linux, macOS, Windows

### 推荐配置
- **Node.js**: 20.0.0 或更高版本
- **内存**: 2GB RAM
- **存储**: 5GB 可用空间
- **CPU**: 2核心或更多

## 安装步骤

### 1. 克隆项目

```bash
git clone https://github.com/mrhaoqi/claude-task-master.git
cd claude-task-master
```

### 2. 安装依赖

```bash
npm install
```

### 3. 环境配置

创建 `.env` 文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 服务器配置
PORT=3000
NODE_ENV=production

# AI 提供商配置
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/app.log

# 项目存储路径
PROJECTS_ROOT=./projects
```

### 4. 创建必要目录

```bash
mkdir -p projects logs
```

### 5. 运行测试

```bash
npm test
```

### 6. 启动服务

#### 快速启动 (推荐)
```bash
# 生产模式
npm start

# 开发模式
npm run dev

# 启动所有服务
npm run start:all

# 开发模式启动所有服务
npm run dev:all
```

#### 使用部署脚本
```bash
# 使用npm脚本 (推荐)
npm run deploy:start    # 启动所有服务
npm run deploy:dev      # 开发模式
npm run deploy:stop     # 停止服务
npm run deploy:status   # 查看状态

# 或直接使用脚本
./deployment/scripts/start-services.sh start
./deployment/scripts/start-services.sh dev
./deployment/scripts/start-services.sh stop
./deployment/scripts/start-services.sh status
./deployment/scripts/start-services.sh restart
```

#### 单独启动服务
```bash
# Express API 服务器
npm run server:prod        # 生产模式
npm run server:dev         # 开发模式

# MCP 服务器
npm run mcp-server

# 远程 MCP 服务器
npm run mcp-remote

# HTTP 模式的 MCP 服务器
npm run mcp-http
```

## Docker 部署

### 1. 构建镜像

```bash
docker build -t claude-task-master .
```

### 2. 运行容器

```bash
docker run -d \
  --name claude-task-master \
  -p 3000:3000 \
  -v $(pwd)/projects:/app/projects \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  claude-task-master
```

### 3. Docker Compose

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  claude-task-master:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./projects:/app/projects
      - ./logs:/app/logs
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

启动服务：

```bash
docker-compose up -d
```

## 生产环境配置

### 1. 反向代理 (Nginx)

创建 `/etc/nginx/sites-available/claude-task-master`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/claude-task-master /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. SSL 证书 (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3. 进程管理 (PM2)

安装 PM2：

```bash
npm install -g pm2
```

创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'claude-task-master',
    script: 'server/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    time: true
  }]
};
```

启动应用：

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4. 系统服务 (systemd)

创建 `/etc/systemd/system/claude-task-master.service`：

```ini
[Unit]
Description=Claude Task Master
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/claude-task-master
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl enable claude-task-master
sudo systemctl start claude-task-master
```

## 监控和日志

### 1. 健康检查

服务提供健康检查端点：

```bash
curl http://localhost:3000/health
```

### 2. 日志管理

日志文件位置：
- 应用日志: `logs/app.log`
- 错误日志: `logs/error.log`
- 访问日志: `logs/access.log`

日志轮转配置 (`/etc/logrotate.d/claude-task-master`)：

```
/opt/claude-task-master/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload claude-task-master
    endscript
}
```

### 3. 性能监控

使用 PM2 监控：

```bash
pm2 monit
```

## 备份和恢复

### 1. 数据备份

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/claude-task-master"

mkdir -p $BACKUP_DIR

# 备份项目数据
tar -czf $BACKUP_DIR/projects_$DATE.tar.gz projects/

# 备份配置文件
cp .env $BACKUP_DIR/env_$DATE
cp config/*.json $BACKUP_DIR/

# 清理旧备份（保留30天）
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

### 2. 自动备份

添加到 crontab：

```bash
# 每天凌晨2点备份
0 2 * * * /opt/claude-task-master/backup.sh
```

## 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   sudo lsof -i :3000
   sudo kill -9 <PID>
   ```

2. **权限问题**
   ```bash
   sudo chown -R www-data:www-data /opt/claude-task-master
   sudo chmod -R 755 /opt/claude-task-master
   ```

3. **内存不足**
   - 增加系统内存
   - 优化 Node.js 内存限制：
     ```bash
     node --max-old-space-size=2048 server/index.js
     ```

4. **依赖问题**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### 调试模式

启用调试日志：

```bash
DEBUG=* npm start
```

## 安全建议

1. **防火墙配置**
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

2. **定期更新**
   ```bash
   npm audit
   npm update
   ```

3. **环境变量保护**
   - 不要将 `.env` 文件提交到版本控制
   - 使用强密码和安全的 API 密钥
   - 定期轮换密钥

4. **访问控制**
   - 配置适当的网络访问控制
   - 使用 HTTPS
   - 实施速率限制
