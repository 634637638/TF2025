#!/bin/bash

# ============================================
# 自动备份脚本 - 安全清理项目文件
# ============================================
# 功能：
# 1. 自动创建时间戳备份目录
# 2. 移动（而非删除）可疑文件到备份目录
# 3. 生成备份清单
# 4. 提供恢复脚本
# ============================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
PROJECT_ROOT="/Users/imac/Desktop/webtset/TF2025"
BACKUP_BASE_DIR="$PROJECT_ROOT/.deleted-files-backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_BASE_DIR/$TIMESTAMP"

# 日志文件
LOG_FILE="$BACKUP_DIR/backup-log.txt"

# 打印函数
print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# 记录到日志
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# 检查是否在正确的目录
check_environment() {
    print_header "🔍 环境检查"
    
    if [ ! -d "$PROJECT_ROOT/backend" ] || [ ! -d "$PROJECT_ROOT/frontend" ]; then
        print_error "错误：未找到项目目录！"
        exit 1
    fi
    
    print_success "项目目录验证通过"
    log "环境检查通过"
}

# 创建备份目录
create_backup_dir() {
    print_header "📦 创建备份目录"
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$BACKUP_DIR/logs"
    mkdir -p "$BACKUP_DIR/scripts"
    mkdir -p "$BACKUP_DIR/database"
    mkdir -p "$BACKUP_DIR/temp"
    
    print_success "备份目录已创建：$BACKUP_DIR"
    log "创建备份目录：$BACKUP_DIR"
}

