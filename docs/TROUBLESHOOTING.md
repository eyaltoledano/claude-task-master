# Claude Task Master - 故障排除指南

## 常见问题和解决方案

### 1. 服务启动问题

#### 问题：端口被占用
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方案**：
```bash
# 查找占用端口的进程
sudo lsof -i :3000
# 或者
netstat -tulpn | grep :3000

# 终止进程
sudo kill -9 <PID>

# 或者使用不同端口
PORT=3001 npm start
```

#### 问题：权限不足
```
Error: EACCES: permission denied
```

**解决方案**：
```bash
# 修改文件权限
sudo chown -R $USER:$USER .
chmod -R 755 .

# 或者使用 sudo 运行（不推荐）
sudo npm start
```

#### 问题：依赖安装失败
```
npm ERR! peer dep missing
```

**解决方案**：
```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# 或者强制安装
npm install --force
```

### 2. MCP 连接问题

#### 问题：MCP 服务器无法连接
```
Connection refused to http://localhost:3000/mcp
```

**解决方案**：
1. 检查服务器状态：
   ```bash
   curl http://localhost:3000/health
   ```

2. 验证 MCP 端点：
   ```bash
   curl -X POST http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -H "X-PROJECT: test" \
     -d '{"method": "tools/list"}'
   ```

3. 检查防火墙设置：
   ```bash
   sudo ufw status
   sudo ufw allow 3000
   ```

#### 问题：项目不存在错误
```
{"error": {"code": "PROJECT_NOT_FOUND", "message": "Project 'xxx' not found"}}
```

**解决方案**：
1. 检查项目是否存在：
   ```bash
   ls projects/
   ```

2. 创建项目：
   ```bash
   curl -X POST http://localhost:3000/api/projects \
     -H "Content-Type: application/json" \
     -d '{"id": "my-project", "name": "My Project"}'
   ```

3. 验证项目ID格式（小写字母、数字、连字符）

#### 问题：工具不可用
```
Tool 'xxx' not found
```

**解决方案**：
1. 列出可用工具：
   ```bash
   curl -X POST http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -H "X-PROJECT: test" \
     -d '{"method": "tools/list"}'
   ```

2. 检查工具名称拼写
3. 重启服务器

### 3. 文件系统问题

#### 问题：文件权限错误
```
EACCES: permission denied, open 'projects/xxx/tasks.json'
```

**解决方案**：
```bash
# 修复项目目录权限
sudo chown -R $USER:$USER projects/
chmod -R 755 projects/

# 检查磁盘空间
df -h
```

#### 问题：文件锁定
```
File is locked by another process
```

**解决方案**：
```bash
# 查找锁定文件的进程
lsof projects/*/tasks.json

# 重启服务器清除锁定
sudo systemctl restart claude-task-master
```

#### 问题：JSON 格式错误
```
Unexpected token in JSON
```

**解决方案**：
```bash
# 验证 JSON 格式
cat projects/my-project/tasks.json | jq .

# 备份并修复
cp projects/my-project/tasks.json projects/my-project/tasks.json.bak
echo '{"tasks": [], "metadata": {}}' > projects/my-project/tasks.json
```

### 4. 性能问题

#### 问题：响应缓慢
**症状**：API 请求超时或响应时间过长

**解决方案**：
1. 检查系统资源：
   ```bash
   top
   free -h
   df -h
   ```

2. 优化 Node.js 内存：
   ```bash
   node --max-old-space-size=2048 server/index.js
   ```

3. 启用缓存：
   ```javascript
   // 在配置中启用缓存
   {
     "cache": {
       "enabled": true,
       "ttl": 300
     }
   }
   ```

#### 问题：内存泄漏
**症状**：内存使用持续增长

**解决方案**：
1. 监控内存使用：
   ```bash
   ps aux | grep node
   ```

2. 重启服务：
   ```bash
   pm2 restart claude-task-master
   ```

3. 分析内存使用：
   ```bash
   node --inspect server/index.js
   ```

### 5. AI 集成问题

#### 问题：API 密钥无效
```
Invalid API key
```

**解决方案**：
1. 检查环境变量：
   ```bash
   echo $OPENAI_API_KEY
   echo $ANTHROPIC_API_KEY
   ```

2. 更新 `.env` 文件：
   ```env
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. 重启服务器

#### 问题：API 配额超限
```
Rate limit exceeded
```

**解决方案**：
1. 检查 API 使用情况
2. 实施请求限制：
   ```javascript
   // 添加速率限制
   const rateLimit = require('express-rate-limit');
   app.use(rateLimit({
     windowMs: 15 * 60 * 1000, // 15分钟
     max: 100 // 限制每个IP 100个请求
   }));
   ```

3. 使用不同的 API 提供商

### 6. 网络问题

#### 问题：代理配置
**症状**：无法访问外部 API

**解决方案**：
```bash
# 设置代理
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080

# 或在代码中配置
const agent = new HttpsProxyAgent('http://proxy.company.com:8080');
```

#### 问题：DNS 解析失败
```
getaddrinfo ENOTFOUND api.openai.com
```

**解决方案**：
```bash
# 检查 DNS 设置
nslookup api.openai.com

# 使用不同的 DNS
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
```

### 7. 日志和调试

#### 启用详细日志
```bash
# 设置日志级别
export LOG_LEVEL=debug
npm start

# 或者使用 DEBUG 环境变量
DEBUG=* npm start
```

#### 查看日志文件
```bash
# 实时查看日志
tail -f logs/app.log

# 搜索错误
grep -i error logs/app.log

# 查看最近的错误
tail -100 logs/error.log
```

#### 调试 MCP 通信
```bash
# 启用 MCP 调试
DEBUG=mcp:* npm start

# 使用 curl 测试 MCP 端点
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-PROJECT: test" \
  -d '{"method": "tools/list"}' \
  -v
```

### 8. 数据恢复

#### 恢复损坏的项目数据
```bash
# 从备份恢复
cp backup/projects_20240101.tar.gz .
tar -xzf projects_20240101.tar.gz

# 重建索引
curl -X POST http://localhost:3000/api/admin/rebuild-index
```

#### 重置项目
```bash
# 备份当前数据
cp -r projects/my-project projects/my-project.backup

# 重新初始化
rm -rf projects/my-project
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"id": "my-project", "name": "My Project"}'
```

### 9. 配置验证

#### 验证配置文件
```bash
# 检查 JSON 语法
cat config/global-config.json | jq .

# 验证环境变量
node -e "console.log(process.env)"

# 测试配置加载
node -e "console.log(require('./config/global-config.json'))"
```

### 10. 获取帮助

#### 收集诊断信息
```bash
#!/bin/bash
# diagnostic.sh
echo "=== System Info ==="
uname -a
node --version
npm --version

echo "=== Service Status ==="
curl -s http://localhost:3000/health

echo "=== Disk Space ==="
df -h

echo "=== Memory Usage ==="
free -h

echo "=== Process Info ==="
ps aux | grep node

echo "=== Recent Logs ==="
tail -50 logs/app.log
```

#### 联系支持
当遇到无法解决的问题时：

1. 运行诊断脚本收集信息
2. 查看 GitHub Issues
3. 创建新的 Issue 并包含：
   - 错误信息
   - 系统信息
   - 重现步骤
   - 相关日志

#### 社区资源
- GitHub Repository: https://github.com/mrhaoqi/claude-task-master
- Documentation: docs/
- Examples: examples/
