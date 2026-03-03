#!/bin/bash
# RentLoop 安装检查脚本

echo "=========================================="
echo "RentLoop 安装检查"
echo "=========================================="
echo ""

# 检查 Node.js
echo "1. 检查 Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "   ✓ Node.js 已安装: $NODE_VERSION"
else
    echo "   ✗ Node.js 未安装"
    echo "   请访问 https://nodejs.org/ 下载安装"
    exit 1
fi

# 检查 npm
echo "2. 检查 npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "   ✓ npm 已安装: $NPM_VERSION"
else
    echo "   ✗ npm 未安装"
    echo "   Node.js 安装通常包含 npm，请检查 Node.js 安装"
    exit 1
fi

# 检查项目目录
echo "3. 检查项目目录..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/package.json" ]; then
    echo "   ✓ 项目目录正确: $SCRIPT_DIR"
    cd "$SCRIPT_DIR"
else
    echo "   ✗ 未找到 package.json"
    exit 1
fi

# 检查 node_modules
echo "4. 检查依赖..."
if [ -d "node_modules" ]; then
    echo "   ✓ 依赖已安装"
else
    echo "   ⚠ 依赖未安装，正在安装..."
    npm install
    if [ $? -eq 0 ]; then
        echo "   ✓ 依赖安装成功"
    else
        echo "   ✗ 依赖安装失败"
        exit 1
    fi
fi

# 检查环境变量
echo "5. 检查环境变量..."
if [ -f ".env.local" ]; then
    echo "   ✓ .env.local 文件存在"
    
    # 检查必要的环境变量
    if grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local && grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local; then
        echo "   ✓ 环境变量配置完整"
    else
        echo "   ⚠ 环境变量配置不完整，请检查 .env.local"
    fi
else
    echo "   ⚠ .env.local 文件不存在"
    if [ -f "env.example" ]; then
        echo "   正在从 env.example 创建 .env.local..."
        cp env.example .env.local
        echo "   ✓ 已创建 .env.local，请编辑并填入 Supabase 配置"
    fi
fi

echo ""
echo "=========================================="
echo "检查完成！"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 编辑 .env.local 文件，填入 Supabase 配置"
echo "2. 在 Supabase 中执行 supabase/schema.sql 创建数据库表"
echo "3. 在 Supabase Storage 中创建 'serial-numbers' bucket"
echo "4. 运行 'npm run dev' 启动开发服务器"
echo ""
