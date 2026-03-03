-- 检查和修复物流费用数据不一致问题
-- 这个脚本会检查 orders 表中的 total_shipping_cost 是否与 shipping_fees 表中的实际总和一致

-- ============================================
-- 第一步：检查数据不一致的订单
-- ============================================
-- 查看所有订单的物流费用情况
SELECT 
    o.id,
    o.order_number,
    o.customer_name,
    o.total_shipping_cost AS orders表中的物流费用,
    COALESCE(SUM(sf.amount), 0) AS shipping_fees表中的实际总和,
    o.total_shipping_cost - COALESCE(SUM(sf.amount), 0) AS 差值,
    CASE 
        WHEN o.total_shipping_cost != COALESCE(SUM(sf.amount), 0) THEN '不一致'
        ELSE '一致'
    END AS 状态
FROM orders o
LEFT JOIN shipping_fees sf ON sf.order_id = o.id
GROUP BY o.id, o.order_number, o.customer_name, o.total_shipping_cost
HAVING o.total_shipping_cost != COALESCE(SUM(sf.amount), 0)
ORDER BY o.created_at DESC;

-- ============================================
-- 第二步：查看所有订单的物流费用详情（可选，用于详细检查）
-- ============================================
-- SELECT 
--     o.id AS order_id,
--     o.order_number,
--     o.customer_name,
--     o.total_shipping_cost AS 订单表中的总额,
--     sf.id AS shipping_fee_id,
--     sf.shipping_type AS 类型,
--     sf.amount AS 单项金额,
--     sf.shipping_company AS 物流公司,
--     sf.tracking_number AS 快递单号
-- FROM orders o
-- LEFT JOIN shipping_fees sf ON sf.order_id = o.id
-- ORDER BY o.created_at DESC, sf.shipping_type;

-- ============================================
-- 第三步：修复数据不一致的问题（执行前请先备份数据）
-- ============================================
-- 重新计算所有订单的 total_shipping_cost，使其与 shipping_fees 表中的实际总和一致
UPDATE orders o
SET total_shipping_cost = COALESCE(
    (SELECT SUM(amount) FROM shipping_fees WHERE order_id = o.id),
    0
)
WHERE EXISTS (
    SELECT 1 
    FROM shipping_fees sf 
    WHERE sf.order_id = o.id
) OR o.total_shipping_cost != COALESCE(
    (SELECT SUM(amount) FROM shipping_fees WHERE order_id = o.id),
    0
);

-- ============================================
-- 第四步：验证修复结果
-- ============================================
-- 再次检查是否还有不一致的订单（应该返回0行）
SELECT 
    o.id,
    o.order_number,
    o.customer_name,
    o.total_shipping_cost AS orders表中的物流费用,
    COALESCE(SUM(sf.amount), 0) AS shipping_fees表中的实际总和,
    o.total_shipping_cost - COALESCE(SUM(sf.amount), 0) AS 差值
FROM orders o
LEFT JOIN shipping_fees sf ON sf.order_id = o.id
GROUP BY o.id, o.order_number, o.customer_name, o.total_shipping_cost
HAVING o.total_shipping_cost != COALESCE(SUM(sf.amount), 0);
