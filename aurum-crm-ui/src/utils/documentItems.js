/**
 * 单据明细行 → 明细编辑器行
 *
 * 「明细行」这个结构全项目共用一份（《02-建表文档》3.5：`crm_quotation_item` /
 * `crm_opportunity_item` / `crm_contract_item` 三张表字段完全一致）：
 *   - 后端响应：`DocumentItemRespVO`（报价单 / 商机的列表与详情、以及选择器的 `products`）
 *   - 前端编辑器：`components/form/ProductItemEditor.vue`（读写的就下面这几个键）
 *
 * 所以这个映射函数也只有一份 —— 合同表单（选报价单带出产品）与报价单表单（选商机带出产品）
 * 都调它。写第二份的后果是必然漂移：改了字段只改一处，另一处的明细就会缺字段或写坏，
 * 而症状只是「某张单据的单位/金额列是空的」（仓库为「同一逻辑两份实现」踩过坑，见
 * 《07-测试BUG记录》BUG-020 与前端《开发注意事项》第 33 条）。
 *
 * ⚠️ 两个字段刻意**不搬**：
 *   - `id`：那是来源单据（如报价单）明细行的主键，同一条产品可以出现在多份合同里，搬过去没有意义
 *   - `sort`：行序由提交顺序决定（与「添加产品」手加的行一致），各表的 `sort` 列都有 `DEFAULT 0` 兜底
 *
 * ⚠️ `unitId` / `productTypeId` 必须带上：报价单 / 商机的明细是**按单位名反查** `sys_unit`，
 *    而合同的明细（`ContractServiceImpl.buildItems`）是**直接从请求里取 `unitId`** ——
 *    漏了它，合同的单位就丢了。
 *
 * @param {Array} products 后端给的明细数组（可为空/缺失，返回空数组）
 * @returns {Array} `ProductItemEditor` 能直接铺开的明细行
 */
export function toDocumentItems(products) {
  return (products || []).map((p) => ({
    productId: p.productId ?? null,
    productName: p.productName ?? '',
    productTypeId: p.productTypeId ?? null,
    unitId: p.unitId ?? null,
    unitName: p.unitName ?? '',
    quantity: Number(p.quantity) || 0,
    unitPrice: Number(p.unitPrice) || 0,
    discountRate: Number(p.discountRate) || 0,
    taxRate: Number(p.taxRate) || 0,
    amount: Number(p.amount) || 0,
    remark: p.remark ?? ''
  }))
}
