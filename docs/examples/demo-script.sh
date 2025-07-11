#!/bin/bash

# Claude Task Master - 演示脚本
# 这个脚本演示了如何使用 Claude Task Master 的远程 MCP 服务

set -e

echo "🎯 Claude Task Master - 远程 MCP 服务演示"
echo "============================================"

# 检查服务是否运行
echo "📡 检查服务状态..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ 服务正在运行"
else
    echo "❌ 服务未运行，请先启动服务："
    echo "   npm start"
    exit 1
fi

# 创建演示项目
echo ""
echo "📁 创建演示项目..."
PROJECT_ID="demo-web-app"
curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$PROJECT_ID\",
    \"name\": \"Demo Web App\",
    \"description\": \"A demonstration web application project\"
  }" | jq .

echo "✅ 项目创建成功"

# 添加示例任务
echo ""
echo "📝 添加示例任务..."

# 任务1：用户认证
curl -s -X POST http://localhost:3000/api/projects/$PROJECT_ID/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "实现用户认证系统",
    "description": "创建用户注册、登录、登出功能",
    "status": "pending",
    "priority": "high",
    "tags": ["backend", "security"]
  }' | jq .

# 任务2：前端界面
curl -s -X POST http://localhost:3000/api/projects/$PROJECT_ID/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "设计用户界面",
    "description": "创建响应式的用户界面设计",
    "status": "pending",
    "priority": "medium",
    "tags": ["frontend", "ui"]
  }' | jq .

# 任务3：数据库设计
curl -s -X POST http://localhost:3000/api/projects/$PROJECT_ID/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "设计数据库架构",
    "description": "设计用户数据和应用数据的数据库结构",
    "status": "pending",
    "priority": "high",
    "tags": ["database", "backend"]
  }' | jq .

echo "✅ 示例任务添加成功"

# 显示项目信息
echo ""
echo "📊 项目信息："
curl -s http://localhost:3000/api/projects/$PROJECT_ID | jq .

# 显示任务列表
echo ""
echo "📋 任务列表："
curl -s http://localhost:3000/api/projects/$PROJECT_ID/tasks | jq .

# 测试 MCP 工具
echo ""
echo "🔧 测试 MCP 工具..."

# 测试工具列表
echo "📝 可用的 MCP 工具："
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-PROJECT: $PROJECT_ID" \
  -d '{"method": "tools/list"}' | jq '.result.tools[] | .name' | head -10

# 测试获取任务
echo ""
echo "📋 通过 MCP 获取任务："
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-PROJECT: $PROJECT_ID" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "get_tasks",
      "arguments": {}
    }
  }' | jq .

# 演示完成
echo ""
echo "🎉 演示完成！"
echo ""
echo "📚 接下来你可以："
echo "1. 在 IDE 中配置 MCP 连接到 http://localhost:3000/mcp"
echo "2. 使用 X-PROJECT: $PROJECT_ID 头部指定项目"
echo "3. 通过 AI 助手使用各种 MCP 工具管理任务"
echo ""
echo "🔧 可用的主要 MCP 工具："
echo "- get_tasks: 获取任务列表"
echo "- add_task: 添加新任务"
echo "- update_task: 更新任务"
echo "- set_task_status: 设置任务状态"
echo "- parse_prd: 解析 PRD 文档"
echo "- sync_readme: 同步到 README"
echo "- help: 获取帮助信息"
echo ""
echo "📖 查看完整文档："
echo "- API 文档: docs/API.md"
echo "- IDE 配置: docs/IDE_CONFIGURATION.md"
echo "- 故障排除: docs/TROUBLESHOOTING.md"
