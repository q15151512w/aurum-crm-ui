import request from '@/utils/request'
// ⚠️ 开关必须从 _mock 引，不要在本文件里自己声明一份。
//    这个文件原本自己写了一行 `const USE_MOCK = import.meta.env.VITE_APP_USE_MOCK === 'true'`，
//    和 _mock.js 的那份各判各的 —— 一旦两者的判据不一致（曾经就是，
//    _mock.js 误写成 === 'false'），就会出现「看板打真后端、其余模块走 mock」的劈裂状态，
//    症状是登录后一堆 401，但登录本身看起来是成功的。
import { USE_MOCK, delay } from './_mock'

/** 分页响应的空壳，mock 里复用 */
const emptyPage = (pageNo = 1, pageSize = 20) => ({ list: [], total: 0, pageNo, pageSize })

// =============================================================================
//  9.1 待办事项
// =============================================================================
export async function getDashboardTodo() {
  if (USE_MOCK) {
    await delay(300)
    return {
      pendingVisitCustomer: 5,
      pendingLead: 8,
      pendingOpportunity: 20,
      pendingContractAudit: 12,
      pendingFinanceAudit: 20,
      pendingInvoice: 56
    }
  }
  return request({ url: '/dashboard/todo', method: 'get' })
}

// =============================================================================
//  9.2 实时数据
// =============================================================================

/**
 * @param {'month'|'week'|'day'} range 本月 / 本周 / 今日
 */
export async function getDashboardStats(range = 'month') {
  if (USE_MOCK) {
    await delay(300)
    return {
      leadCount: 15,
      customerCount: 6,
      opportunityCount: 8,
      contractCount: 3,
      salesAmount: 82000,
      receivedAmount: 40500,
      invoicedAmount: 15500
    }
  }
  return request({ url: '/dashboard/stats', method: 'get', params: { range } })
}

// =============================================================================
//  9.3 我关注的
// =============================================================================

/**
 * @param {Object} query
 * @param {string} query.tab   lead|customer|opportunity|quotation|contract|payment|invoice
 * @param {string} query.scope mine 我关注的 / subordinate 我负责的
 * @param {number} query.pageNo
 * @param {number} query.pageSize
 */
export async function getDashboardFocus(query) {
  if (USE_MOCK) {
    await delay(300)
    const { tab = 'lead', pageNo = 1, pageSize = 20 } = query || {}
    // 原型只给了「线索」页签的数据，其余页签先返回空
    const rows = tab === 'lead' ? mockFocusRows : []
    return { list: rows, total: rows.length, pageNo, pageSize }
  }
  return request({ url: '/dashboard/focus', method: 'get', params: query })
}

/** 原型首页「我关注的」里的 4 行示例数据（字段名与文档 9.3 一致） */
const mockFocusRows = [
  { id: 1, starred: true, name: '王林', source: '广告', phone: '138****8888', email: '1388888@qq.com', industry: 'IT', ownerName: '李传锋', level: '重点客户', nextContactTime: '2025-06-28', region: '广东省广州市天河区', address: 'xx路1号' },
  { id: 2, starred: true, name: '李侯', source: '转介绍', phone: '138****8889', email: '1388889@126.com', industry: '事业单位', ownerName: '李传锋', level: '普通客户', nextContactTime: '2025-06-28', region: '浙江省宁波市鄞州区', address: 'xx路1号' },
  { id: 3, starred: true, name: '刘婷', source: '促销', phone: '138****8881', email: '<邮箱已脱敏>', industry: '金融', ownerName: '李传锋', level: '重点客户', nextContactTime: '2025-06-28', region: '广东省广州市天河区', address: 'xx路1号' },
  { id: 4, starred: true, name: '李明', source: '商城咨询', phone: '138****8882', email: '1388882@foxmail.com', industry: '房地产', ownerName: '杨林', level: '普通客户', nextContactTime: '2025-06-28', region: '浙江省宁波市鄞州区', address: 'xx路1号' }
]

// =============================================================================
//  9.4 消息 / 9.5 公告|通知
// =============================================================================
export async function getDashboardMessages(query) {
  if (USE_MOCK) {
    await delay(300)
    const { pageNo = 1, pageSize = 20 } = query || {}
    return { list: mockMessages, total: mockMessages.length, pageNo, pageSize }
  }
  return request({ url: '/dashboard/messages', method: 'get', params: query })
}

export async function getDashboardNotices(query) {
  if (USE_MOCK) {
    await delay(300)
    const { pageNo = 1, pageSize = 20 } = query || {}
    return { list: mockNotices, total: mockNotices.length, pageNo, pageSize }
  }
  return request({ url: '/dashboard/notices', method: 'get', params: query })
}

const mockMessages = [
  { id: 1, type: 'approval', typeName: '审批', title: '王肖的回款审批，申请单号：42506380001', link: '/finance/payment-audit', time: '2025-06-26 14:38' },
  { id: 2, type: 'approval', typeName: '审批', title: '王肖的开票审批，申请单号：62506190001', link: '/finance/invoice-issue', time: '2025-06-26 14:38' },
  { id: 3, type: 'approval', typeName: '审批', title: '王肖的回款审批，申请单号：42506380002', link: '/finance/payment-audit', time: '2025-06-26 14:38' },
  { id: 4, type: 'approval', typeName: '审批', title: '王肖的开票审批，申请单号：62506190003', link: '/finance/invoice-issue', time: '2025-06-26 14:38' },
  { id: 5, type: 'approval', typeName: '审批', title: '王肖的开票审批，申请单号：62506190004', link: '/finance/invoice-issue', time: '2025-06-20 09:55' }
]

