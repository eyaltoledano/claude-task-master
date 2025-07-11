#!/bin/bash

# TaskMaster Docker停止脚本
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

# 停止服务
stop_services() {
    local mode=${1:-"production"}
    
    log_info "停止TaskMaster服务..."
    
    if [ "$mode" = "development" ]; then
        docker-compose -f docker-compose.dev.yml down
    else
        docker-compose --profile with-nginx down
        docker-compose down
    fi
    
    log_success "服务已停止"
}

# 清理资源
cleanup() {
    local clean_volumes=${1:-"false"}
    local clean_images=${2:-"false"}
    
    if [ "$clean_volumes" = "true" ]; then
        log_warning "清理数据卷..."
        docker volume prune -f
        log_success "数据卷清理完成"
    fi
    
    if [ "$clean_images" = "true" ]; then
        log_warning "清理镜像..."
        docker image prune -f
        log_success "镜像清理完成"
    fi
}

# 主函数
main() {
    local mode=${1:-"production"}
    local clean_volumes=${2:-"false"}
    local clean_images=${3:-"false"}
    
    stop_services "$mode"
    cleanup "$clean_volumes" "$clean_images"
    
    log_success "停止完成！"
}

# 脚本入口
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "用法: $0 [mode] [clean_volumes] [clean_images]"
    echo "  mode: production (默认) | development"
    echo "  clean_volumes: true | false (默认)"
    echo "  clean_images: true | false (默认)"
    echo ""
    echo "示例:"
    echo "  $0                        # 停止生产服务"
    echo "  $0 development            # 停止开发服务"
    echo "  $0 production true        # 停止服务并清理数据卷"
    echo "  $0 production true true   # 停止服务并清理数据卷和镜像"
    exit 0
fi

main "$@"
