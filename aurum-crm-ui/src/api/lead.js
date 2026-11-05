import request from '@/utils/request'
import { USE_MOCK, delay, mockNotImplemented } from './_mock'
import {
  lead, leadPool, customer, user, queryPage, findById, removeById, removeByIds,
  insertRow, updateById, nextId, nowStr, MOCK_CURRENT_USER,
  pushOwnerChangeLog, OWNER_CHANGE_ACTION, BIZ_TYPE
} from '@/mock/db'
import { parseRegion } from '@/constants/regions'

/**
 * 线索模块 —— 对应《05-接口文档.md》4.1 线索 / 4.2 线索池
 */

const BASE = '/crm/lead'
const POOL = '/crm/lead-pool'

/**
 * 把表单里的 region 拼接串拆成后端 province/city/district 三个字段。
 * 表单层只跟「地区」一个字符串打交道，拆分的职责收在这里。
 *
 * 与 `api/customer.js` 的 splitRegion 是同一套做法（后端只有三个独立列，没有 region 列）。
 * 响应方向不用管：后端 `LeadRespVO` 会给一个拼好的 `region` 派生字段，
 * 列表展示与编辑回填都直接用它。
 */
function splitRegion(body) {
  if (body == null) return body
  const path = parseRegion(body.region)
  return { ...body, province: path[0] ?? '', city: path[1] ?? '', district: path[2] ?? '' }
}

/** 4.1 分页查询。参数：leadName / ownerUserId / source / industry / createTimeStart / End / keyword */
export async function getLeadPage(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(lead, params)
  }
  return request({ url: BASE, method: 'get', params })
}

/** 4.1 详情 */
export async function getLeadDetail(id) {
  if (USE_MOCK) {
    await delay()
    return findById(lead, id)
  }
  return request({ url: `${BASE}/${id}`, method: 'get' })
}

/** 4.1 新增 */
export async function createLead(data) {
  if (USE_MOCK) {
    await delay()
    return insertRow(lead, data)
  }
  return request({ url: BASE, method: 'post', data: splitRegion(data) })
}

/** 4.1 修改 */
export async function updateLead(id, data) {
  if (USE_MOCK) {
    await delay()
    return updateById(lead, id, data)
  }
  return request({ url: `${BASE}/${id}`, method: 'put', data: splitRegion(data) })
}

/** 4.1 删除 */
export async function deleteLead(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(lead, id)
  }
  return request({ url: `${BASE}/${id}`, method: 'delete' })
}

/** 4.1 批量删除（路径与单个删除相同，靠请求体传 id 数组） */
export async function batchDeleteLead(ids) {
  if (USE_MOCK) {
    await delay()
    return removeByIds(lead, ids)
  }
  return request({ url: BASE, method: 'delete', data: ids })
}

/**
 * 4.1 放入线索池
 *
 * mock 下要真的动数据，否则「已放入线索池」之后线索池页什么也没有：
 *   1. 清掉负责人 —— 线索池的定义就是 owner_user_id IS NULL
 *      （《建表文档》3.1 特意去掉了 pool_status 字段，不要另造状态）
 *   2. 往线索池表补一条，让「线索池」页真的能看到它
 */
export async function leadToPool(id, data) {
  if (USE_MOCK) {
    await delay()
    const row = findById(lead, id)
    if (!row) return null

    const pooled = updateById(lead, id, { ownerName: '' })
    leadPool.unshift({
      ...pooled,
      // ⚠️ 池行有自己的主键，另用 leadId 指回线索表那一行。
      //    别沿用线索 id —— 预置池数据 id 也是 1..18，会和线索 id 撞车，
      //    删的时候 removeById 只删得掉一行，另一行变成删不掉的幽灵。
      id: nextId(leadPool),
      leadId: row.id,
      poolReason: data?.reasonRemark || data?.reason || '手动放入',
      poolRemark: '--',
      poolUserName: MOCK_CURRENT_USER,
      poolTime: nowStr()
    })
    return pooled
  }
  // 请求体 = ToLeadPoolReqDTO { reasonCode, reasonRemark }。
  // ⚠️ 调用方早先发的是 { reason: '...' }，字段名对不上后端，被静默丢弃 ——
  //    接口照样返回成功，但「放入原因」永远存不进库。
  return request({ url: `${BASE}/${id}/to-pool`, method: 'post', data })
}

/**
 * 关注 / 取消关注线索（后端 POST / DELETE /crm/lead/{id}/star）。
 *
 * 后端那一对端点在 LeadController 上早就有了，缺的是这里 —— 于是列表页的
 * 星标点了没反应（见 ProList 的 toggle-star）。与 api/customer.js 同一套写法：
 * 刻意用幂等的 star/unstar 两个接口而不是 toggle，双击不会把状态翻回去。
 *
 * mock 下没有通用 star 表，直接翻转线索自己的 starred 即可。
 */
