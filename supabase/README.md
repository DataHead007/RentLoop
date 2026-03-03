# 数据库设置说明

## 1. 在 Supabase 中创建数据库表

1. 登录你的 Supabase 项目
2. 进入 SQL Editor
3. 复制 `schema.sql` 文件中的 SQL 代码
4. 执行 SQL 代码创建所有表和索引

## 2. 表结构说明

### categories（品类表）
- 存储设备品类（如：相机、镜头、游戏机等）
- 支持动态添加品类

### items（资产表）
- 存储具体的设备信息
- 包含序列号字段（防调包关键）
- 支持发票上传（purchase_invoice_url）
- 状态：available（可用）、rented（出租中）、maintenance（维护中）、retired（已退役）

### orders（订单表）
- 存储租赁订单信息
- 包含发货和收货时的序列号照片 URL
- 状态：pending（待确认）、confirmed（已确认）、in_progress（进行中）、completed（已完成）、cancelled（已取消）

### transactions（交易记录表）
- 存储所有收入和支出记录
- 类型：income（收入）、expense（支出）
- 可以关联订单，也可以独立存在

## 3. 注意事项

- 所有表都有自动更新的 `updated_at` 字段
- 外键关系已设置，确保数据完整性
- 已创建必要的索引以提高查询性能
