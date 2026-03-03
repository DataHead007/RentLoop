# Supabase 配置指南

## ⚠️ 重要提示

你提供的 API Key 是 **Publishable API Key**，但 Supabase 通常需要的是 **anon public** key。

如果使用当前的 key 出现认证错误，请按以下步骤获取正确的 key：

1. 进入 Supabase Dashboard: https://supabase.com/dashboard
2. 选择你的项目
3. 点击 **Settings** → **API**
4. 找到 **Project API keys** 部分
5. 找到 **anon public** key（不是 publishable key）
6. 复制这个 key

## 📝 配置 .env.local 文件

请在项目目录下编辑 `.env.local` 文件：

```bash
cd ~/.cursor-tutor/projects/rentloop
nano .env.local
```

或者使用其他编辑器：
```bash
open -e .env.local  # macOS 文本编辑器
code .env.local     # VS Code
```

### 文件内容应该是：

```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xfwleduegnrtpiryiwyu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_AJfNq62FS0b1lOELEOmywQ_VtOvkTxA
```

**注意**：如果上面的 publishable key 不工作，请替换为 anon public key。

## ✅ 验证配置

配置完成后，运行：

```bash
npm run dev
```

如果启动成功，访问 http://localhost:3000

如果出现认证错误，说明 API key 不正确，请使用 anon public key。

