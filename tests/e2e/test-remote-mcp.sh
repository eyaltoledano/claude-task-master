#!/bin/bash

# 远程HTTP MCP服务器端到端测试脚本
# 测试完整的远程MCP服务器功能

set -e

# 配置
MCP_SERVER_PORT=3001
HTTP_SERVER_PORT=3000
TEST_PROJECT_ID="e2e-test-$(date +%s)"
TEST_USERNAME="test-user"
TEST_PASSWORD="test-pass"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 清理函数
cleanup() {
    log_info "Cleaning up..."
    
    # 停止服务器
    if [ ! -z "$HTTP_SERVER_PID" ]; then
        kill $HTTP_SERVER_PID 2>/dev/null || true
        log_info "HTTP server stopped"
    fi
    
    if [ ! -z "$MCP_SERVER_PID" ]; then
        kill $MCP_SERVER_PID 2>/dev/null || true
        log_info "MCP server stopped"
    fi
    
    # 清理测试项目
    rm -rf "projects/$TEST_PROJECT_ID" 2>/dev/null || true
    rm -rf "projects/e2e-test-project-2" 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# 设置退出时清理
trap cleanup EXIT

# 等待服务器启动
wait_for_server() {
    local url=$1
    local timeout=${2:-30}
    local count=0
    
    log_info "Waiting for server at $url..."
    
    while [ $count -lt $timeout ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            log_success "Server is ready at $url"
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done
    
    log_error "Server at $url did not start within ${timeout}s"
    return 1
}

# MCP工具调用函数
call_mcp_tool() {
    local method=$1
    local params=${2:-"{}"}
    local project_id=${3:-$TEST_PROJECT_ID}
    
    curl -s -X POST "http://localhost:$MCP_SERVER_PORT/mcp" \
        -H "Content-Type: application/json" \
        -H "X-PROJECT: $project_id" \
        -H "X-USERNAME: $TEST_USERNAME" \
        -H "X-PASSWORD: $TEST_PASSWORD" \
        -d "{\"method\": \"$method\", \"params\": $params}"
}

# 测试函数
test_tools_list() {
    log_info "Testing tools list..."
    
    local response=$(call_mcp_tool "tools/list")
    local tool_count=$(echo "$response" | jq '.tools | length' 2>/dev/null || echo "0")
    
    if [ "$tool_count" -eq 36 ]; then
        log_success "✅ Tools list test passed (36 tools found)"
    else
        log_error "❌ Tools list test failed (expected 36, got $tool_count)"
        return 1
    fi
}

test_initialize_project() {
    log_info "Testing project initialization..."
    
    local params='{"force": true}'
    local response=$(call_mcp_tool "tools/call" "{\"name\": \"initialize-project\", \"arguments\": $params}")
    
    if echo "$response" | grep -q "initialized successfully"; then
        log_success "✅ Project initialization test passed"
    else
        log_error "❌ Project initialization test failed"
        echo "Response: $response"
        return 1
    fi
}

test_add_task() {
    log_info "Testing add task..."
    
    local params='{"title": "E2E Test Task", "description": "Test task from E2E script", "priority": "high"}'
    local response=$(call_mcp_tool "tools/call" "{\"name\": \"add-task\", \"arguments\": $params}")
    
    if echo "$response" | grep -q "Task added successfully"; then
        log_success "✅ Add task test passed"
    else
        log_error "❌ Add task test failed"
        echo "Response: $response"
        return 1
    fi
}

test_get_tasks() {
    log_info "Testing get tasks..."
    
    local response=$(call_mcp_tool "tools/call" "{\"name\": \"get-tasks\", \"arguments\": {}}")
    
    if echo "$response" | grep -q "Tasks in project"; then
        log_success "✅ Get tasks test passed"
    else
        log_error "❌ Get tasks test failed"
        echo "Response: $response"
        return 1
    fi
}

test_switch_project() {
    log_info "Testing project switching..."
    
    local new_project="e2e-test-project-2"
    local params="{\"projectId\": \"$new_project\"}"
    local response=$(call_mcp_tool "tools/call" "{\"name\": \"switch-project\", \"arguments\": $params}" "$new_project")
    
    if echo "$response" | grep -qi "switched to project"; then
        log_success "✅ Project switching test passed"
    else
        log_error "❌ Project switching test failed"
        echo "Response: $response"
        return 1
    fi
}

test_multi_project_isolation() {
    log_info "Testing multi-project isolation..."

    # 在项目1中添加任务
    local params1='{"title": "Project 1 Task", "description": "Task in project 1"}'
    call_mcp_tool "tools/call" "{\"name\": \"add-task\", \"arguments\": $params1}" "$TEST_PROJECT_ID" > /dev/null

    # 初始化项目2
    local init_params='{"force": true}'
    call_mcp_tool "tools/call" "{\"name\": \"initialize-project\", \"arguments\": $init_params}" "e2e-test-project-2" > /dev/null

    # 在项目2中添加任务
    local params2='{"title": "Project 2 Task", "description": "Task in project 2"}'
    call_mcp_tool "tools/call" "{\"name\": \"add-task\", \"arguments\": $params2}" "e2e-test-project-2" > /dev/null
    
    # 验证项目1的任务
    local project1_tasks=$(call_mcp_tool "tools/call" "{\"name\": \"get-tasks\", \"arguments\": {}}" "$TEST_PROJECT_ID")
    
    # 验证项目2的任务
    local project2_tasks=$(call_mcp_tool "tools/call" "{\"name\": \"get-tasks\", \"arguments\": {}}" "e2e-test-project-2")
    
    # 检查项目1是否有任务（检查是否包含任务）
    if echo "$project1_tasks" | grep -q '"id":'; then
        project1_has_tasks=1
    else
        project1_has_tasks=0
    fi

    # 检查项目2是否有任务（检查是否包含任务）
    if echo "$project2_tasks" | grep -q '"id":'; then
        project2_has_tasks=1
    else
        project2_has_tasks=0
    fi

    if [ "$project1_has_tasks" -eq 1 ] && [ "$project2_has_tasks" -eq 1 ]; then
        log_success "✅ Multi-project isolation test passed"
    else
        log_error "❌ Multi-project isolation test failed"
        echo "Project 1 tasks count: $project1_has_tasks"
        echo "Project 2 tasks count: $project2_has_tasks"
        echo "Project 1 tasks: $project1_tasks"
        echo "Project 2 tasks: $project2_tasks"
        return 1
    fi
}

# 主测试流程
main() {
    log_info "Starting Remote HTTP MCP Server E2E Tests"
    log_info "Test Project ID: $TEST_PROJECT_ID"
    
    # 启动HTTP服务器
    log_info "Starting HTTP server..."
    npm run server > /dev/null 2>&1 &
    HTTP_SERVER_PID=$!
    
    # 启动MCP服务器
    log_info "Starting MCP server..."
    cd mcp-remote
    node server.js --http > /dev/null 2>&1 &
    MCP_SERVER_PID=$!
    cd ..
    
    # 等待服务器启动
    wait_for_server "http://localhost:$HTTP_SERVER_PORT/health" 15
    wait_for_server "http://localhost:$MCP_SERVER_PORT/health" 10
    
    # 运行测试
    local failed_tests=0
    
    test_tools_list || failed_tests=$((failed_tests + 1))
    test_initialize_project || failed_tests=$((failed_tests + 1))
    test_add_task || failed_tests=$((failed_tests + 1))
    test_get_tasks || failed_tests=$((failed_tests + 1))
    test_switch_project || failed_tests=$((failed_tests + 1))
    test_multi_project_isolation || failed_tests=$((failed_tests + 1))
    
    # 测试结果
    if [ $failed_tests -eq 0 ]; then
        log_success "🎉 All E2E tests passed!"
        return 0
    else
        log_error "❌ $failed_tests test(s) failed"
        return 1
    fi
}

# 运行主函数
main "$@"
