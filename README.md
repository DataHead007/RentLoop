# RentLoop - 专业租赁管理系统

一个为"以租代售"模式的个人商家量身定制的专业租赁管理系统。

## 技术栈

- **Framework:** Next.js 14 (App Router)
- **UI Components:** Shadcn UI
- **Database:** Supabase (PostgreSQL)
- **Charts:** Recharts
- **Icons:** Lucide React
- **Date Handling:** date-fns

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `env.example` 为 `.env.local` 并填入你的 Supabase 配置：

```bash
cp env.example .env.local
```

在 `.env.local` 中填入：
- `NEXT_PUBLIC_SUPABASE_URL`: 你的 Supabase 项目 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 你的 Supabase Anon Key

### 3. 运行开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 项目结构

```
rentloop/
├── app/                  # Next.js App Router
│   ├── layout.tsx       # 根布局
│   ├── page.tsx         # 首页
│   └── globals.css      # 全局样式
├── components/          # React 组件
│   └── ui/             # Shadcn UI 组件
├── lib/                # 工具函数和配置
│   ├── supabase/       # Supabase 客户端配置
│   └── utils.ts        # 通用工具函数
└── public/             # 静态资源
```

## 功能特性

- ✅ 资产档案管理（动态品类、发票上传、序列号防调包）
- ✅ 高级可视化看板（收入支出趋势、品类分析、Top 产品）
- ✅ 防调包收货流程

## 开发计划

- [x] Step 1: 基础设施搭建
- [x] Step 2: 数据库与资产档案
- [x] Step 3: 日历与订单
- [x] Step 4: 数据分析看板
- [x] Step 5: 安全收货流程

## 额外设置

### Supabase Storage

需要创建 Storage bucket 用于存储序列号照片，详见 `supabase/storage-setup.md`。

### 数据库迁移

数据库迁移顺序与上线检查清单见 `supabase/MIGRATIONS.md`。
建议不要只手动执行单个 SQL，而是按该文档顺序完整执行并自检。
