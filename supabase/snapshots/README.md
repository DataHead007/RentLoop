# Schema Snapshots

用于保存“稳定基线”的数据库结构快照（仅结构，不含业务数据）。

## 推荐文件命名

- `YYYY-MM-DD_schema.sql`
- 示例：`2026-04-07_schema.sql`

## 导出方式（推荐：Supabase CLI）

在项目根目录执行：

```bash
supabase db dump --schema public -f supabase/snapshots/2026-04-07_schema.sql
```

如果未登录或未关联项目，先执行：

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

## 当前环境说明

如果本机没有安装 `supabase` 命令，可先安装 CLI 后再导出。
本仓库不存储数据库业务数据，只存结构快照。

## 建议节奏

- 每次完成“数据库结构变更上线”后导出一次快照
- 快照与 `supabase/MIGRATIONS.md`、`CHANGELOG.md` 同步更新
