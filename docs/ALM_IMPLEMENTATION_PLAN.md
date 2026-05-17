# ALM 折中架构实施计划（记法 A：流水为真，展示为算）

> **原则**：复式流水 / `financing_loans` 为唯一真相；租金等收入**不**自动减少 `unpaid_loan`；**只有**明确还本（及融资表状态）才减少负债。本表用于跟踪进度，完成后可将整段勾选为 done。

---

## 阶段总览

| 阶段 | 目标 | 预估复杂度 | 状态 |
|------|------|------------|------|
| P0 | 规则冻结 + 类目/数据源对齐说明 | 低 | ✅ 首版（见附录白名单） |
| P1 | 只读 `FinanceALMService` + 全局余额 API | 中 | ✅ 首版 |
| P2 | 单资产虚拟瀑布字段 API（红黄绿数据源） | 中 | ✅ 首版（`GET /api/alm/items/[id]` + `computeAlmStackSegments` + `ItemWithStats` 增补字段） |
| P3 | 顶部全局控制台 + 还款提醒横幅 | 中 | ✅ 首版（`AlmGlobalBar`） |
| P4 | 资产卡片三色堆叠条 | 中 | ✅ 首版（`AlmStackedBar`：**详情**；列表/移动卡为单条回本进度，避免双条重复） |
| P5 | 清算卖出 + 红/黄告警闭环 | 中高 | ✅ 首版（见下 P5 节） |
| P6（可选） | `items` 静态 `funding_own` / `funding_loan` 与表单校验 | 低中 | ⬜ 待开始 |
| P7（可选） | 客户标签 + 租金贡献统计 | 中 | ⬜ 待开始 |

---

## P0 — 规则与数据契约（先拍板、后写码）

| # | 任务 | 完成 |
|---|------|------|
| P0-1 | 书面确认记法 A：`unpaid_loan` 仅随 **还本流水** + **`principal_remaining`** 变化，租金不冲贷 | ✅ |
| P0-2 | 列出参与 **Global_Balance** 的收入类类目白名单（如：租金、变卖、融资放款入账等） | ✅ 见 `lib/finance/almConstants.ts` |
| P0-3 | 列出参与 **Global_Balance** 的支出类类目白名单（如：归还借款本金、融资成本、私人提现若已有类目） | ✅ 同上（暂无独立「私人提现」类目时，用各业务线支出白名单） |
| P0-4 | 约定「还本」唯一推荐入口：融资详情页 vs 允许手工交易，及如何避免重复记账 | ⬜ 建议仍以融资页为准；手工需类目「归还借款本金」 |

**产出**：附录白名单；实现见 `lib/finance/almConstants.ts`。

---

## P1 — 只读引擎 + 全局余额（不改表也可 MVP）

| # | 任务 | 完成 |
|---|------|------|
| P1-1 | 新增 `lib/finance/almService.ts`（或同级）实现 `getGlobalBalance()`：按 P0 白名单对 `transactions` 做 SUM | ✅ `getAlmGlobalSummary()` |
| P1-2 | 单元测试或脚本样例：用 fixtures 验证 Global 公式与手工 Excel 一致 | ⬜ 可后续加；纯函数 `globalWalletContribution` 便于测 |
| P1-3 | `GET /api/alm/summary`（或 `/api/finance/global-wallet`）返回 `{ globalBalance, computedAt, warnings? }` | ✅ |
| P1-4 | 开发环境自测：与现有「交易列表」总金额对拍一次（记录已知差异原因） | ⬜ 本地对拍后在此记录差异；未计入明细见 `/alm/rental-exclusions` |

**依赖**：P0 白名单。

---

## P2 — 单资产虚拟瀑布（只读，不落库动态负债）

| # | 任务 | 完成 |
|---|------|------|
| P2-1 | `getAssetWaterfall(itemId)`：`unpaid_loan` ← `financing_loans.principal_remaining`（无贷则 0） | ✅ `financing_principal_remaining` |
| P2-2 | `unrecovered_own`：与现有 **自付购置 / 经营盈余** 规则对齐（不拿租金冲红条） | ✅ 黄段公式见 `almItemWaterfall.ts` |
| P2-3 | `pure_profit` 展示段：与现有 `payback_excess` 对齐 | ✅ |
| P2-4 | `GET /api/alm/items/[id]` 或扩展现有 `GET /api/items/[id]` 附加 `alm` 字段 | ✅ 独立路由；`ItemWithStats` 已带 `effective_purchase_cost` |

**依赖**：P1 类目思想一致；与 `getItemStats` 文档对齐。

---

## P3 — 顶部全局控制台 + 智能还款提示

