# Changelog

## v0.6.0 - 2026-04-07

### Added
- 新增数据库聚合 RPC：`public.get_transaction_summary`（`supabase/add_transaction_summary_rpc.sql`）。
- 新增统一 API 响应工具：`lib/api/response.ts`（`success/data` + 错误码结构）。
- 新增迁移总入口文档：`supabase/MIGRATIONS.md`。

### Changed
- `/api/transactions/stats` 改为调用数据库 RPC 聚合，减少应用层循环计算。
- 多个 `/app/api/*` 路由统一收敛到服务端 Supabase client（减少 anon/server 混用）。
- 订单列表 UI 优化：
  - 客户列降噪为“姓名 + 电话”
  - 地址改为 `MapPin` 悬浮信息卡
  - 羽毛球筛选态动态隐藏押金列，列标题动态化
  - 羽毛球状态文案语义化（待上课/进行中）

### Fixed
- 修复 `business_line = wechat_video` 约束不一致导致的交易创建失败问题。
- 资产估值接口在网络抖动时降级返回，避免频繁 500。
- 主链路 API 错误返回统一，保留旧字段兼容前端。

### Migration
- 已执行：`supabase/migration_wechat_video.sql`
- 已执行：`supabase/add_transaction_summary_rpc.sql`

### Verification
- 多轮 `next build` 通过。
- 关键接口验证通过：
  - `/api/orders`
  - `/api/transactions`
  - `/api/transactions/stats`
  - `/api/items/assets-value`
