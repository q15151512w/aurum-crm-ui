import request from '@/utils/request'
import { USE_MOCK, delay, mockNotImplemented } from './_mock'
import {
  customer, customerPool, poolRule, contactsByCustomer, allContacts, findContactWithList,
  invoiceInfoByCustomer, allInvoiceInfo, findInvoiceInfoWithList,
  ownerChangeLog, pushOwnerChangeLog, findOwnerChangeLog, OWNER_CHANGE_ACTION, BIZ_TYPE,
  user, queryPage, findById, removeById, insertRow, updateById, nextId, nowStr, MOCK_CURRENT_USER
} from '@/mock/db'
import { parseRegion } from '@/constants/regions'

/**
 * 把表单里的 region 拼接串拆成后端 province/city/district 三个字段。
 * 表单层只跟「地区」一个字符串打交道，拆分的职责收在这里。
 */
function splitRegion(body) {
  if (body == null) return body
  const path = parseRegion(body.region)
  return { ...body, province: path[0] ?? '', city: path[1] ?? '', district: path[2] ?? '' }
}

/**
 * 客户模块 —— 对应《05-接口文档.md》4.3 客户 / 4.4 公海 / 4.5 联系人 / 4.6 客户共享 / 4.7 开票信息
 */

const BASE = '/crm/customer'
const POOL = '/crm/customer-pool'

// ---------------------------------------------------------------------------
//  4.3 客户
// ---------------------------------------------------------------------------
export async function getCustomerPage(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(customer, params)
  }
  return request({ url: BASE, method: 'get', params })
}

export async function getCustomerDetail(id) {
  if (USE_MOCK) {
    await delay()
    return findById(customer, id)
  }
  return request({ url: `${BASE}/${id}`, method: 'get' })
}

export async function createCustomer(data) {
  if (USE_MOCK) {
    await delay()
    return insertRow(customer, data)
  }
  return request({ url: BASE, method: 'post', data: splitRegion(data) })
}

export async function updateCustomer(id, data) {
  if (USE_MOCK) {
    await delay()
    return updateById(customer, id, data)
  }
  return request({ url: `${BASE}/${id}`, method: 'put', data: splitRegion(data) })
}

export async function deleteCustomer(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(customer, id)
  }
  return request({ url: `${BASE}/${id}`, method: 'delete' })
}

/**
 * 关注 / 取消关注客户（后端 POST/DELETE /crm/customer/{id}/star）。
 * mock 下无通用 star 表，本地翻转即可，不影响真实分支。
 */
export async function starCustomer(id) {
  if (USE_MOCK) {
    await delay()
    return true
  }
  return request({ url: `${BASE}/${id}/star`, method: 'post' })
}

export async function unstarCustomer(id) {
  if (USE_MOCK) {
    await delay()
    return true
  }
  return request({ url: `${BASE}/${id}/star`, method: 'delete' })
}

/**
 * 销售负责人下拉选项（新增/修改客户、公海分配共用）。
 * 后端返回 SalesOwnerRespVO[]（{ userId, realName, phone, deptName }），非分页。
 * 通用选择器按 { list, total } 取数，这里统一映射成 { id, name } 并包成分页结构，
 * 关键字过滤在前端做（后端简单列表不接受 keyword）。
 *
 * 额外带上 deptId / username / roleName：选择器弹窗现在是左树右表布局，
 * 部门过滤要靠 deptId（子树匹配），表格列是 姓名/编号/角色/联系电话（见
 * selectorRegistry 的 USER_COLUMNS）。真实后端若暂无这些字段则是 undefined，
 * 过滤走 deptName 兜底、列显示「--」。
 */
