#!/bin/bash

# ============================================
# TF2025 前端打包部署脚本（标准版）
# 每次打包自动清理日志文件
# ============================================

set -e  # 遇到错误立即退出

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 获取版本信息
VERSION=$(date +%Y%m%d-%H%M%S)

# 部署目录（直接使用 dist）
DEPLOY_DIR="frontend/dist"

echo -e "${GREEN}╔══════════════════════════════════════${NC}"
echo -e "${GREEN}║  TF2025 前端打包工具                 ${NC}"
echo -e "${GREEN}╚══════════════════════════════════════${NC}"
echo -e "${BLUE}版本：${VERSION}${NC}"
echo ""

# 步骤 1: 检查环境
echo -e "${YELLOW}[步骤 1/5] 检查 Node.js 环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 未检测到 Node.js，请先安装 Node.js${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ Node.js: ${NODE_VERSION}${NC}"
echo -e "${GREEN}✓ npm: ${NPM_VERSION}${NC}"

# 步骤 2: 进入前端目录
echo -e "\n${YELLOW}[步骤 2/5] 进入前端目录...${NC}"
cd frontend
FRONTEND_DIR=$(pwd)
echo -e "${GREEN}✓ 目录：${FRONTEND_DIR}${NC}"

# 步骤 3: 安装依赖
echo -e "\n${YELLOW}[步骤 3/5] 安装/检查依赖...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}→ 首次安装依赖（可能需要几分钟）...${NC}"
    npm install
else
    echo -e "${GREEN}✓ 依赖已存在，跳过安装${NC}"
fi

# 步骤 4: 构建项目
echo -e "\n${YELLOW}[步骤 4/5] 构建前端项目...${NC}"
echo -e "${BLUE}→ 执行 Vite 构建和清理...${NC}"
npm run build

# 步骤 5: 显示部署信息
echo -e "\n${YELLOW}[步骤 5/5] 显示部署信息...${NC}"
cd ..

# 统计文件数量
FILE_COUNT=$(find "$DEPLOY_DIR" -type f | wc -l)
TOTAL_SIZE=$(du -sh "$DEPLOY_DIR" | cut -f1)
echo -e "${GREEN}✓ 共 ${FILE_COUNT} 个文件，总大小：${TOTAL_SIZE}${NC}"

# 显示成功信息
echo -e "\n${GREEN}╔══════════════════════════════════════${NC}"
echo -e "${GREEN}║  ✅ 打包成功！                        ${NC}"
echo -e "${GREEN}╚══════════════════════════════════════${NC}"
echo -e "\n${BLUE}📦 部署目录位置:${NC}"
echo -e "   ${YELLOW}$(pwd)/${DEPLOY_DIR}/${NC}"
echo -e "   文件数：${FILE_COUNT}"
echo -e "   总大小：${TOTAL_SIZE}"
echo -e "\n${GREEN}✨ 下次打包直接运行：./build.sh${NC}"
echo -e "${GREEN}📂 直接上传 dist 目录内容到服务器即可${NC}"
