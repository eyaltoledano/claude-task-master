#!/bin/bash

# TaskMaster Docker部署脚本
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

# 检查Docker和Docker Compose
check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 检查环境变量文件
check_env_file() {
    log_info "检查环境变量文件..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.docker" ]; then
            log_warning ".env文件不存在，复制.env.docker为.env"
            cp .env.docker .env
        else
            log_error ".env和.env.docker文件都不存在，请创建环境变量文件"
            exit 1
        fi
    fi
    
    log_success "环境变量文件检查通过"
}

# 创建必要的目录
create_directories() {
    log_info "创建必要的目录..."
    
    mkdir -p projects data logs nginx/ssl
    
    log_success "目录创建完成"
}

# 构建镜像
build_image() {
    log_info "构建Docker镜像..."
    
    docker-compose build --no-cache
    
    log_success "镜像构建完成"
}

# 启动服务
start_services() {
    local profile=${1:-""}
    
    log_info "启动服务..."
    
    if [ "$profile" = "with-nginx" ]; then
        docker-compose --profile with-nginx up -d
    else
        docker-compose up -d
    fi
    
    log_success "服务启动完成"
}

# 检查服务状态
check_services() {
    log_info "检查服务状态..."
    
    # 等待服务启动
    sleep 10
    
    # 检查API服务器
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        log_success "Express API服务器运行正常"
    else
        log_error "Express API服务器启动失败"
        return 1
    fi
    
    # 检查MCP服务器
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        log_success "MCP HTTP服务器运行正常"
    else
        log_error "MCP HTTP服务器启动失败"
        return 1
    fi
    
    log_success "所有服务运行正常"
}

# 显示服务信息
show_info() {
    log_info "服务信息:"
    echo "  Express API服务器: http://localhost:3000"
    echo "  MCP HTTP服务器: http://localhost:3001"
    echo "  健康检查: http://localhost:3000/health"
    echo ""
    echo "查看日志: docker-compose logs -f"
    echo "停止服务: docker-compose down"
    echo "重启服务: docker-compose restart"
}

# 主函数
main() {
    local mode=${1:-"production"}
    local with_nginx=${2:-"false"}
    
    log_info "开始部署TaskMaster (模式: $mode)"
    
    check_dependencies
    check_env_file
    create_directories
    
    if [ "$mode" = "development" ]; then
        log_info "使用开发模式部署"
        docker-compose -f docker-compose.dev.yml build --no-cache
        docker-compose -f docker-compose.dev.yml up -d
    else
        build_image
        if [ "$with_nginx" = "true" ]; then
            start_services "with-nginx"
        else
            start_services
        fi
    fi
    
    check_services
    show_info
    
    log_success "部署完成！"
}

# 脚本入口
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "用法: $0 [mode] [with_nginx]"
    echo "  mode: production (默认) | development"
    echo "  with_nginx: true | false (默认)"
    echo ""
    echo "示例:"
    echo "  $0                    # 生产模式部署"
    echo "  $0 development        # 开发模式部署"
    echo "  $0 production true    # 生产模式 + Nginx"
    exit 0
fi

main "$@"