const mockNotices = [
  { id: 1, type: 'notice', typeName: '通知', title: '关于新增玩具品类商品的通知', link: null, time: '2025-06-20 09:55' },
  { id: 2, type: 'notice', typeName: '通知', title: '关于新增玩具品类商品的通知', link: null, time: '2025-06-20 09:55' },
  { id: 3, type: 'notice', typeName: '通知', title: '关于新增玩具品类商品的通知', link: null, time: '2025-06-20 09:55' },
  { id: 4, type: 'announcement', typeName: '公告', title: '关于召回异常充电宝的公告', link: null, time: '2025-06-20 09:55' },
  { id: 5, type: 'announcement', typeName: '公告', title: '关于调整华阳手机价格的公告', link: null, time: '2025-06-20 09:55' }
]

// =============================================================================
//  9.6 快捷入口
// =============================================================================
export async function getDashboardShortcuts() {
  if (USE_MOCK) {
    await delay(200)
    return mockShortcuts
  }
  return request({ url: '/dashboard/shortcuts', method: 'get' })
}

/**
 * 原型图标是自定义 SVG（images/首页/uNNN.svg），没法复用，
 * 这里换成 Element Plus 图标名 + 配色，保持「彩色方块 + 文字」的观感。
 */
const mockShortcuts = [
  { name: '线索', path: '/crm/lead', icon: 'Promotion', color: '#28D094' },
  { name: '线索池', path: '/crm/lead-pool', icon: 'Box', color: '#F59A23' },
  { name: '客户', path: '/crm/customer', icon: 'User', color: '#2C6DDB' },
  { name: '公海', path: '/crm/customer-pool', icon: 'Ship', color: '#666EE8' },
  { name: '商机', path: '/crm/opportunity', icon: 'TrendCharts', color: '#17B0C4' },
  { name: '商机报价单', path: '/crm/quotation', icon: 'Tickets', color: '#2C6DDB' },
  { name: '合同', path: '/crm/contract', icon: 'Document', color: '#28D094' },
  { name: '合同审核', path: '/crm/contract-audit', icon: 'Stamp', color: '#F59A23' },
  { name: '产品类型', path: '/crm/product-category', icon: 'Menu', color: '#666EE8' },
  { name: '产品', path: '/crm/product', icon: 'Goods', color: '#17B0C4' },
  { name: '回款登记', path: '/finance/payment', icon: 'Money', color: '#28D094' },
  { name: '发票管理', path: '/finance/invoice', icon: 'Files', color: '#F59A23' },
  { name: '组织架构', path: '/system/dept', icon: 'OfficeBuilding', color: '#2C6DDB' },
  { name: '人员管理', path: '/system/user', icon: 'UserFilled', color: '#666EE8' },
  { name: '角色权限', path: '/system/role', icon: 'Lock', color: '#E8657A' }
]

// =============================================================================
//  预留：原型首页没有对应区块，等后续看板页再用
// =============================================================================
/**
 * 销售漏斗
 *
 * ⚠️ 文档第九节把 funnel/trend 标成「预留」，**没有定义响应结构**，
 *    这里的形状（`[{ stage, count, amount }]`）是前端定的，与
 *    `getOpportunityFunnel`（5.1）保持一致，接后端时要一起对齐。
 *    文档已记进待补清单。
 */
export async function getDashboardFunnel() {
  if (USE_MOCK) {
    await delay(200)
    // 逐级递减，像真的漏斗（原型首页有统计图但没给数据，数量按经验给）
    const stages = [
      { stage: '初步接洽', count: 32, amount: 480000 },
      { stage: '需求确认', count: 21, amount: 350000 },
      { stage: '方案报价', count: 14, amount: 260000 },
      { stage: '商务谈判', count: 8, amount: 180000 },
      { stage: '赢单', count: 5, amount: 120000 }
    ]
    return stages
  }
  return request({ url: '/dashboard/funnel', method: 'get' })
}

/**
 * 趋势图
 *
 * 同样：文档没定义结构，这里是前端定的 `[{ date, leadCount, customerCount, contractCount, salesAmount }]`。
 *
 * @param {'day'|'week'|'month'} range 与「实时数据」的时间维度共用
 */
export async function getDashboardTrend(range = 'month') {
  if (USE_MOCK) {
    await delay(200)
    const points = range === 'day' ? 12 : range === 'week' ? 7 : 14
    const unit = range === 'day' ? '小时' : '日'
    const today = new Date()
    const out = []
    // 稳定伪随机：同样的索引永远同样的值，刷新页面曲线不会乱跳
    for (let i = points - 1; i >= 0; i--) {
      const d = new Date(today)
      if (range === 'day') d.setHours(today.getHours() - i)
      else d.setDate(today.getDate() - i)
      const pad = (n) => String(n).padStart(2, '0')
      const label =
        range === 'day'
          ? `${pad(d.getHours())}:00`
          : `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      const k = points - i
      out.push({
        date: label,
        leadCount: 3 + (k * 7) % 11,
        customerCount: 2 + (k * 5) % 8,
        contractCount: 1 + (k * 3) % 5,
        salesAmount: 20000 + ((k * 13700) % 90000),
        unit
      })
    }
    return out
  }
  return request({ url: '/dashboard/trend', method: 'get', params: { range } })
}

export { emptyPage }
