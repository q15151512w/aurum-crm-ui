import request from '@/utils/request'
import { USE_MOCK, delay, mockNotImplemented } from './_mock'
import {
  user, role, roleGroup, roleUserIds, deptTree, numberingRule, unit, loginLog, operationLog, dictType, dictData,
  queryPage, findById, removeById,
  insertRow, updateById,
  insertTreeNode, updateTreeNode, removeTreeNode
} from '@/mock/db'

/**
 * 系统管理 —— 对应《05-接口文档.md》第三节
 */

// =============================================================================
//  3.1 用户
// =============================================================================
const USER = '/system/user'

/** 分页查询。参数：deptId / status（1 正常 2 禁用 3 离职）/ keyword */
export async function getUserPage(params) {
  if (USE_MOCK) {
    await delay()
    // mock 的 user 表里没造三态字段（只有 workStatus / accountStatus 文案），
    // 这里把 status 近似映射过去，好让原型的筛选胶囊在 mock 下有结果
    const { status, ...rest } = params || {}
    const byStatus = {
      1: { accountStatus: '已激活' },
      2: { accountStatus: '已禁用' },
      3: { workStatus: '离职' }
    }[status] || {}
    return queryPage(user, { ...rest, ...byStatus })
  }
  return request({ url: USER, method: 'get', params })
}

export async function getUserDetail(id) {
  if (USE_MOCK) {
    await delay()
    return findById(user, id)
  }
  return request({ url: `${USER}/${id}`, method: 'get' })
}

export async function createUser(data) {
  if (USE_MOCK) {
    await delay()
    // 密码字段后端是加密存储、不落 mock，这里剔掉免得明文躺在内存里
    const { password, ...rest } = data
    return insertRow(user, rest)
  }
  return request({ url: USER, method: 'post', data })
}

export async function updateUser(id, data) {
  if (USE_MOCK) {
    await delay()
    // 同上：mock 行里不留密码。表单里「密码留空 = 不修改」由表单配置表达
    const { password, ...rest } = data
    return updateById(user, id, rest)
  }
  return request({ url: `${USER}/${id}`, method: 'put', data })
}

export async function deleteUser(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(user, id)
  }
  return request({ url: `${USER}/${id}`, method: 'delete' })
}

/**
 * 激活 / 禁用 / 操作离职（三态）
 *
 * mock 下必须真的改状态，否则人员页点「激活/禁用/操作离职」弹了成功、
 * 表格里的状态标签却纹丝不动 —— 这一页的三个批量按钮正是如此。
 *
 * 三态落到两个展示字段上（列表列显示的是这两个）：
 *   1 正常 → accountStatus 已激活、workStatus 在职
 *   2 禁用 → accountStatus 已禁用
 *   3 离职 → workStatus 离职
 *
 * @param {number} status 1 正常 / 2 禁用 / 3 离职
 */
export async function changeUserStatus(id, status) {
  if (USE_MOCK) {
    await delay()
    // 激活前必须有角色 —— 「有账号必有角色」的兜底（见《05-接口文档》3.1）。
    // 只 reject、不弹提示：api 层不碰 UI（页面上已经拦过一道，这里纯粹是兜底），
    // 真实后端会返回错误码，由 request.js 统一提示。
    if (Number(status) === 1 && !findById(user, id)?.roleName) {
      return Promise.reject(new Error('[MOCK] 该人员未分配角色，不允许激活'))
    }
    const patch = {
      1: { accountStatus: '已激活', workStatus: '在职' },
      2: { accountStatus: '已禁用' },
      3: { workStatus: '离职' }
    }[Number(status)]
    return patch ? updateById(user, id, patch) : null
  }
  return request({ url: `${USER}/${id}/status`, method: 'put', data: { status } })
}

/** 设置直属上级 */
export async function setUserSuperior(id, superiorId, superiorName) {
  if (USE_MOCK) {
    await delay()
    const name = superiorName || findById(user, superiorId)?.name
    return updateById(user, id, { superiorName: name ?? '' })
  }
  return request({ url: `${USER}/${id}/superior`, method: 'put', data: { superiorId } })
}