export async function getCustomerOwnerOptions(params = {}) {
  const mapOwner = (u) => ({
    id: u.userId,
    name: u.realName,
    phone: u.phone,
    deptName: u.deptName,
    deptId: u.deptId,
    username: u.username,
    roleName: u.roleName
  })
  const list = USE_MOCK
    ? user.map((u) => mapOwner({ ...u, userId: u.userId ?? u.id, realName: u.realName ?? u.name }))
    : (await request({ url: `${BASE}/owner-options`, method: 'get' })).map(mapOwner)
  let result = list || []
  const kw = (params?.keyword || '').trim()
  if (kw) {
    result = result.filter((u) =>
      [u.name, u.phone, u.deptName].some((v) => v != null && String(v).includes(kw))
    )
  }
  return { list: result, total: result.length }
}

/**
 * 放入公海
 *
 * 同 leadToPool：mock 下要清负责人并往公海表补一条，否则「公海」页看不到变化。
 */
export async function customerToPool(id, data) {
  if (USE_MOCK) {
    await delay()
    const row = findById(customer, id)
    if (!row) return null

    const reason = data?.reason || data?.reasonRemark || '手动放入'
    const pooled = updateById(customer, id, { ownerName: '' })
    pushOwnerChangeLog({
      bizType: BIZ_TYPE.customer,
      bizId: row.id,
      bizName: row.name,
      action: OWNER_CHANGE_ACTION[3],
      fromOwnerName: row.ownerName,
      toOwnerName: '',
      reasonRemark: reason
    })
    customerPool.unshift({
      ...pooled,
      // ⚠️ 公海行是**自己的记录**，有自己的主键，另用 customerId 指回客户表那一行。
      //    别让池行沿用客户的 id：预置的公海数据 id 也是 1..18，会和客户 id 撞车，
      //    池里出现两行同 id 时 removeById 只删得掉一行，另一行变成删不掉的幽灵。
      id: nextId(customerPool),
      customerId: row.id,
      poolReason: reason,
      poolRemark: '--',
      poolUserName: MOCK_CURRENT_USER,
      poolTime: nowStr()
    })
    return pooled
  }
  // 真实分支：ToPoolReqVO = { reasonCode, reasonRemark }，不再传 { reason }
  return request({ url: `${BASE}/${id}/to-pool`, method: 'post', data })
}

/**
 * 从公海分配
 *
 * 公海的定义是「负责人为空」（《建表文档》3.1），所以分配 = 经 customerId 找到客户表那一行
 * 写上负责人，并把公海这行摘掉。不这么写会弹「分配成功」但两边都不动。
 */
export async function assignCustomerFromPool(id, data) {
  if (USE_MOCK) {
    await delay()
    const poolRow = findById(customerPool, id)
    const ownerName = data?.ownerName || findById(user, data?.ownerUserId)?.name
    if (!ownerName) return null

    if (poolRow?.customerId != null) {
      const target = findById(customer, poolRow.customerId)
      updateById(customer, poolRow.customerId, { ownerName })
      pushOwnerChangeLog({
        bizType: BIZ_TYPE.customer,
        bizId: poolRow.customerId,
        bizName: target?.name,
        action: OWNER_CHANGE_ACTION[1],
        fromOwnerName: target?.ownerName || '',
        toOwnerName: ownerName,
        reasonRemark: data?.reasonRemark || '--'
      })
    }
    removeById(customerPool, id)
    return null
  }
  return request({ url: `${POOL}/${id}/assign`, method: 'post', data })
}

/**
 * 领取（当前用户）
 * ⚠️ 并发场景，失败时后端返回 code 4902「该客户已被他人领取」
 */
export async function claimCustomerFromPool(id) {
  if (USE_MOCK) {
    await delay()
    const poolRow = findById(customerPool, id)
    if (poolRow?.customerId != null) {
      const target = findById(customer, poolRow.customerId)
      updateById(customer, poolRow.customerId, { ownerName: MOCK_CURRENT_USER })
      pushOwnerChangeLog({
        bizType: BIZ_TYPE.customer,
        bizId: poolRow.customerId,
        bizName: target?.name,
        action: OWNER_CHANGE_ACTION[2],
        fromOwnerName: '',
        toOwnerName: MOCK_CURRENT_USER,
        reasonRemark: '公海领取'
      })
    }
    removeById(customerPool, id)
    return null
  }
  return request({ url: `${POOL}/${id}/claim`, method: 'post' })
}

