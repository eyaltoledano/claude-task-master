#!/bin/bash

# Claude Task Master - 服务启动脚本
# 用于在服务器上启动所有必要的服务

set -e

# 颜色定义
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

# 检查环境
check_environment() {
    log_info "检查运行环境..."
    
    # 检查Node.js版本
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    log_info "Node.js 版本: $NODE_VERSION"
    
    # 检查npm版本
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    
    NPM_VERSION=$(npm --version)
    log_info "npm 版本: $NPM_VERSION"
    
    # 检查.env文件
    if [ ! -f ".env" ]; then
        log_warning ".env 文件不存在，将使用默认配置"
        if [ -f ".env.example" ]; then
            log_info "复制 .env.example 到 .env"
            cp .env.example .env
        fi
    fi
    
    log_success "环境检查完成"
}

# 安装依赖
install_dependencies() {
    log_info "检查并安装依赖..."
    
    if [ ! -d "node_modules" ]; then
        log_info "安装npm依赖..."
        npm install
    else
        log_info "依赖已存在，跳过安装"
    fi
    
    log_success "依赖检查完成"
}

# 创建必要目录
create_directories() {
    log_info "创建必要目录..."
    
    mkdir -p projects
    mkdir -p logs
    mkdir -p temp
    
    log_success "目录创建完成"
}

# 健康检查
health_check() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    log_info "等待 $service_name 启动 (端口 $port)..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
            log_success "$service_name 启动成功"
            return 0
        fi
        
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    log_error "$service_name 启动失败或超时"
    return 1
}

# 启动单个服务
start_service() {
    local service_name=$1
    local command=$2
    local port=$3
    
    log_info "启动 $service_name..."
    
    # 检查端口是否被占用
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "端口 $port 已被占用，尝试终止现有进程..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
    
    # 启动服务
    nohup $command > logs/${service_name}.log 2>&1 &
    local pid=$!
    echo $pid > logs/${service_name}.pid
    
    log_info "$service_name PID: $pid"
    
    # 健康检查
    if health_check "$service_name" "$port"; then
        log_success "$service_name 启动成功"
        return 0
    else
        log_error "$service_name 启动失败"
        return 1
    fi
}

# 停止服务
stop_services() {
    log_info "停止所有服务..."
    
    for service in express-server mcp-server mcp-remote; do
        if [ -f "logs/${service}.pid" ]; then
            local pid=$(cat logs/${service}.pid)
            if kill -0 $pid 2>/dev/null; then
                log_info "停止 $service (PID: $pid)"
                kill $pid
                rm -f logs/${service}.pid
            fi
        fi
    done
    
    log_success "所有服务已停止"
}

# 显示状态
show_status() {
    log_info "服务状态:"
    
    for service in express-server mcp-server mcp-remote; do
        if [ -f "logs/${service}.pid" ]; then
            local pid=$(cat logs/${service}.pid)
            if kill -0 $pid 2>/dev/null; then
                log_success "$service: 运行中 (PID: $pid)"
            else
                log_error "$service: 已停止"
                rm -f logs/${service}.pid
            fi
        else
            log_error "$service: 未运行"
        fi
    done
}

# 主函数
main() {
    local action=${1:-start}
    
    case $action in
        start)
            log_info "启动 Claude Task Master 服务..."
            check_environment
            install_dependencies
            create_directories
            
            # 启动Express服务器
            start_service "express-server" "npm run server:prod" "3000"
            
            log_success "所有服务启动完成!"
            log_info "Express API: http://localhost:3000"
            log_info "Remote MCP: http://localhost:3000/mcp"
            ;;
            
        dev)
            log_info "启动开发模式..."
            check_environment
            install_dependencies
            create_directories
            
            # 使用concurrently启动所有服务
            npm run dev:all
            ;;
            
        stop)
            stop_services
            ;;
            
        status)
            show_status
            ;;
            
        restart)
            stop_services
            sleep 2
            main start
            ;;
            
        *)
            echo "用法: $0 {start|dev|stop|status|restart}"
            echo ""
            echo "命令说明:"
            echo "  start   - 启动生产环境服务"
            echo "  dev     - 启动开发环境服务"
            echo "  stop    - 停止所有服务"
            echo "  status  - 显示服务状态"
            echo "  restart - 重启所有服务"
            exit 1
            ;;
    esac
}

# 信号处理
trap 'stop_services; exit 0' SIGINT SIGTERM

# 执行主函数
main "$@"