/** 重置密码 */
export async function resetUserPassword(id, data) {
  if (USE_MOCK) {
    await delay()
    return null
  }
  return request({ url: `${USER}/${id}/reset-password`, method: 'post', data })
}

/**
 * 人员选择器（系统模块内部用，要求 `system:user:list`）
 *
 * ⚠️ 业务表单的「负责人 / 签约人」下拉**不要**用这个 ——
 *    它要求的权限在种子里只给了超管，销售角色调用会 403。
 *    通用选择器请用 {@link getUserOptions}。
 */
export async function getUserSimpleList(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(user, params)
  }
  const list = await request({ url: `${USER}/simple-list`, method: 'get', params })
  // 后端该接口返回 List<UserSimpleRespVO>，通用选择器统一消费分页结构。
  // 之前直接返回数组，useTable 读取 data.list 得到 undefined，表现为人员选择器永远为空。
  return { list: list || [], total: list?.length || 0 }
}

/**
 * 员工选择器（**仅需登录**，全项目通用的人员下拉）
 *
 * 对应后端 `GET /system/user/options`。与 `getUserSimpleList` 返回同样的字段，
 * 区别只有一个：后端那条不校验 `system:user:list`。
 *
 * 为什么需要它：`selectorRegistry.js` 里的 `userSelector`（负责人 / 直属上级 /
 * 部门负责人 / 客户签约人 / 公司签约人 / 角色成员 共 6 处）原先共用 `/simple-list`，
 * 而那条要求 `system:user:list` —— 只有超管有。销售角色一打开线索/商机/报价单/合同
 * 表单，下拉就 403 加载不出来，表现是「负责人选不了、也回显不出来」。
 *
 * ⚠️⚠️ **必须返回分页结构 `{ list, total }`，不能直接 return 数组。**
 *
 * 调用方是 EntitySelectorDialog，它走 `useTable` —— useTable 取的是
 * `data?.list` / `data?.total`（见 composables/useTable.js）。若返回裸数组，
 * `data.list` 是 undefined，下拉**永远是空的**：负责人既选不了、也回显不出来。
 *
 * 最坑的是它**只在连真后端时才犯**：mock 分支的 `queryPage(...)` 本来就是分页结构，
 * 所以 mock 下一切正常、毫无报错 —— 表现得完全像前端 bug。
 * （`api/customer.js` 的 `getCustomerOwnerOptions` 一直是对的，所以客户表单不受影响，
 *   只有线索/商机/报价单/合同这些用 `userSelector` 的地方中招。）
 *
 * 关键字在前端过滤：这条后端返回的是 List（不是分页对象），不吃 pageNo / keyword。
 * 做法与 `getCustomerOwnerOptions` 保持一致。
 */
export async function getUserOptions(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(user, params)
  }
  const list = (await request({ url: `${USER}/options`, method: 'get' })) || []
  const kw = (params?.keyword || '').trim()
  const result = kw
    ? list.filter((u) =>
        [u.name, u.phone, u.deptName, u.username].some(
          (v) => v != null && String(v).includes(kw)
        )
      )
    : list
  return { list: result, total: result.length }
}

export function exportUser(params) {
  if (USE_MOCK) return mockNotImplemented('导出人员')
  return request({ url: `${USER}/export`, method: 'get', params })
}

export function downloadUserTemplate() {
  if (USE_MOCK) return mockNotImplemented('下载导入模板')
  return request({ url: `${USER}/import-template`, method: 'get', responseType: 'blob' })
}

