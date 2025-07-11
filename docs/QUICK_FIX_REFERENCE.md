# TaskMaster 快速修复参考

## 常见问题快速诊断

### 1. AI 配置读取失败

**症状**：
- 任务生成失败
- 日志显示配置文件读取错误
- AI 提供商无法正确初始化

**快速检查**：
```bash
# 检查项目根目录环境变量
echo $TASK_MASTER_PROJECT_ROOT

# 检查配置文件是否存在
ls -la .taskmaster/config.json

# 检查 AI 配置
node -e "
import { getConfig } from './scripts/modules/config-manager.js';
const config = getConfig();
console.log('Main provider:', config.models?.main?.provider);
console.log('Main model:', config.models?.main?.modelId);
"
```

**解决方案**：
1. 确保在 `express-api/start.js` 中设置了环境变量
2. 重启 Express API 服务器
3. 检查配置文件路径是否正确

### 2. JSON 解析错误

**症状**：
- 错误信息：`Could not parse the response as JSON`
- AI 响应包含 markdown 代码块

**快速检查**：
```bash
# 检查 AI 提供商类型
grep -r "openai-compatible" .taskmaster/config.json
```

**解决方案**：
1. 确保 `openai-compatible.js` 包含 JSON 提取逻辑
2. 检查 `json-extractor.js` 是否正确导入
3. 重启服务器应用更新

### 3. Web 界面无响应

**症状**：
- 点击"生成任务"后页面无反应
- 长时间等待后超时

**快速检查**：
```bash
# 检查服务器状态
curl -H "X-API-Key: test-api-key-123" http://localhost:3000/health

# 检查超时设置
grep -r "timeout.*120000" web-frontend/public/js/app.js
```

**解决方案**：
1. 确保超时时间设置为 300000 (5分钟)
2. 检查进度提示功能是否正常
3. 清理浏览器缓存

## 修复验证清单

### ✅ 配置验证
- [ ] 环境变量 `TASK_MASTER_PROJECT_ROOT` 设置正确
- [ ] AI 配置文件能正确读取
- [ ] 日志显示正确的项目根目录

### ✅ 功能验证
- [ ] 项目创建正常
- [ ] PRD 文档上传成功
- [ ] 任务生成完整（生成指定数量的任务）
- [ ] Web 界面进度提示正常

### ✅ 用户体验验证
- [ ] 点击生成任务后立即显示进度
- [ ] 进度条正常更新
- [ ] 预估时间显示正确
- [ ] 取消功能正常工作
- [ ] 错误处理和恢复正常

## 紧急修复命令

### 重启所有服务
```bash
# 停止现有进程
pkill -f "node.*start.js"
pkill -f "npm.*start"

# 重启 Express API
cd express-api && node start.js &

# 重启 Web 前端
cd web-frontend && npm start &
```

### 清理和重置
```bash
# 清理项目缓存
curl -X POST -H "X-API-Key: test-api-key-123" \
  http://localhost:3000/api/admin/cache/clear/projects

# 重置测试项目
rm -rf projects/test-*

# 检查服务状态
curl -H "X-API-Key: test-api-key-123" http://localhost:3000/api/projects
```

### 配置检查
```bash
# 检查环境变量
cd express-api && node -e "
console.log('TASK_MASTER_PROJECT_ROOT:', process.env.TASK_MASTER_PROJECT_ROOT);
console.log('Current working directory:', process.cwd());
console.log('Resolved project root:', require('path').resolve(__dirname, '..'));
"

# 检查配置文件
node -e "
import { getConfig } from './scripts/modules/config-manager.js';
console.log('Config loaded successfully:', !!getConfig());
"
```

## 提交记录参考

- `049039bc`: 修复项目根目录配置问题
- `88e38a5f`: 修复 OpenAI 兼容提供商的 JSON 解析问题  
- `0ae936ae`: 改进 Web 界面的任务生成用户体验
- `c1befd7d`: 优化后端服务和路由处理
- `c8dddb09`: 添加系统修复详细报告
- `7c2be649`: 更新 CHANGELOG 记录重要修复和改进

## 相关文档

- [详细修复报告](fix-reports/2025-01-11-ai-config-and-ux-fixes.md)
- [更新日志](../CHANGELOG.md)
- [项目配置文档](../README.md)

## 联系支持

如果问题仍然存在，请：

1. 收集错误日志和配置信息
2. 记录重现步骤
3. 检查是否有未提交的代码变更
4. 参考详细修复报告进行深入排查
