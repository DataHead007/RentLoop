# RentLoop 安装指南

## 系统要求

- macOS / Linux / Windows
- Node.js 18+ 和 npm
- Supabase 账号

## 安装步骤

### 1. 安装 Node.js

如果还没有安装 Node.js，请选择以下方式之一：

#### 方式一：使用 Homebrew（推荐，macOS）

```bash
# 如果遇到权限问题，先修复权限
sudo chown -R $(whoami) /opt/homebrew/Cellar

# 安装 Node.js
brew install node

# 验证安装
node --version
npm --version
```

#### 方式二：从官网下载安装器（推荐，所有系统）

1. 访问 https://nodejs.org/
2. 下载 LTS 版本（推荐）
3. 运行安装器
4. 验证安装：

```bash
node --version
npm --version
```

#### 方式三：使用 nvm（Node Version Manager）

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新加载终端配置
source ~/.zshrc  # 或 source ~/.bash_profile

# 安装 Node.js LTS 版本
nvm install --lts
nvm use --lts

# 验证安装
node --version
npm --version
```

### 2. 进入项目目录

```bash
cd ~/.cursor-tutor/projects/rentloop
```

### 3. 安装项目依赖

```bash
npm install
```

如果遇到网络问题，可以使用国内镜像：

```bash
npm install --registry=https://registry.npmmirror.com
```

### 4. 配置环境变量

```bash
# 复制环境变量模板
cp env.example .env.local

# 编辑环境变量文件
nano .env.local
# 或使用其他编辑器
# open -e .env.local  # macOS
# code .env.local     # VS Code
```

在 `.env.local` 中填入你的 Supabase 配置：

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. 设置 Supabase 数据库

1. 登录你的 Supabase 项目：https://supabase.com
2. 进入 **SQL Editor**
3. 打开 `supabase/schema.sql` 文件
4. 复制全部内容并粘贴到 SQL Editor 中
5. 点击 **Run** 执行 SQL，创建所有表

### 6. 创建 Storage Bucket

1. 在 Supabase Dashboard 中，进入 **Storage**
2. 点击 **New bucket**
3. 输入 bucket 名称：`serial-numbers`
4. 选择 **Public bucket**（可选，如果希望直接访问图片）
5. 点击 **Create bucket**

详细说明请参考：`supabase/storage-setup.md`

### 7. 启动开发服务器

```bash
npm run dev
```

应用将在 http://localhost:3000 启动。

## 故障排除

### Node.js 未找到

如果 `node --version` 返回 "command not found"：

1. 确认 Node.js 已正确安装
2. 检查 PATH 环境变量：

```bash
echo $PATH
```

3. 如果 Node.js 安装在非标准位置，需要添加到 PATH：

```bash
# 找到 Node.js 安装位置
which node  # 或 find /usr -name node 2>/dev/null

# 添加到 PATH（临时）
export PATH="/path/to/node/bin:$PATH"

# 永久添加（在 ~/.zshrc 或 ~/.bash_profile 中）
echo 'export PATH="/path/to/node/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### npm install 失败

如果 `npm install` 遇到网络问题：

```bash
# 使用国内镜像
npm install --registry=https://registry.npmmirror.com

# 或使用 cnpm
npm install -g cnpm --registry=https://registry.npmmirror.com
cnpm install
```

### 权限错误

如果遇到权限错误：

```bash
# 不要使用 sudo 安装 npm 包
# 如果必须使用，修复 npm 目录权限：
sudo chown -R $(whoami) ~/.npm
```

## 下一步

安装完成后，请参考 `README.md` 了解如何使用系统。
