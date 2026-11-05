import request from '@/utils/request'
import { USE_MOCK, delay, mockNotImplemented } from './_mock'
import { contract, contractAudit, queryPage, findById, removeById, insertRow, updateById } from '@/mock/db'

/**
 * 合同模块 —— 对应《05-接口文档.md》第六节
 */

const BASE = '/crm/contract'

/**
 * 真实环境里，状态胶囊（未提交/审核中/审核通过/审核拒绝）不是取数口径 scope，
 * 而是审核态过滤条件 auditStatus（0 未提交 / 1 审核中 / 2 审核通过 / 3 审核拒绝）。
 * 后端 applyScope 只认 all / mine / subordinate / starred，传别的会 400，所以这里拆开映射。
 */
const STATUS_SCOPE_TO_AUDIT_STATUS = {
  draft: 0,
  auditing: 1,
  approved: 2,
  rejected: 3
}

function normalizeContractParams(params = {}) {
  const { scope, ...rest } = params
  const auditStatus = STATUS_SCOPE_TO_AUDIT_STATUS[scope]
  if (auditStatus != null) {
    return { ...rest, auditStatus }
  }
  return { ...params }
}

export async function getContractPage(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(contract, params)
  }
  return request({ url: BASE, method: 'get', params: normalizeContractParams(params) })
}

export async function getContractDetail(id) {
  if (USE_MOCK) {
    await delay()
    const row = findById(contract, id)
    return row ? { ...row, products: mockContractProducts() } : null
  }
  return request({ url: `${BASE}/${id}`, method: 'get' })
}

/**
 * 合同审批进度（《05-接口文档.md》第六节「审批进度」）
 *
 * 合同审核期间 `auditStatus` **一直是「审核中」**（流程是两级：部门主管 → 财务），
 * 只有最后一个节点通过才会变成「审核通过」。所以「走到哪一步 / 现在该谁审 / 下一步到谁」
 * 只能从这个接口拿，前端不要自己按角色或上级去猜。
 *
 * 返回：`auditStatus`、`flowName`、`instanceStatus`、`applyUserName/applyTime`、
 * `currentNodeName`、`pendingApproverNames`、`nextNodeName/nextApproverNames`、
 * `abnormalHint`（数据异常时的说明）、`nodes[]`（每节点：进度、已办人、待办人、预计审批人）。
 */
export async function getContractApproval(id) {
  if (USE_MOCK) {
    await delay()
    return mockContractApproval(id)
  }
  return request({ url: `${BASE}/${id}/approval`, method: 'get' })
}

export async function createContract(data) {
  if (USE_MOCK) {
    await delay()
    return insertRow(contract, data)
  }
  return request({ url: BASE, method: 'post', data })
}

export async function updateContract(id, data) {
  if (USE_MOCK) {
    await delay()
    return updateById(contract, id, data)
  }
  return request({ url: `${BASE}/${id}`, method: 'put', data })
}

export async function deleteContract(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(contract, id)
  }
  return request({ url: `${BASE}/${id}`, method: 'delete' })
}

/**
 * 关注 / 取消关注合同（后端 POST / DELETE /crm/contract/{id}/star，幂等）。
 *
 * 与商机/报价单的 starOpportunity / unstarOpportunity 同形，共用后端 StarService +
 * crm_star（biz_type = 5 合同）。mock 下没有关注表，就地改这一行的 starred ——
 * 否则「我关注的合同」胶囊（SCOPE_PREDICATES.starred 读 r.starred）与星标列会立刻变回原样。
 */
export async function starContract(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(contract, id, { starred: true })
  }
  return request({ url: `${BASE}/${id}/star`, method: 'post' })
}

export async function unstarContract(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(contract, id, { starred: false })
  }
  return request({ url: `${BASE}/${id}/star`, method: 'delete' })
}

/** 待审核列表（对应「合同审核」页） */
export async function getContractAuditList(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(contractAudit, params)
  }
  return request({ url: `${BASE}/audit-list`, method: 'get', params })
}

