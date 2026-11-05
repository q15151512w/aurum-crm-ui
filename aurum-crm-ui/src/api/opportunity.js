import request from '@/utils/request'
import { USE_MOCK, delay, mockNotImplemented } from './_mock'
import {
  opportunity, quotation, contract, queryPage, findById, removeById, insertRow, updateById,
  nextId, nowStr, MOCK_CURRENT_USER
} from '@/mock/db'

/**
 * 商机与报价单 —— 对应《05-接口文档.md》5.1 商机 / 5.2 报价单
 */

const BASE = '/crm/opportunity'
const QUOT = '/crm/quotation'

// ---------------------------------------------------------------------------
//  5.1 商机
// ---------------------------------------------------------------------------
export async function getOpportunityPage(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(opportunity, params)
  }
  return request({ url: BASE, method: 'get', params })
}

export async function getOpportunityDetail(id) {
  if (USE_MOCK) {
    await delay()
    const row = findById(opportunity, id)
    // 加过产品的用行上的那份，没加过的给一份演示数据
    return row ? { ...row, products: row.products ?? mockProducts() } : null
  }
  return request({ url: `${BASE}/${id}`, method: 'get' })
}

export async function createOpportunity(data) {
  if (USE_MOCK) {
    await delay()
    return insertRow(opportunity, data)
  }
  return request({ url: BASE, method: 'post', data })
}

export async function updateOpportunity(id, data) {
  if (USE_MOCK) {
    await delay()
    return updateById(opportunity, id, data)
  }
  return request({ url: `${BASE}/${id}`, method: 'put', data })
}

export async function deleteOpportunity(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(opportunity, id)
  }
  return request({ url: `${BASE}/${id}`, method: 'delete' })
}

/**
 * 变更阶段（会写阶段变更日志）
 *
 * mock 下要真的改阶段，并往阶段历史里追加一条 —— 否则「变更成功」之后
 * 基础信息里的阶段和「阶段变更历史」Tab 都纹丝不动，等于没生效。
 *
 * @param {Object} data { stage, remark }
 */
export async function changeOpportunityStage(id, data) {
  if (USE_MOCK) {
    await delay()
    const row = findById(opportunity, id)
    if (!row) return null

    const fromStage = row.stage
    updateById(opportunity, id, { stage: data?.stage })
    mockStageLog.unshift({
      id: nextId(mockStageLog),
      fromStage,
      toStage: data?.stage,
      operator: MOCK_CURRENT_USER,
      time: nowStr(),
      remark: data?.remark || '--'
    })
    return row
  }
  return request({ url: `${BASE}/${id}/stage`, method: 'put', data })
}

/** 阶段变更历史 */
export async function getOpportunityStageLog(id) {
  if (USE_MOCK) {
    await delay()
    return mockStageLog
  }
  return request({ url: `${BASE}/${id}/stage-log`, method: 'get' })
}

/**
 * 添加产品明细
 * @param {Array} products 明细行数组（ProductItemEditor 的形状）
 */
export async function addOpportunityProducts(id, products) {
  if (USE_MOCK) {
    await delay()
    const row = findById(opportunity, id)
    if (!row) return null
    const current = row.products ?? mockProducts()
    return updateById(opportunity, id, { products: [...current, ...products] })
  }
  return request({ url: `${BASE}/${id}/products`, method: 'post', data: products })
}

/** 更新产品明细（整份覆盖） */
export async function updateOpportunityProducts(id, products) {
  if (USE_MOCK) {
    await delay()
    return updateById(opportunity, id, { products })
  }
  return request({ url: `${BASE}/${id}/products`, method: 'put', data: products })
}

/** 选择器专用 */
export async function getOpportunitySimpleList(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(opportunity, params)
  }
  return request({ url: `${BASE}/simple-list`, method: 'get', params })
}

/** 商机导出 */
export function exportOpportunity(params) {
  if (USE_MOCK) return mockNotImplemented('导出商机')
  return request({ url: `${BASE}/export`, method: 'get', params })
}

/**
 * 关注 / 取消关注商机（后端 POST / DELETE /crm/opportunity/{id}/star，都是幂等的）。
 *
 * ⚠️ 刻意不做成单个 toggle 接口：toggle 不幂等，双击或请求重试会把状态翻回去，
 * 让图标和 crm_star 里的记录相反。星标是个裸图标，恰恰是最容易双击的控件。
 *
 * mock 下没有关注表，就地改这一行的 starred —— 不做的话「我关注的商机」胶囊
 * （SCOPE_PREDICATES.starred 读 r.starred）与星标列都会立刻变回原样，看着像 bug。
 */
export async function starOpportunity(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(opportunity, id, { starred: true })
  }
  return request({ url: `${BASE}/${id}/star`, method: 'post' })
}

export async function unstarOpportunity(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(opportunity, id, { starred: false })
  }
  return request({ url: `${BASE}/${id}/star`, method: 'delete' })
}

/** 销售漏斗统计（首页看板用） */
export async function getOpportunityFunnel(params) {
  if (USE_MOCK) {
    await delay()
    return mockFunnel
  }
  return request({ url: `${BASE}/funnel`, method: 'get', params })
}

// ---------------------------------------------------------------------------
//  5.2 报价单
// ---------------------------------------------------------------------------
export async function getQuotationPage(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(quotation, params)
  }
  return request({ url: QUOT, method: 'get', params })
}

export async function getQuotationDetail(id) {
  if (USE_MOCK) {
    await delay()
    const row = findById(quotation, id)
    return row ? { ...row, products: mockProducts() } : null
  }
  return request({ url: `${QUOT}/${id}`, method: 'get' })
}