/**
 * 聚合关联数据 —— 客户详情页 10 个 Tab 一次拉取
 *
 * 响应结构见接口文档 4.3：
 * { baseInfo, contacts, invoiceInfo, opportunities, quotations, contracts, payments, invoices, attachments, timeline }
 */
export async function getCustomerRelated(id) {
  if (USE_MOCK) {
    await delay()
    return {
      baseInfo: findById(customer, id) || {},
      // 按客户取，别再用那份共享的假数组
      contacts: contactsByCustomer[id] || [],
      // 开票信息同联系人：按客户取，别再用那份共享的假数组
      invoiceInfo: invoiceInfoByCustomer[id] || [],
      opportunities: [],
      quotations: [],
      contracts: [],
      payments: [],
      invoices: [],
      attachments: []
      // ⚠️ 没有 timeline —— 操作记录不在这个聚合里，走单独接口 GET /crm/owner-change-log
    }
  }
  return request({ url: `${BASE}/${id}/related`, method: 'get' })
}

export async function getCustomerSimpleList(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(customer, params)
  }
  return request({ url: `${BASE}/simple-list`, method: 'get', params })
}

export function exportCustomer(params) {
  if (USE_MOCK) return mockNotImplemented('导出客户')
  return request({ url: `${BASE}/export`, method: 'get', params })
}

// ---------------------------------------------------------------------------
//  4.4 公海
// ---------------------------------------------------------------------------
export async function getCustomerPoolPage(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(customerPool, params)
  }
  return request({ url: POOL, method: 'get', params })
}

export async function deleteCustomerFromPool(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(customerPool, id)
  }
  return request({ url: `${POOL}/${id}`, method: 'delete' })
}

/** 公海导出 */
export function exportCustomerPool(params) {
  if (USE_MOCK) return mockNotImplemented('导出公海')
  return request({ url: `${POOL}/export`, method: 'get', params })
}

/** 公海规则列表（原型「公海规则」页） */
export async function getPoolRuleList(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(poolRule, params)
  }
  return request({ url: '/crm/pool-rule', method: 'get', params })
}

/**
 * 修改公海规则（回收天数、领取上限、提醒天数）
 *
 * ⚠️ mock 下必须真的写回 poolRule 数组：getPoolRuleList 返回的就是这个数组本体，
 *    不写回的话「保存成功」之后表格里的值纹丝不动，而这页只有编辑一个操作，
 *    等于整页不可用。
 */
export async function updatePoolRule(id, data) {
  if (USE_MOCK) {
    await delay()
    return updateById(poolRule, id, data)
  }
  return request({ url: `/crm/pool-rule/${id}`, method: 'put', data })
}

// ---------------------------------------------------------------------------
//  4.8 归属流转记录
// ---------------------------------------------------------------------------
/**
 * 按业务查归属流转流水（客户详情「操作记录」Tab 的数据源）
 *
 * ⚠️ 请求参数文档没给（只写了「按业务查」），这里用 { bizType, bizId }：
 *    bizType 按建表文档取 1 线索 / 2 客户。**接后端时要核对参数名。**
 */
export async function getOwnerChangeLog(params) {
  if (USE_MOCK) {
    await delay()
    return findOwnerChangeLog(params?.bizType, params?.bizId)
  }
  return request({ url: '/crm/owner-change-log', method: 'get', params })
}

// ---------------------------------------------------------------------------
//  4.5 联系人 / 4.7 开票信息
// ---------------------------------------------------------------------------
export async function getContactList(customerId) {
  if (USE_MOCK) {
    await delay()
    return contactsByCustomer[customerId] || []
  }
  return request({ url: '/crm/contact', method: 'get', params: { customerId } })
}