export function importUser(file) {
  const data = new FormData()
  data.append('file', file)
  return request({
    url: `${USER}/import`,
    method: 'post',
    data,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// =============================================================================
//  3.2 角色与角色组
// =============================================================================
const ROLE = '/system/role'

export async function getRolePage(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(role, params)
  }
  return request({ url: ROLE, method: 'get', params })
}

export async function createRole(data) {
  if (USE_MOCK) {
    await delay()
    // 新建角色还没有人分配，userCount 从 0 起
    return insertRow(role, { userCount: 0, ...data })
  }
  return request({ url: ROLE, method: 'post', data })
}

export async function updateRole(id, data) {
  if (USE_MOCK) {
    await delay()
    return updateById(role, id, data)
  }
  return request({ url: `${ROLE}/${id}`, method: 'put', data })
}

export async function deleteRole(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(role, id)
  }
  return request({ url: `${ROLE}/${id}`, method: 'delete' })
}

/** 查询角色的菜单权限 ID 集合 */
export async function getRolePermissions(id) {
  if (USE_MOCK) {
    await delay()
    return []
  }
  return request({ url: `${ROLE}/${id}/permissions`, method: 'get' })
}

/** 保存权限配置（菜单树勾选）。请求体：{ menuIds: [...] } */
export async function saveRolePermissions(id, menuIds) {
  if (USE_MOCK) {
    await delay()
    return null
  }
  return request({ url: `${ROLE}/${id}/permissions`, method: 'put', data: { menuIds } })
}

/**
 * 角色下的人员列表
 * mock 按 roleUserIds 关联表过滤，否则这页永远显示全部人员，分配/移除都看不出效果
 */
export async function getRoleUsers(id, params) {
  if (USE_MOCK) {
    await delay()
    const assigned = roleUserIds[String(id)] || []
    return queryPage(
      user.filter((u) => assigned.includes(u.id)),
      params
    )
  }
  return request({ url: `${ROLE}/${id}/users`, method: 'get', params })
}

/** 选择角色人员（分配用户到角色） */
export async function assignRoleUsers(id, userIds) {
  if (USE_MOCK) {
    await delay()
    const key = String(id)
    const merged = new Set([...(roleUserIds[key] || []), ...userIds.map(Number)])
    roleUserIds[key] = [...merged]
    // 角色列表的「人数」列跟着变，否则分配完看不出发生了什么
    updateById(role, id, { userCount: merged.size })
    return null
  }
  return request({ url: `${ROLE}/${id}/users`, method: 'post', data: { userIds } })
}

export async function removeRoleUsers(id, userIds) {
  if (USE_MOCK) {
    await delay()
    const key = String(id)
    const removed = new Set(userIds.map(Number))
    roleUserIds[key] = (roleUserIds[key] || []).filter((uid) => !removed.has(uid))
    updateById(role, id, { userCount: roleUserIds[key].length })
    return null
  }
  return request({ url: `${ROLE}/${id}/users`, method: 'delete', data: { userIds } })
}

export async function getRoleGroupList(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(roleGroup, params)
  }
  return request({ url: '/system/role-group', method: 'get', params })
}

export async function createRoleGroup(data) {
  if (USE_MOCK) {
    await delay()
    return insertRow(roleGroup, { roleCount: 0, ...data })
  }
  return request({ url: '/system/role-group', method: 'post', data })
}

export async function deleteRoleGroup(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(roleGroup, id)
  }
  return request({ url: `/system/role-group/${id}`, method: 'delete' })
}

// =============================================================================
//  3.3 部门
// =============================================================================
const DEPT = '/system/dept'

/**
 * 部门树（需要 `system:dept:list`，**只有超管有**）
 *
 * ⚠️ 只给**管理端**用：组织架构页、人员/角色表单里的「上级部门 / 自定义数据范围」选择器。
 *    ⚠️⚠️ **业务表单的选择器不要用它** —— 见下面的 `getDeptOptions()`。
 */
export async function getDeptTree() {
  if (USE_MOCK) {
    await delay()
    return deptTree
  }
  return request({ url: `${DEPT}/tree`, method: 'get' })
}

