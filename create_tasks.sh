#!/bin/bash

# 产品官网项目任务创建脚本
PROJECT="product-website-project"
MCP_URL="http://localhost:3001/mcp"

# 任务列表
declare -a tasks=(
    "用户注册登录系统|开发用户注册、登录、密码重置等用户认证功能|medium|实现JWT认证、邮箱验证、密码加密等安全机制"
    "产品介绍页面开发|开发产品详细介绍页面，包括功能特性、技术架构、使用场景等|medium|使用React组件化开发，支持多媒体内容展示"
    "客户案例展示模块|开发客户成功案例展示页面和管理功能|medium|包括案例详情、客户证言、ROI数据展示等"
    "技术文档系统|构建在线技术文档系统，包括API文档、集成指南等|medium|使用Markdown渲染，支持搜索和导航功能"
    "联系我们页面|开发联系表单和销售咨询功能|low|包括表单验证、邮件通知、CRM集成等"
    "管理后台开发|开发管理员后台，用于内容管理和用户管理|high|包括用户管理、试用申请审核、数据统计等功能"
    "数据库设计和实现|设计并实现项目所需的数据库结构|high|包括用户表、试用申请表、内容管理表等"
    "API接口开发|开发后端RESTful API接口|high|包括用户管理、内容管理、试用申请等接口"
    "前端路由和状态管理|实现前端路由配置和全局状态管理|medium|使用Next.js路由和Context API或Redux"
    "响应式设计适配|确保网站在各种设备上的良好显示效果|medium|适配桌面、平板、手机等不同屏幕尺寸"
    "SEO优化实现|实现搜索引擎优化，提升网站搜索排名|medium|包括meta标签、结构化数据、sitemap等"
    "性能优化|优化网站加载速度和运行性能|medium|包括代码分割、图片优化、缓存策略等"
    "安全防护实现|实现网站安全防护措施|high|包括HTTPS、防XSS、防SQL注入、CSRF防护等"
    "部署和运维配置|配置生产环境部署和监控|medium|包括Docker容器化、CI/CD流程、监控告警等"
    "测试用例编写|编写单元测试和集成测试|medium|使用Jest、React Testing Library等测试框架"
    "用户体验优化|优化用户交互体验和界面设计|low|包括动画效果、加载状态、错误处理等"
)

# 函数：创建单个任务
create_task() {
    local task_info="$1"
    IFS='|' read -r title description priority details <<< "$task_info"
    
    echo "创建任务: $title"
    
    curl -s -X POST "$MCP_URL" \
        -H "Content-Type: application/json" \
        -H "X-PROJECT: $PROJECT" \
        -H "X-USERNAME: liuqinwang" \
        -H "X-PASSWORD: password" \
        -d "{
            \"jsonrpc\": \"2.0\",
            \"id\": $(date +%s),
            \"method\": \"tools/call\",
            \"params\": {
                \"name\": \"add_task\",
                \"arguments\": {
                    \"title\": \"$title\",
                    \"description\": \"$description\",
                    \"priority\": \"$priority\",
                    \"details\": \"$details\"
                }
            }
        }" | jq -r '.result.content[0].text' | head -1
    
    sleep 2  # 避免请求过快
}

# 创建所有任务
echo "开始创建产品官网项目任务..."
for task in "${tasks[@]}"; do
    create_task "$task"
done

echo "所有任务创建完成！"