/** 提交审核 ⭐ mock 下把状态推进到「审核中」 */
export async function submitContract(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(contract, id, { auditStatus: '审核中' })
  }
  return request({ url: `${BASE}/${id}/submit`, method: 'post' })
}

/**
 * 待审核行里，真正的合同主键是 contractId（快照行自己的 id 是另一套）
 * mock 审核完要把这一行从待审列表里摘掉，否则审完它还在，看着像没生效
 */
function dropFromAuditList(rows, id) {
  const i = rows.findIndex((r) => String(r.contractId ?? r.id) === String(id))
  if (i > -1) rows.splice(i, 1)
}

/**
 * 审核（通过 / 驳回）
 * @param {Object} data { result: 1 通过 / 2 驳回, comment }
 */
export async function auditContract(id, data) {
  if (USE_MOCK) {
    await delay()
    const row = updateById(contract, id, {
      auditStatus: Number(data?.result) === 2 ? '审核拒绝' : '审核通过'
    })
    dropFromAuditList(contractAudit, id)
    return row
  }
  return request({ url: `${BASE}/${id}/audit`, method: 'post', data })
}

/**
 * 批量审核
 * @param {Object} data { ids, result: 1 通过 / 2 驳回, comment }
 */
export async function batchAuditContract(data) {
  if (USE_MOCK) {
    await delay()
    const ids = data?.ids || []
    const status = Number(data?.result) === 2 ? '审核拒绝' : '审核通过'
    for (const id of ids) {
      updateById(contract, id, { auditStatus: status })
      dropFromAuditList(contractAudit, id)
    }
    return null
  }
  return request({ url: `${BASE}/batch-audit`, method: 'post', data })
}

/** 作废 */
export async function voidContract(id, data) {
  if (USE_MOCK) {
    await delay()
    return null
  }
  return request({ url: `${BASE}/${id}/void`, method: 'post', data })
}

export function exportContract(params) {
  if (USE_MOCK) return mockNotImplemented('导出合同')
  return request({ url: `${BASE}/export`, method: 'get', params })
}

/**
/**
 * mock 模式下没有审批引擎，按固定的两级流造一份，够把时间轴画出来即可。
 * 真实结构见《05-接口文档》第六节（`nodes[].tasks` / `predictedApproverNames` 等）。
 */
const mockContractApproval = (id) => ({
  contractId: id,
  auditStatus: '审核中',
  flowName: '合同审核流',
  instanceStatus: '审批中',
  applyUserName: '张三',
  applyTime: '2026-09-14 20:45:45',
  currentNodeOrder: 2,
  currentNodeName: '财务审批',
  pendingApproverNames: ['赵财务', '陈会计'],
  nodes: [
    {
      nodeOrder: 1,
      nodeName: '部门主管审批',
      approveType: '或签',
      approverType: '发起人直属上级',
      progress: '已通过',
      pendingApproverNames: [],
      predictedApproverNames: [],
      tasks: [
        {
          taskId: 9001,
          approverName: '王总监',
          taskStatus: '已办',
          approveResult: '通过',
          comment: '金额无误',
          handleTime: '2026-09-14 20:46:29',
          createTime: '2026-09-14 20:45:45'
        }
      ]
    },
    {
      nodeOrder: 2,
      nodeName: '财务审批',
      approveType: '或签',
      approverType: '指定角色',
      progress: '待审批',
      pendingApproverNames: ['赵财务', '陈会计'],
      predictedApproverNames: [],
      tasks: [
        { taskId: 9002, approverName: '赵财务', taskStatus: '待办', createTime: '2026-09-14 20:46:29' },
        { taskId: 9003, approverName: '陈会计', taskStatus: '待办', createTime: '2026-09-14 20:46:29' }
      ]
    }
  ]
})

/**
 * 明细行字段与报价单统一（《02-建表文档》3.5，两表明细结构完全一致）。
 * 写成函数，避免明细编辑器就地回写 amount 时串到别的合同上。
 */
const mockContractProducts = () => [
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