export async function createQuotation(data) {
  if (USE_MOCK) {
    await delay()
    return insertRow(quotation, data)
  }
  return request({ url: QUOT, method: 'post', data })
}

export async function updateQuotation(id, data) {
  if (USE_MOCK) {
    await delay()
    return updateById(quotation, id, data)
  }
  return request({ url: `${QUOT}/${id}`, method: 'put', data })
}

export async function deleteQuotation(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(quotation, id)
  }
  return request({ url: `${QUOT}/${id}`, method: 'delete' })
}

export async function getQuotationSimpleList(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(quotation, params)
  }
  return request({ url: `${QUOT}/simple-list`, method: 'get', params })
}

/** 报价单导出 */
export function exportQuotation(params) {
  if (USE_MOCK) return mockNotImplemented('导出报价单')
  return request({ url: `${QUOT}/export`, method: 'get', params })
}

/**
 * 关注 / 取消关注报价单（后端 POST / DELETE /crm/quotation/{id}/star，都是幂等的）。
 *
 * 与商机的 starOpportunity / unstarOpportunity 完全同形，共用后端同一套
 * StarService + crm_star（biz_type = 4 报价单 / 3 商机）。
 */
export async function starQuotation(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(quotation, id, { starred: true })
  }
  return request({ url: `${QUOT}/${id}/star`, method: 'post' })
}

export async function unstarQuotation(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(quotation, id, { starred: false })
  }
  return request({ url: `${QUOT}/${id}/star`, method: 'delete' })
}

/**
 * 报价单转合同（`POST /crm/quotation/{id}/convert-contract`）
 *
 * 后端按报价明细生成一份**合同草稿**（编号、明细金额、草稿态都由合同模块负责），
 * 同时把报价单状态置为「已生成合同」，返回**新合同 ID**。
 *
 * ⚠️ 一个报价单可以出多份合同（1:N），所以「已生成合同」的单子还能再转 ——
 *    后端不拦这种重复转换，前端也不该拦。已失效（3 已拒绝 / 4 已作废）的报价单
 *    会被后端以 2252 拒绝。
 *
 * mock 下必须真的落库两件事，否则「转换成功」之后列表状态纹丝不动、合同列表里
 * 也找不到新合同，看着像功能没生效（《开发注意事项》第 6 条）：
 *   ① 往 contract 表插一行；② 把报价单的 status 改成「已生成合同」并记下合同号。
 */
export async function convertQuotationToContract(id) {
  if (USE_MOCK) {
    await delay()
    const row = findById(quotation, id)
    if (!row) return null
    const created = insertRow(contract, {
      name: `${row.name}（由报价单转换）`,
      contractNo: `HT${nextId(contract)}`,
      customerName: row.customerName,
      opportunityName: row.opportunityName,
      quotationNo: row.quotationNo,
      auditStatus: '未提交',
      contractType: '销售合同',
      finalAmount: row.finalAmount,
      ownerName: row.ownerName,
      remark: '由报价单转换生成'
    })
    updateById(quotation, id, {
      status: '已生成合同',
      contractId: created.id,
      contractNo: created.contractNo
    })
    return created.id
  }
  return request({ url: `${QUOT}/${id}/convert-contract`, method: 'post' })
}

/**
 * 作废报价单（`POST /crm/quotation/{id}/void`）
 *
 * 状态落到库里的 `4 已作废`，列表归并显示成「已失效」。
 * **只有「报价中」的报价单能作废**：已生成合同的单子已有下游合同（先去处理合同），
 * 已失效是终态 —— 两者后端都抛 2252。
 */
export async function voidQuotation(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(quotation, id, { status: '已失效' })
  }
  return request({ url: `${QUOT}/${id}/void`, method: 'post' })
}

// ---------------------------------------------------------------------------
//  mock 明细
// ---------------------------------------------------------------------------
/**
 * 明细行字段用《02-建表文档》3.5 的口径（unit_price / quantity / discount_rate / tax_rate）。
 * 早先这里用的是 price / count，和明细编辑器对不上，已统一。
 *
 * ⚠️ 写成函数而不是常量：明细编辑器会就地改这些行（回写 amount），
 *    共享一份数组的话，编辑一个报价单会串到另一个。
 */
const mockProducts = () => [
  {
    productId: 1,
    productName: '手机',
    unitName: '台',
    quantity: 2,
    unitPrice: 3200,
    discountRate: 0,
    taxRate: 13,
    amount: 6400,
    remark: ''
  },
  {
    productId: 2,
    productName: '鼠标',
    unitName: '个',
    quantity: 5,
    unitPrice: 120,
    discountRate: 0,
    taxRate: 13,
    amount: 600,
    remark: ''
  }
]

const mockStageLog = [
  { id: 1, fromStage: '初步接洽', toStage: '需求确认', operator: '李传锋', time: '2025-06-10 10:20', remark: '已完成初次拜访' },
  { id: 2, fromStage: '需求确认', toStage: '方案报价', operator: '李传锋', time: '2025-06-18 15:40', remark: '已提交报价方案' }
]

const mockFunnel = [
  { stage: '初步接洽', count: 32, amount: 480000 },
  { stage: '需求确认', count: 21, amount: 350000 },
  { stage: '方案报价', count: 14, amount: 260000 },
  { stage: '商务谈判', count: 8, amount: 180000 },
  { stage: '赢单', count: 5, amount: 120000 }
]