| # | 任务 | 完成 |
|---|------|------|
| P3-1 | 在 `layout` 或 `Navbar` / 专用条：展示 `Global Balance`（大字） | ✅ `components/layout/AlmGlobalBar.tsx` |
| P3-2 | 条件横幅：`globalBalance >= 阈值`（默认 1000，可 env）且存在 `principal_remaining > 0` 的融资 | ✅ 环境变量 `ALM_REPAYMENT_HINT_MIN_BALANCE` |
| P3-3 | 横幅 CTA 跳转：`/financing-loans` 或第一笔 active loan 详情 | ✅ 链至列表 |

**依赖**：P1 API。

---

## P4 — 资产卡片三色堆叠条

| # | 任务 | 完成 |
|---|------|------|
| P4-1 | 组件 `AlmStackedBar`：宽度基准 = 有效购置价 | ✅ |
| P4-2 | 红 / 黄 / 绿 + 纯利溢出 | ✅ |
| P4-3 | 接入列表卡片 / 详情页 | ✅ 详情全宽 ALM；列表/移动卡仅回本进度条（密度优化） |

**依赖**：P2 字段稳定。

---

## P5 — 清算闭环（卖出 + 告警）

| # | 任务 | 完成 |
|---|------|------|
| P5-1 | 卖出流程写入明确类目流水（变卖），可选 `flow_kind` 预留 | ✅ 沿用 `设备出售` + `auto_created` 自动流水（`PATCH/POST` items）；`flow_kind` 未加列，可后续扩展 |
| P5-2 | 清算后调用同一引擎：若仍 `unpaid_loan > 0` → 红色告警文案（缺口金额） | ✅ `lib/finance/liquidationAlerts.ts` + 资产详情 `Alert` |
| P5-3 | 若贷清但 `unrecovered_own > 0` → 黄色提示（自有未回本亏损语义） | ✅ 与 P5-2 同源：ALM 黄段 `yellowAmount` |
| P5-4 | 资产状态置 `sold` 与现有售出流程合并，避免双路径 | ✅ `lib/items/normalizeItemLiquidationPatch.ts`：`PATCH/POST` 有有效出售价+日期则 `sold`；清出售信息且原为 `sold` 则回 `available`；显式 `retired`/`maintenance` 不强制改 `sold` |

**依赖**：P2；与现有 `sold_price` / 交易同步逻辑对齐。

---

## P6（可选）— 静态出资字段

| # | 任务 | 完成 |
|---|------|------|
| P6-1 | Migration：`items.funding_own`, `items.funding_loan`（nullable，老数据兼容） | ⬜ |
| P6-2 | 新建资产 / 新建融资表单：`funding_own + funding_loan ≈ purchase_price` 校验 | ⬜ |
| P6-3 | 老数据回填策略：从现有融资 + 买价推导或保持 null 走旧逻辑 | ⬜ |

---

## P7（可选）— CRM 标签

| # | 任务 | 完成 |
|---|------|------|
| P7-1 | `customer_tags` 表或 `jsonb` 字段设计 | ⬜ |
| P7-2 | 客户详情编辑标签；列表展示 | ⬜ |
| P7-3 | 每客户「累计租金贡献」聚合 API | ⬜ |

---

## 风险与回滚

| 风险 | 缓解 |
|------|------|
| 类目不一致导致 Global 偏差 | P0 白名单 + 交易表单限制可选类目 |
| 与现有「经营回本」两套数打架 | P2 显式文档：红条只看融资；黄/绿与现有经营口径映射表 |
| 范围蔓延 | 严格先交付 P1→P3 再开 P4 |

---

## 变更记录

| 日期 | 说明 |
|------|------|
| （填） | 初始化计划表 |
| 2026-05-11 | P5 清算告警与售出状态归一；P4 列表展示说明更新 |

将本表中的 ⬜ 改为 ✅ 或在 Git commit / PR 中引用本文件段落即可做轻量跟踪。

---

## 附录：租赁事业部 · 全局资金池（与代码同步）

**范围**  
仅 **`business_line = rental`** 的交易参与汇总；羽毛球、YouTube、微信视频号为**单独核算**的其他事业部，**不参与**本池。

**收入（计入，租赁类目白名单）**  
`租金收入`、`配件出售收入`、`赔偿收入`、`融资放款入账`、`设备出售`、`其他收入`

**收入（明确不计入）**  
`押金收入`

**支出（计入，租赁类目白名单；金额一般为负）**  
`设备购买`、`维护费用`、**`物流费用`**（交易里手填）、**`物流支出`**（订单物流结算自动生成）、**`转租支出`**（订单第三方转租成本自动生成）、`融资成本`、`归还借款本金`、`其他支出`

**阈值**  
还款提示默认 `globalBalance >= 1000`（且存在进行中融资）；服务端环境变量 `ALM_REPAYMENT_HINT_MIN_BALANCE` 可覆盖。
