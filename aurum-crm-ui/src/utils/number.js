/**
 * 金额与数量计算
 *
 * ⚠️ 《02-建表文档.md》3.6「金额与数量计算口径」是唯一权威口径（文档标注「必须实现前定稿」），
 *    这里每个函数都对应那一节的一条公式。改动前先回看文档，别就地发挥。
 *
 * 两条硬规则：
 *   1. **先逐行四舍五入，再汇总** —— 不能先汇总数量/金额再算税，
 *      否则明细与合计差几分钱，财务对账时会很痛苦。
 *   2. 合同金额必须等于明细汇总，服务端会二次校验，不一致直接拒绝。
 *
 * 口径总览：unit_price 是**含税**单价，amount 是**含税**行金额。
 */

/**
 * 四舍五入到 2 位小数
 *
 * 不能直接用 Math.round(v * 100) / 100：二进制浮点下 1.005 实际是 1.00499…，
 * ×100 得 100.4999…，会被舍成 1.00。这里走「十进制字符串移位」再取整，
 * 绕开浮点表示误差。负数单独处理符号，因为 JS 的 Math.round 对 -100.5 是向 +∞ 取整。
 *
 * @param {number|string} value
 * @returns {number} 保留 2 位小数的数值
 */
export function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const sign = n < 0 ? -1 : 1
  const abs = Math.abs(n)
  // `1.005e2` 由 JS 按十进制解析成 100.5，避开 1.005 本身的表示误差
  return sign * Number(`${Math.round(Number(`${abs}e2`))}e-2`)
}

/**
 * 计算单行明细的金额（对应文档 3.6.1）
 *
 *   折后单价 = unit_price × (1 - discount_rate / 100)
 *   行金额   = ROUND(quantity × 折后单价, 2)              含税
 *   行不含税 = ROUND(行金额 / (1 + tax_rate / 100), 2)
 *   行税额   = 行金额 - 行不含税
 *
 * 行税额用两个已四舍五入的值相减，保证「不含税 + 税额 === 含税」在分位上恒等。
 *
 * @param {{quantity, unitPrice, discountRate, taxRate}} item
 * @returns {{discountedPrice: number, amount: number, netAmount: number, taxAmount: number}}
 */
export function calcItemAmounts(item = {}) {
  const quantity = Number(item.quantity) || 0
  const unitPrice = Number(item.unitPrice) || 0
  const discountRate = Number(item.discountRate) || 0
  const taxRate = Number(item.taxRate) || 0

  const discountedPrice = unitPrice * (1 - discountRate / 100)
  const amount = round2(quantity * discountedPrice)
  const netAmount = round2(amount / (1 + taxRate / 100))
  const taxAmount = round2(amount - netAmount)

  return { discountedPrice, amount, netAmount, taxAmount }
}

/**
 * 汇总一组明细（对应文档 3.6.2）
 *
 *   totalWithTax = Σ 行金额      含税合计
 *   taxAmount    = Σ 行税额
 *   totalAmount  = totalWithTax - taxAmount     不含税合计
 *
 * ⚠️ 注意 totalAmount 是**不含税**合计 —— 文档 3.6 明确如此。
 *    别被「总额」二字误导成含税。
 *
 * @param {Array} items
 * @returns {{totalWithTax: number, taxAmount: number, totalAmount: number}}
 */
export function calcItemsTotal(items = []) {
  let totalWithTax = 0
  let taxAmount = 0

  for (const item of items) {
    const { amount, taxAmount: rowTax } = calcItemAmounts(item)
    totalWithTax += amount
    taxAmount += rowTax
  }

  totalWithTax = round2(totalWithTax)
  taxAmount = round2(taxAmount)

  return {
    totalWithTax,
    taxAmount,
    totalAmount: round2(totalWithTax - taxAmount)
  }
}

/**
 * 发票金额（对应文档 3.6.3）
 *
 *   taxAmount   = ROUND(amount × tax_rate / 100, 2)
 *   totalAmount = amount + taxAmount            价税合计
 */
export function calcInvoiceAmounts({ amount, taxRate } = {}) {
  const base = round2(Number(amount) || 0)
  const taxAmount = round2((base * (Number(taxRate) || 0)) / 100)
  return {
    amount: base,
    taxAmount,
    totalAmount: round2(base + taxAmount)
  }
}

/**
 * 发票按「一票多回款」汇总金额（对应文档 3.6.3，但口径与旧版不同）
 *
 * 与 {@link calcInvoiceAmounts} 的差别：那个是「先有一个含税总额、再按税率拆」，
 * 这个是**先逐行拆、再汇总**。明细行的金额是每笔回款的「本次开票金额」（含税）：
 *
 *   lineTotal_k = writeOffAmount_k                                  含税
 *   lineNet_k   = ROUND(lineTotal_k / (1 + taxRate/100), 2)         不含税
 *   amount      = Σ lineNet_k
 *   taxAmount   = ROUND(totalAmount - amount, 2)                    取残差
 *
 * ⚠️ 税额取残差而不是 `ROUND(amount × taxRate/100, 2)`：只有残差写法能保证
 *    `totalAmount === amount + taxAmount` 在分位上恒等（文档 3.6 的硬规则 1
 *    「先逐行四舍五入再汇总」要防的就是合计对不上）。单行时两种算法等价。
 *
 * ⚠️ 这里假设各行税率相同（发票级单一税率）。税率不同时这个汇总不成立 ——
 *    当前 `fin_invoice.tax_rate` 就是一列，不打算支持多税率。
 *
 * @param {Array<{writeOffAmount}>} items 回款明细行
 * @param {number|string} taxRate 税率(%)，发票级
 * @returns {{totalAmount: number, amount: number, taxAmount: number}}
 */
export function calcInvoiceTotals(items = [], taxRate = 0) {
  const rate = Number(taxRate) || 0
  let totalAmount = 0
  let amount = 0

  for (const item of items) {
    const lineTotal = round2(Number(item?.writeOffAmount) || 0)
    totalAmount += lineTotal
    amount += round2(lineTotal / (1 + rate / 100))
  }

  totalAmount = round2(totalAmount)
  amount = round2(amount)

  return {
    totalAmount,
    amount,
    taxAmount: round2(totalAmount - amount)
  }
}

/**
 * 金额格式化：1234.5 → 1,234.50
 * 字段权限会把敏感字段置 null（接口文档 1.7），这里统一兜底成 --
 */
export function formatMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '--'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