/**
 * 部门树（**仅需登录**，供选择器弹窗左侧的筛选面板用）
 *
 * 对应后端 `GET /system/dept/options`。与 `getDeptTree` 返回完全相同的数据，
 * 区别只有一个：后端那条不校验 `system:dept:list`。
 *
 * 为什么需要它：`EntitySelectorDialog` 里凡配了 `withDeptTree` 的选择器
 * （负责人 / 直属上级 / 部门负责人 / 客户签约人 / 公司签约人 / 角色成员 **共 6 处**）
 * 每次打开弹窗都会加载左侧组织架构树。而 `system:dept:list` 在种子里
 * **只有超级管理员有** —— 销售角色一打开这些表单就 403。
 *
 * 症状很有迷惑性：`loadDeptTree` 自己 try/catch 降级了，**选择器实际还能用**，
 * 但 `request.js` 会先弹一个权限报错，用户看到的是「选不了负责人」。
 * 这与 `getUserOptions`（BUG-018 的同款修复）是同一个问题的另一条边 ——
 * 那次只修了右侧的人员列表，漏了左侧的树。
 */
export async function getDeptOptions() {
  if (USE_MOCK) {
    await delay()
    return deptTree
  }
  return request({ url: `${DEPT}/options`, method: 'get' })
}

/**
 * 新增部门
 *
 * ⚠️ 部门是树，必须用 insertTreeNode 而不是 insertRow：
 *    树节点靠 parentId 挂到父节点下，塞进平铺数组的话组织架构页根本渲染不出来。
 */
export async function createDept(data) {
  if (USE_MOCK) {
    await delay()
    const { parentId = 0, ...rest } = data
    return insertTreeNode(deptTree, rest, parentId)
  }
  return request({ url: DEPT, method: 'post', data })
}

export async function updateDept(id, data) {
  if (USE_MOCK) {
    await delay()
    return updateTreeNode(deptTree, id, data)
  }
  return request({ url: `${DEPT}/${id}`, method: 'put', data })
}

/**
 * ⚠️ 原先是 `removeById(deptTree, id)` —— 那个函数只扫数组顶层，
 *    删子部门时会静默失败（提示删除成功但节点还在）。改用树的删除。
 */
export async function deleteDept(id) {
  if (USE_MOCK) {
    await delay()
    return removeTreeNode(deptTree, id)
  }
  return request({ url: `${DEPT}/${id}`, method: 'delete' })
}

/**
 * 设置部门负责人
 *
 * mock 下从 user 表反查姓名写回节点的 leaderName —— 组织架构页显示的就是这个字段，
 * 不写回的话会「设置成功」但树上还是旧名字。
 */
export async function setDeptLeader(id, leaderUserId) {
  if (USE_MOCK) {
    await delay()
    const leader = findById(user, leaderUserId)
    return updateTreeNode(deptTree, id, { leaderName: leader?.name ?? '' })
  }
  return request({ url: `${DEPT}/${id}/leader`, method: 'put', data: { leaderUserId } })
}

// =============================================================================
//  3.4 菜单（权限配置用）
// =============================================================================
export async function getMenuTree() {
  if (USE_MOCK) {
    await delay()
    // mock 下直接用菜单树本体，省得再造一份
    const { mockMenus } = await import('@/mock/menu')
    return mockMenus
  }
  return request({ url: '/system/menu/tree', method: 'get' })
}

// =============================================================================
//  3.5 字典
// =============================================================================
export async function getDictTypePage(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(dictType, params)
  }
  return request({ url: '/system/dict-type', method: 'get', params })
}

export async function createDictType(data) {
  if (USE_MOCK) {
    await delay()
    return insertRow(dictType, data)
  }
  return request({ url: '/system/dict-type', method: 'post', data })
}

export async function updateDictType(id, data) {
  if (USE_MOCK) {
    await delay()
    return updateById(dictType, id, data)
  }
  return request({ url: `/system/dict-type/${id}`, method: 'put', data })
}

export async function deleteDictType(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(dictType, id)
  }
  return request({ url: `/system/dict-type/${id}`, method: 'delete' })
}

export async function getDictData(params) {
  if (USE_MOCK) {
    await delay()
    // 按字典类型过滤 —— 字典管理页右边那栏就是按左边选中的 type 取数的
    const rows = (dictData || []).filter((d) => d.type === params?.dictType)
    return queryPage(rows, params)
  }
  return request({ url: '/system/dict-data', method: 'get', params })
}

