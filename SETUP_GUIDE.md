# RentLoop 快速设置指南

## ✅ 已完成的步骤

- [x] Node.js 已安装
- [x] Supabase 项目已创建
- [x] 环境变量已配置

## 📋 接下来需要完成的步骤

### 1. 在 Supabase 中创建数据库表

1. 登录 Supabase Dashboard: https://supabase.com/dashboard
2. 选择你的项目
3. 点击左侧菜单的 **SQL Editor**
4. 点击 **New query**
5. 打开项目中的 `supabase/schema.sql` 文件，复制全部内容
6. 粘贴到 SQL Editor 中
7. 点击 **Run** 按钮（或按 Cmd/Ctrl + Enter）
8. 等待执行完成，应该显示 "Success. No rows returned"

### 2. 创建 Storage Bucket

1. 在 Supabase Dashboard 左侧，点击 **Storage**
2. 点击 **New bucket** 按钮
3. 填写信息：
   - **Name**: `serial-numbers`
   - **Public bucket**: ✅ 勾选（这样可以直接访问图片）
4. 点击 **Create bucket**

### 3. 验证配置

运行安装检查脚本：

```bash
cd ~/.cursor-tutor/projects/rentloop
./check-install.sh
```

### 4. 安装项目依赖（如果还没安装）

```bash
npm install
```

### 5. 启动开发服务器

```bash
npm run dev
```

应用将在 http://localhost:3000 启动

## ⚠️ 重要提示

你提供的 API Key 是 "Publishable API Key"，但通常 Supabase 需要的是 **anon public** key。

如果应用运行时出现认证错误，请：
1. 进入 Supabase Dashboard
2. 点击 **Settings** → **API**
3. 找到 **Project API keys** 部分
4. 复制 **anon public** key（不是 publishable key）
5. 更新 `.env.local` 文件中的 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 📝 当前配置

- **Project URL**: https://xfwleduegnrtpiryiwyu.supabase.co
- **API Key**: sb_publishable_AJfNq62FS0b1lOELEOmywQ_VtOvkTxA（如果不行，请使用 anon public key）

## 🎉 完成后

完成上述步骤后，你就可以：
- 访问 http://localhost:3000 查看应用
- 在"资产档案"中添加设备
- 在"订单管理"中创建订单
- 在"数据分析看板"查看统计数据