# 备份文件的通用函数
backup_files() {
    local source_pattern="$1"
    local category="$2"
    local description="$3"
    
    echo ""
    print_warning "处理 $description..."
    
    # 使用 eval 来处理通配符
    local files=()
    while IFS= read -r -d '' file; do
        files+=("$file")
    done < <(find "$PROJECT_ROOT" -path "$source_pattern" -print0 2>/dev/null || true)
    
    if [ ${#files[@]} -eq 0 ]; then
        print_warning "  未找到匹配的文件"
        log "类别 [$category]: 未找到文件"
        return
    fi
    
    # 创建对应的备份子目录
    local target_dir="$BACKUP_DIR/$category"
    mkdir -p "$target_dir"
    
    local count=0
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            # 获取相对路径
            local rel_path="${file#$PROJECT_ROOT/}"
            local target_path="$target_dir/$(basename "$file")"
            
            # 如果目标文件已存在，添加序号
            if [ -f "$target_path" ]; then
                local base_name=$(basename "$file")
                local dir_name=$(dirname "$file")
                local name="${base_name%.*}"
                local ext="${base_name##*.}"
                target_path="$target_dir/${name}_$count.$ext"
            fi
            
            # 移动文件
            mv "$file" "$target_path"
            print_success "  已移动：$rel_path"
            log "移动文件：$rel_path -> $target_path"
            ((count++))
        fi
    done
    
    print_success "$description 完成，共移动 $count 个文件"
    log "类别 [$category] 完成，移动了 $count 个文件"
}

# 备份调试文件
backup_debug_files() {
    print_header "🗑️  备份调试文件"
    
    # 调试 HTML 文件
    backup_files "backend/logs/debug-html-*.html" "logs/debug-html" "调试 HTML 文件"
    
    # Puppeteer cookies
    backup_files "backend/logs/puppeteer-cookies/*" "logs/puppeteer-cookies" "Puppeteer Cookies"
    
    # 验证码缓存
    backup_files "backend/logs/captcha-cache/*" "logs/captcha-cache" "验证码缓存"
}

# 备份测试脚本
backup_test_scripts() {
    print_header "🧪 备份测试脚本"
    
    # test-match.js
    if [ -f "$PROJECT_ROOT/backend/test-match.js" ]; then
        mv "$PROJECT_ROOT/backend/test-match.js" "$BACKUP_DIR/scripts/"
        print_success "  已移动：backend/test-match.js"
        log "移动文件：backend/test-match.js"
    fi
    
    # check-*.js 系列
    backup_files "backend/check-*.js" "scripts/check-scripts" "检查脚本 (check-*.js)"
    
    # add-*.js 系列（排除正在使用的）
    for file in "$PROJECT_ROOT"/backend/add-*.js; do
        if [ -f "$file" ]; then
            local basename=$(basename "$file")
            # 跳过可能的配置文件
            if [[ "$basename" != "ecosystem.config.js" ]]; then
                mv "$file" "$BACKUP_DIR/scripts/" 2>/dev/null && \
                print_success "  已移动：backend/$basename" || true
            fi
        fi
    done
}

# 备份归档脚本
backup_archive_scripts() {
    print_header "📚 备份归档脚本"
    
    if [ -d "$PROJECT_ROOT/backend/scripts/archive" ]; then
        mv "$PROJECT_ROOT/backend/scripts/archive" "$BACKUP_DIR/scripts/"
        print_success "  已移动：backend/scripts/archive/"
        log "移动目录：backend/scripts/archive/"
    fi
}

# 备份 PID 文件
backup_pid_files() {
    print_header "🆔 备份 PID 文件"
    
    for pid_file in "$PROJECT_ROOT"/*.pid; do
        if [ -f "$pid_file" ]; then
            mv "$pid_file" "$BACKUP_DIR/temp/" 2>/dev/null && \
            print_success "  已移动：$(basename "$pid_file")" || true
        fi
    done
}

# 备份本地备份（可选）
backup_local_backups() {
    print_header "💾 备份本地备份文件"
    
    echo ""
    print_warning "发现以下本地备份文件："
    
    local count=0
    for backup_file in "$PROJECT_ROOT"/本地备份/*.tar.gz; do
        if [ -f "$backup_file" ]; then
            echo "  - $(basename "$backup_file")"
            ((count++))
        fi
    done
    
    if [ $count -gt 0 ]; then
        echo ""
        read -p "是否也要备份这些文件？(y/n): " choice
        if [[ "$choice" =~ ^[Yy]$ ]]; then
            mkdir -p "$BACKUP_DIR/local-backups"
            for backup_file in "$PROJECT_ROOT"/本地备份/*.tar.gz; do
                if [ -f "$backup_file" ]; then
                    mv "$backup_file" "$BACKUP_DIR/local-backups/"
                    print_success "  已移动：$(basename "$backup_file")"
                fi
            done
        else
            print_warning "  跳过本地备份文件"
        fi
    else
        print_warning "  未发现本地备份文件"
    fi
}

# 生成备份清单
generate_manifest() {
    print_header "📋 生成备份清单"
    
    local manifest_file="$BACKUP_DIR/MANIFEST.md"
    
    cat > "$manifest_file" << EOF
# 文件备份清单

**备份时间:** $(date '+%Y-%m-%d %H:%M:%S')
**备份目录:** $BACKUP_DIR
**项目路径:** $PROJECT_ROOT

## 备份内容统计

### 按类别统计
EOF

    # 统计各类别的文件数
    echo "" >> "$manifest_file"
    for dir in "$BACKUP_DIR"/*/; do
        if [ -d "$dir" ]; then
            local dir_name=$(basename "$dir")
            local file_count=$(find "$dir" -type f | wc -l)
            echo "- **$dir_name:** $file_count 个文件" >> "$manifest_file"
        fi
    done

    # 添加详细说明
    cat >> "$manifest_file" << EOF

## 文件列表

EOF

    # 列出所有备份文件
    find "$BACKUP_DIR" -type f -not -name "MANIFEST.md" -not -name "*.sh" | sort | while read file; do
        local rel_path="${file#$BACKUP_DIR/}"
        local file_size=$(du -h "$file" | cut -f1)
        echo "- \`$rel_path\` ($file_size)" >> "$manifest_file"
    done

    # 添加恢复说明
    cat >> "$manifest_file" << EOF

## 如何恢复文件

如果需要恢复某个文件，可以手动从备份目录复制回去，或者使用提供的恢复脚本。

### 自动恢复（未来会生成）
\`\`\`bash
bash $BACKUP_DIR/restore.sh [文件名或类别]
\`\`\`

### 手动恢复
\`\`\`bash
# 例如恢复 test-match.js
cp $BACKUP_DIR/scripts/test-match.js /Users/imac/Desktop/webtset/TF2025/backend/

# 例如恢复所有调试文件
cp -r $BACKUP_DIR/logs/debug-html/* /Users/imac/Desktop/webtset/TF2025/backend/logs/
\`\`\`

## 观察期建议

建议在删除这些文件后观察 **2-4 周**，确认系统运行正常后再永久删除备份。

### 检查清单
- [ ] 后端服务正常运行
- [ ] 前端服务正常运行
- [ ] 数据库连接正常
- [ ] 权限验证正常
- [ ] 数据查询正常
- [ ] 文件上传下载正常
- [ ] 定时任务正常

## 何时可以永久删除备份

✅ 满足以下条件时可以删除备份：
1. 系统稳定运行 2-4 周
2. 没有任何错误或警告
3. 用户反馈一切正常
4. 确认不再需要这些历史文件

❌ 以下情况请保留备份：
1. 系统出现未知错误
2. 某些功能无法使用
3. 需要回滚到之前的状态
4. 需要参考历史代码

EOF

    print_success "备份清单已生成：$manifest_file"
    log "生成备份清单：$manifest_file"
}

# 生成恢复脚本
generate_restore_script() {
    print_header "🔄 生成恢复脚本"
    
    local restore_script="$BACKUP_DIR/restore.sh"
    
    cat > "$restore_script" << 'RESTORE_EOF'
#!/bin/bash

# ============================================
# 文件恢复脚本
# ============================================
# 用法：
#   ./restore.sh all              # 恢复所有文件
#   ./restore.sh logs             # 恢复日志类文件
#   ./restore.sh scripts          # 恢复脚本文件
#   ./restore.sh test-match.js    # 恢复指定文件
# ============================================

set -e

PROJECT_ROOT="/Users/imac/Desktop/webtset/TF2025"
BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=============================================="
echo "文件恢复脚本"
echo "=============================================="
echo ""

case "$1" in
    all)
        echo "正在恢复所有文件..."
        # 恢复日志文件
        [ -d "$BACKUP_DIR/logs/debug-html" ] && cp -r "$BACKUP_DIR/logs/debug-html"/* "$PROJECT_ROOT/backend/logs/" 2>/dev/null || true
        [ -d "$BACKUP_DIR/logs/puppeteer-cookies" ] && cp -r "$BACKUP_DIR/logs/puppeteer-cookies"/* "$PROJECT_ROOT/backend/logs/puppeteer-cookies/" 2>/dev/null || true
        [ -d "$BACKUP_DIR/logs/captcha-cache" ] && cp -r "$BACKUP_DIR/logs/captcha-cache"/* "$PROJECT_ROOT/backend/logs/captcha-cache/" 2>/dev/null || true
        
        # 恢复脚本文件
        [ -d "$BACKUP_DIR/scripts" ] && cp -r "$BACKUP_DIR/scripts"/* "$PROJECT_ROOT/backend/scripts/" 2>/dev/null || true
        [ -f "$BACKUP_DIR/scripts/test-match.js" ] && cp "$BACKUP_DIR/scripts/test-match.js" "$PROJECT_ROOT/backend/" 2>/dev/null || true
        
        # 恢复其他文件
        [ -d "$BACKUP_DIR/database" ] && cp -r "$BACKUP_DIR/database"/* "$PROJECT_ROOT/backend/database/" 2>/dev/null || true
        
        echo "✓ 所有文件已恢复"
        ;;
    
    logs)
        echo "正在恢复日志文件..."
        [ -d "$BACKUP_DIR/logs/debug-html" ] && cp -r "$BACKUP_DIR/logs/debug-html"/* "$PROJECT_ROOT/backend/logs/" 2>/dev/null || true
        [ -d "$BACKUP_DIR/logs/puppeteer-cookies" ] && mkdir -p "$PROJECT_ROOT/backend/logs/puppeteer-cookies" && cp -r "$BACKUP_DIR/logs/puppeteer-cookies"/* "$PROJECT_ROOT/backend/logs/puppeteer-cookies/" 2>/dev/null || true
        [ -d "$BACKUP_DIR/logs/captcha-cache" ] && mkdir -p "$PROJECT_ROOT/backend/logs/captcha-cache" && cp -r "$BACKUP_DIR/logs/captcha-cache"/* "$PROJECT_ROOT/backend/logs/captcha-cache/" 2>/dev/null || true
        echo "✓ 日志文件已恢复"
        ;;
    
    scripts)
        echo "正在恢复脚本文件..."
        [ -d "$BACKUP_DIR/scripts" ] && cp -r "$BACKUP_DIR/scripts"/* "$PROJECT_ROOT/backend/scripts/" 2>/dev/null || true
        [ -f "$BACKUP_DIR/scripts/test-match.js" ] && cp "$BACKUP_DIR/scripts/test-match.js" "$PROJECT_ROOT/backend/" 2>/dev/null || true
        echo "✓ 脚本文件已恢复"
        ;;
    
    *)
        if [ -n "$1" ]; then
            # 尝试恢复指定文件
            found=false
            for dir in "$BACKUP_DIR"/*/; do
                if [ -d "$dir" ]; then
                    for file in "$dir"*; do
                        if [ -f "$file" ] && [[ "$(basename "$file")" == *"$1"* ]]; then
                            echo "找到文件：$file"
                            cp "$file" "$PROJECT_ROOT/backend/"
                            echo "✓ 已恢复：$1"
                            found=true
                            break 2
                        fi
                    done
                fi
            done
            
            if [ "$found" = false ]; then
                echo "✗ 未找到包含 '$1' 的文件"
                exit 1
            fi
        else
            echo "用法：$0 {all|logs|scripts|文件名}"
            echo ""
            echo "示例:"
            echo "  $0 all              # 恢复所有文件"
            echo "  $0 logs             # 恢复日志文件"
            echo "  $0 scripts          # 恢复脚本文件"
            echo "  $0 test-match.js    # 恢复指定文件"
            exit 1
        fi
        ;;
esac

echo ""
echo "恢复完成！"
RESTORE_EOF

    chmod +x "$restore_script"
    print_success "恢复脚本已生成：$restore_script"
    log "生成恢复脚本：$restore_script"
}

# 显示总结
show_summary() {
    print_header "📊 备份总结"
    
    local total_files=$(find "$BACKUP_DIR" -type f | wc -l)
    local total_size=$(du -sh "$BACKUP_DIR" | cut -f1)
    
    echo ""
    print_success "备份完成！"
    echo ""
    echo "备份位置：$BACKUP_DIR"
    echo "文件总数：$total_files"
    echo "总大小：$total_size"
    echo ""
    echo "生成的文件:"
    echo "  📋 MANIFEST.md - 备份清单"
    echo "  🔄 restore.sh - 恢复脚本"
    echo "  📝 backup-log.txt - 操作日志"
    echo ""
    print_warning "下一步建议:"
    echo "  1. 查看 MANIFEST.md 了解备份详情"
    echo "  2. 测试系统是否正常运行"
    echo "  3. 观察 2-4 周无问题后，可永久删除备份"
    echo "  4. 如需恢复，运行：bash $BACKUP_DIR/restore.sh"
    echo ""
}

# 主函数
main() {
    print_header "🤖 自动备份系统启动"
    
    check_environment
    create_backup_dir
    
    echo ""
    print_warning "开始备份文件..."
    
    backup_debug_files
    backup_test_scripts
    backup_archive_scripts
    backup_pid_files
    backup_local_backups
    
    generate_manifest
    generate_restore_script
    
    show_summary
    
    print_success "所有操作已完成！"
}

# 执行主函数
main