export async function createDictData(data) {
  if (USE_MOCK) {
    await delay()
    return insertRow(dictData, data)
  }
  return request({ url: '/system/dict-data', method: 'post', data })
}

export async function updateDictData(id, data) {
  if (USE_MOCK) {
    await delay()
    return updateById(dictData, id, data)
  }
  return request({ url: `/system/dict-data/${id}`, method: 'put', data })
}

export async function deleteDictData(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(dictData, id)
  }
  return request({ url: `/system/dict-data/${id}`, method: 'delete' })
}

/**
 * 批量获取多个字典（前端缓存用）。返回 { 字典类型编码: [字典项…] }
 *
 * ⚠️ 调用方是 `composables/useDictOptions.js` 的**后台预热**（路由守卫里发起），
 *    不是用户主动操作。所以走静默模式（两个开关实现在 `utils/request.js` 的 toast()）：
 *      · `silent: true`    失败不弹任何错误提示 —— 否则每次进页面都弹一条
 *                          「服务器繁忙」，用户会以为页面坏了。调用方自己会
 *                          console.error 并用兜底种子照常渲染表单
 *      · `silent401: true` 401 不弹「重新登录」框 —— 同 /auth/me 的探测类请求处理
 */
export async function getDictDataBatch(types) {
  if (USE_MOCK) {
    await delay()
    const out = {}
    for (const t of types || []) {
      // 只出启用项，与后端 dataByTypes 的口径保持一致
      out[t] = (dictData || []).filter((d) => d.type === t && d.status === '正常')
    }
    return out
  }
  return request({
    url: '/system/dict-data/batch',
    method: 'get',
    params: { types: types.join(',') },
    silent: true,
    silent401: true
  })
}

// =============================================================================
//  3.6 基础配置
// =============================================================================
export async function getNumberingRulePage(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(numberingRule, params)
  }
  return request({ url: '/system/numbering-rule', method: 'get', params })
}

export async function createNumberingRule(data) {
  if (USE_MOCK) {
    await delay()
    // currentSeq / currentPeriod 是运行态，新建时由后端从 0 起
    const items = Array.isArray(data?.items)
      ? data.items.map((item, index) => ({ ...item, id: item.id ?? `mock-item-${Date.now()}-${index}`, sort: index }))
      : data?.items
    return insertRow(numberingRule, { currentSeq: 0, ...data, items })
  }
  return request({ url: '/system/numbering-rule', method: 'post', data })
}

export async function updateNumberingRule(id, data) {
  if (USE_MOCK) {
    await delay()
    const items = Array.isArray(data?.items)
      ? data.items.map((item, index) => ({ ...item, id: item.id ?? `mock-item-${Date.now()}-${index}`, sort: index }))
      : data?.items
    return updateById(numberingRule, id, { ...data, items })
  }
  return request({ url: `/system/numbering-rule/${id}`, method: 'put', data })
}

export async function deleteNumberingRule(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(numberingRule, id)
  }
  return request({ url: `/system/numbering-rule/${id}`, method: 'delete' })
}

export async function getUnitPage(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(unit, params)
  }
  return request({ url: '/system/unit', method: 'get', params })
}

export async function createUnit(data) {
  if (USE_MOCK) {
    await delay()
    return insertRow(unit, data)
  }
  return request({ url: '/system/unit', method: 'post', data })
}

export async function updateUnit(id, data) {
  if (USE_MOCK) {
    await delay()
    return updateById(unit, id, data)
  }
  return request({ url: `/system/unit/${id}`, method: 'put', data })
}

export async function deleteUnit(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(unit, id)
  }
  return request({ url: `/system/unit/${id}`, method: 'delete' })
}