export async function getContactOptions(params = {}) {
  const customerId = params.customerId
  if (!customerId) return { list: [], total: 0 }
  let list = await getContactList(customerId)
  const keyword = (params.keyword || '').trim()
  if (keyword) {
    list = list.filter((row) =>
      [row.name, row.phone, row.title].some((value) => value && String(value).includes(keyword))
    )
  }
  return { list, total: list.length }
}

export async function createContact(data) {
  if (USE_MOCK) {
    await delay()
    const list = contactsByCustomer[data.customerId]
    if (!list) return null
    // id 要全局唯一（联系人在一张表里），所以按拍平后的最大值 +1
    const row = { ...data, id: nextId(allContacts()) }
    // 新增的若是主联系人，得把同客户其它的降下去
    if (row.primary) list.forEach((c) => { c.primary = false })
    list.push(row)
    return row
  }
  return request({ url: '/crm/contact', method: 'post', data })
}

export async function updateContact(id, data) {
  if (USE_MOCK) {
    await delay()
    const found = findContactWithList(id)
    if (!found) return null
    if (data.primary) found.list.forEach((c) => { c.primary = false })
    return updateById(found.list, id, data)
  }
  return request({ url: `/crm/contact/${id}`, method: 'put', data })
}

export async function deleteContact(id) {
  if (USE_MOCK) {
    await delay()
    const found = findContactWithList(id)
    return found ? removeById(found.list, id) : null
  }
  return request({ url: `/crm/contact/${id}`, method: 'delete' })
}

/** 设为主联系人 —— 同一个客户下只能有一个 */
export async function setPrimaryContact(id) {
  if (USE_MOCK) {
    await delay()
    const found = findContactWithList(id)
    if (!found) return null
    found.list.forEach((c) => { c.primary = String(c.id) === String(id) })
    return found.contact
  }
  return request({ url: `/crm/contact/${id}/primary`, method: 'put' })
}

export async function getInvoiceInfo(customerId) {
  if (USE_MOCK) {
    await delay()
    return invoiceInfoByCustomer[customerId] || []
  }
  return request({ url: '/crm/invoice-info', method: 'get', params: { customerId } })
}

export async function saveInvoiceInfo(data) {
  if (USE_MOCK) {
    await delay()
    const { id, ...body } = data
    if (id) {
      const found = findInvoiceInfoWithList(id)
      if (!found) return null
      if (body.isDefault) found.list.forEach((r) => { r.isDefault = false })
      return updateById(found.list, id, body)
    }
    const list = invoiceInfoByCustomer[body.customerId]
    if (!list) return null
    const row = { ...body, id: nextId(allInvoiceInfo()) }
    // 一个客户只能有一条默认
    if (row.isDefault) list.forEach((r) => { r.isDefault = false })
    list.push(row)
    return row
  }
  const { id, ...body } = data
  return id
    ? request({ url: `/crm/invoice-info/${id}`, method: 'put', data: body })
    : request({ url: '/crm/invoice-info', method: 'post', data: body })
}

/** 删除某条开票信息 */
export async function deleteInvoiceInfo(id) {
  if (USE_MOCK) {
    await delay()
    const found = findInvoiceInfoWithList(id)
    return found ? removeById(found.list, id) : null
  }
  return request({ url: `/crm/invoice-info/${id}`, method: 'delete' })
}

/** 设为默认（同一客户下唯一） */
export async function setDefaultInvoiceInfo(id) {
  if (USE_MOCK) {
    await delay()
    const found = findInvoiceInfoWithList(id)
    if (!found) return null
    found.list.forEach((r) => { r.isDefault = String(r.id) === String(id) })
    return found.info
  }
  return request({ url: `/crm/invoice-info/${id}/default`, method: 'put' })
}

// ---------------------------------------------------------------------------
//  mock 明细数据
