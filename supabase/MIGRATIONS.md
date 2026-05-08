# RentLoop 数据库迁移手册

本文档是 RentLoop 数据库结构演进的单一说明入口（Single Source of Truth）。

## 目标

- 统一新环境初始化顺序，避免“代码支持但数据库约束未更新”的问题
- 统一老环境升级路径，避免手动漏跑 SQL
- 提供上线前检查清单，降低 500/约束报错风险

## 快速原则

- 新环境：先执行 `schema.sql`，再按“增量迁移顺序”执行
- 老环境：只执行未执行过的增量迁移
- 每次改表结构必须新增迁移文件，不直接改线上表

## 新环境初始化（推荐顺序）

在 Supabase SQL Editor 依次执行：

1. `schema.sql`
2. `migration_v2_complex_orders.sql`
3. `migration_v2_data.sql`
4. `删除orders_item_id列.sql`（仅在你确认 V2 数据已迁移成功后执行）
5. `migration_create_customers.sql`
6. `migration_add_customer_address.sql`
7. `migration_badminton.sql`
8. `migration_youtube.sql`
9. `migration_wechat_video.sql`
10. `add_item_id_to_transactions.sql`
11. `add_auto_created_to_transactions.sql`
12. `add_transaction_change_events.sql`
13. `add_mount_field.sql`
14. `add_item_short_name.sql`
15. `add_in_use_status.sql`
16. `add_sold_fields_to_items.sql`
17. `add_sold_status.sql`
18. `add_purchase_transactions_for_existing_items.sql`
19. `add_sale_transactions_for_existing_items.sql`
20. `fix_purchase_transaction_amounts.sql`
21. `add_fee_rate_and_net_amount.sql`
22. `检查和修复物流费用数据.sql`
23. `add_transaction_summary_rpc.sql`
24. `setup_storage_permissions.sql`

> 说明：`删除orders_item_id列.sql`、`检查和修复物流费用数据.sql` 属于“运维/数据修复类脚本”，执行前建议先备份。

## 老环境升级

按文件名从“最老到最新”执行未跑过的迁移。

如果你无法确认某个迁移是否执行过：

- 优先打开 SQL 看是否包含 `IF NOT EXISTS`/`DROP ... IF EXISTS`
- 先在测试库执行
- 再在生产执行

## 必做自检（每次迁移后）

1. `transactions.business_line` 约束包含 `wechat_video`
2. `orders` + `order_items` 查询可正常返回
3. `transaction_change_events` 表与触发器存在
4. 创建一条交易、订单、资产，确认 API 不返回 500

## 线上发布前检查清单

- [ ] 本次代码依赖的 SQL 已全部执行
- [ ] 新增约束与 `lib/types/database.ts` 保持一致
- [ ] 核心接口 smoke test 通过：
  - [ ] `GET /api/orders`
  - [ ] `GET /api/transactions`
  - [ ] `GET /api/transactions/stats`
  - [ ] `GET /api/items/assets-value`
- [ ] 回滚方案已准备（至少有数据备份）

## 后续治理建议（下一步）

- 引入 Supabase CLI 版本化迁移（`supabase migration`）
- 建立“每次 PR 必须附带迁移说明”规范
- 在 CI 增加基础 SQL 校验与 API smoke test