/**
 * 计量单位选择器：只返回启用单位
 *
 * 产品表单与明细编辑器的单位下拉读它（见 composables/useUnitOptions.js）——
 * 管理员在「计量单位」页新增了单位，产品那边立刻能选到，
 * 前端不再维护第二份硬编码的单位清单（那正是 2408 的根源）。
 */
export async function getUnitSimpleList(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(unit, params)
  }
  return request({ url: '/system/unit/simple-list', method: 'get', params })
}

export async function getLoginLogPage(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(loginLog, params)
  }
  return request({ url: '/system/login-log', method: 'get', params })
}

/** 登录日志导出 */
export function exportLoginLog(params) {
  if (USE_MOCK) return mockNotImplemented('导出登录日志')
  return request({ url: '/system/login-log/export', method: 'get', params })
}

export async function getOperationLogPage(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(operationLog, params)
  }
  return request({ url: '/system/operation-log', method: 'get', params })
}

export async function getNoticePage(params) {
  if (USE_MOCK) {
    await delay()
    return { list: [], total: 0, pageNo: 1, pageSize: 20 }
  }
  return request({ url: '/system/notice', method: 'get', params })
}

export async function markNoticeRead(id) {
  if (USE_MOCK) {
    await delay()
    return null
  }
  return request({ url: `/system/notice/${id}/read`, method: 'put' })
}

/** 一键全部已读（我的消息） */
export async function markNoticeAllRead() {
  if (USE_MOCK) {
    await delay()
    return null
  }
  return request({ url: '/system/notice/read-all', method: 'put' })
}

/** 未读数（顶栏红点用） */
export async function getNoticeUnreadCount() {
  if (USE_MOCK) {
    await delay()
    return 0
  }
  return request({ url: '/system/notice/unread-count', method: 'get' })
}

// ---------------------------------------------------------------------------
//  公告/通知管理端（管理员）
// ---------------------------------------------------------------------------

export async function getNoticeManagePage(params) {
  if (USE_MOCK) {
    await delay()
    return { list: [], total: 0, pageNo: 1, pageSize: 20 }
  }
  return request({ url: '/system/notice/manage', method: 'get', params })
}

export async function createNotice(data) {
  if (USE_MOCK) return mockNotImplemented('发布公告/通知')
  return request({ url: '/system/notice/manage', method: 'post', data })
}

export async function updateNotice(id, data) {
  if (USE_MOCK) return mockNotImplemented('修改公告/通知')
  return request({ url: `/system/notice/manage/${id}`, method: 'put', data })
}

export async function deleteNotice(id) {
  if (USE_MOCK) return mockNotImplemented('删除公告/通知')
  return request({ url: `/system/notice/manage/${id}`, method: 'delete' })
}

// =============================================================================
//  3.7 附件
// =============================================================================
export async function uploadFile(file, options = {}) {
  if (USE_MOCK) {
    await delay()
    // mock 没有 OSS，用浏览器本地对象 URL 顶上 —— 否则带这个控件的地方
    // （头像就是）选完文件地址是空串，看起来像「上传失败但没报错」。
    // 该 URL 只在当前页面生命周期内有效；Node 环境（npm run check:mock）没有它，所以先探测。
    const canObjectUrl =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
    console.info('[MOCK] 文件上传（未真正上传）：', file?.name)
    return {
      attachmentId: Date.now(),
      fileName: file?.name,
      url: canObjectUrl && file ? URL.createObjectURL(file) : ''
    }
  }
  const data = new FormData()
  data.append('file', file)
  if (options.attachmentType != null) data.append('attachmentType', options.attachmentType)
  if (options.bizType) data.append('bizType', options.bizType)
  if (options.bizId != null) data.append('bizId', options.bizId)
  return request({
    url: '/system/file/upload',
    method: 'post',
    data,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export function downloadFile(id) {
  if (USE_MOCK) return mockNotImplemented('下载附件')
  return request({ url: `/system/file/${id}`, method: 'get', responseType: 'blob' })
}

export async function deleteFile(id) {
  if (USE_MOCK) {
    await delay()
    return null
  }
  return request({ url: `/system/file/${id}`, method: 'delete' })
}