export async function starLead(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(lead, id, { starred: true })
  }
  return request({ url: `${BASE}/${id}/star`, method: 'post' })
}

export async function unstarLead(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(lead, id, { starred: false })
  }
  return request({ url: `${BASE}/${id}/star`, method: 'delete' })
}

/**
 * 4.1 线索转客户 ⭐ 主线关键节点
 *
 * mock 下要真的建出客户，否则详情页弹「已转为客户」并跳到客户列表，
 * 列表里却什么都没有 —— 主线上最关键的一步看起来是坏的。
 * 转完在线索上记下 convertedCustomerId，与《建表文档》的线索转化追踪一致。
 */
export async function convertLead(id, data) {
  if (USE_MOCK) {
    await delay()
    const row = findById(lead, id)
    if (!row) return null

    const created = insertRow(customer, {
      name: row.name,
      source: row.source,
      phone: row.phone,
      email: row.email,
      industry: row.industry,
      ownerName: row.ownerName,
      level: row.level,
      nextContactTime: row.nextContactTime,
      region: row.region,
      address: row.address,
      remark: row.remark,
      dealStatus: '未成交'
    })
    updateById(lead, id, { convertedCustomerId: created.id, convertTime: nowStr() })
    // 线索转化也是归属流转的一种（建表文档 action=6）
    pushOwnerChangeLog({
      bizType: BIZ_TYPE.lead,
      bizId: row.id,
      bizName: row.name,
      action: OWNER_CHANGE_ACTION[6],
      fromOwnerName: row.ownerName,
      toOwnerName: row.ownerName,
      reasonRemark: `已转为客户「${created.name}」`
    })
    return created
  }
  return request({ url: `${BASE}/${id}/convert`, method: 'post', data })
}

/**
 * 从线索池分配
 * 同 customerToPool：线索池 = owner_user_id IS NULL，分配就是写回负责人并摘掉池里那行
 */
export async function assignLeadFromPool(id, data) {
  if (USE_MOCK) {
    await delay()
    const poolRow = findById(leadPool, id)
    const ownerName = data?.ownerName || findById(user, data?.ownerUserId)?.name
    if (!ownerName) return null

    if (poolRow?.leadId != null) {
      const target = findById(lead, poolRow.leadId)
      updateById(lead, poolRow.leadId, { ownerName })
      pushOwnerChangeLog({
        bizType: BIZ_TYPE.lead,
        bizId: poolRow.leadId,
        bizName: target?.name,
        action: OWNER_CHANGE_ACTION[1],
        fromOwnerName: target?.ownerName || '',
        toOwnerName: ownerName,
        reasonRemark: data?.reasonRemark || '--'
      })
    }
    removeById(leadPool, id)
    return null
  }
  return request({ url: `${POOL}/${id}/assign`, method: 'post', data })
}

/** 领取（当前用户）。⚠️ 并发场景，失败时后端返回 code 4902 */
export async function claimLeadFromPool(id) {
  if (USE_MOCK) {
    await delay()
    const poolRow = findById(leadPool, id)
    if (poolRow?.leadId != null) {
      const target = findById(lead, poolRow.leadId)
      updateById(lead, poolRow.leadId, { ownerName: MOCK_CURRENT_USER })
      pushOwnerChangeLog({
        bizType: BIZ_TYPE.lead,
        bizId: poolRow.leadId,
        bizName: target?.name,
        action: OWNER_CHANGE_ACTION[2],
        fromOwnerName: '',
        toOwnerName: MOCK_CURRENT_USER,
        reasonRemark: '线索池领取'
      })
    }
    removeById(leadPool, id)
    return null
  }
  return request({ url: `${POOL}/${id}/claim`, method: 'post' })
}

/** 4.1 选择器专用 */
export async function getLeadSimpleList(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(lead, params)
  }
  return request({ url: `${BASE}/simple-list`, method: 'get', params })
}

/** 4.1 导出 */
export function exportLead(params) {
  if (USE_MOCK) return mockNotImplemented('导出线索')
  return request({ url: `${BASE}/export`, method: 'get', params })
}

// ---------------------------------------------------------------------------
//  4.2 线索池
// ---------------------------------------------------------------------------

/** 线索池列表（文档：等同 /crm/lead 查 ownerUserId IS NULL） */
export async function getLeadPoolPage(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(leadPool, params)
  }
  return request({ url: POOL, method: 'get', params })
}

/** 从线索池删除 */
export async function deleteLeadFromPool(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(leadPool, id)
  }
  return request({ url: `${POOL}/${id}`, method: 'delete' })
}

/** 线索池导出 */
export function exportLeadPool(params) {
  if (USE_MOCK) return mockNotImplemented('导出线索池')
  return request({ url: `${POOL}/export`, method: 'get', params })
}
