import request from '@/utils/request'
import { USE_MOCK, delay, mockNotImplemented } from './_mock'
import {
  payment, paymentAudit, invoice, invoicePayment, invoiceInfoByCustomer,
  queryPage, findById, removeById, insertRow, updateById, allocatedOfPayment,
  MOCK_CURRENT_USER
} from '@/mock/db'

/**
 * 财务模块 —— 对应《05-接口文档.md》第七节：7.1 回款 / 7.2 发票 / 7.3 核销
 */

const PAYMENT = '/finance/payment'
const INVOICE = '/finance/invoice'

/**
 * 将页面胶囊的语义值转换为财务接口真正支持的查询字段。
 *
 * ProList 为所有胶囊统一使用 scope 字段，但财务后端只认识 auditStatus/status。
 * 旧实现把 scope=auditing/issued 原样发出，Spring 会忽略未知参数，导致每个按钮
 * 最终执行完全相同的 SQL。
 */
function paymentQuery(params = {}) {
  const query = { ...params }
  const auditStatus = { draft: 0, auditing: 1, approved: 2, rejected: 3 }[query.scope]
  if (auditStatus !== undefined) query.auditStatus = auditStatus
  if (!['mine', 'subordinate', 'starred'].includes(query.scope)) delete query.scope
  return query
}

function invoiceQuery(params = {}) {
  const query = { ...params }
  const auditStatus = { draft: 0, rejected: 3 }[query.scope]
  const status = { issuing: 0, issued: 1 }[query.scope]
  if (auditStatus !== undefined) query.auditStatus = auditStatus
  if (status !== undefined) query.status = status
  if (!['mine', 'subordinate', 'starred'].includes(query.scope)) delete query.scope
  return query
}

function mockPaymentQuery(params = {}) {
  const query = { ...params }
  const status = { draft: '未提交', auditing: '财务审核中', approved: '财务审核通过', rejected: '财务审核拒绝' }[query.scope]
  if (status) query.auditStatus = status
  delete query.status
  // mine / subordinate / starred 是取数口径，交给 queryPage 的 SCOPE_PREDICATES 过滤
  // （starred 读 r.starred、mine/subordinate 读 r.ownerName）；状态胶囊已映射成 auditStatus。
  if (!['mine', 'subordinate', 'starred'].includes(query.scope)) delete query.scope
  return query
}

function mockInvoiceQuery(params = {}) {
  const query = { ...params }
  const status = { draft: '未提交', issuing: '开票中', issued: '已开票', rejected: '财务拒绝' }[query.scope]
  if (status) query.status = status
  delete query.auditStatus
  // mine / subordinate / starred 是取数口径，交给 queryPage 的 SCOPE_PREDICATES 过滤
  // （starred 读 r.starred、mine/subordinate 读 r.ownerName）；状态胶囊已映射成 status。
  if (!['mine', 'subordinate', 'starred'].includes(query.scope)) delete query.scope
  return query
}

// ---------------------------------------------------------------------------
//  7.1 回款
// ---------------------------------------------------------------------------
export async function getPaymentPage(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(payment, mockPaymentQuery(params))
  }
  return request({ url: PAYMENT, method: 'get', params: paymentQuery(params) })
}

export async function getPaymentSimpleList(params = {}) {
  const query = { ...params, auditStatus: 2, status: 1 }
  if (USE_MOCK) {
    await delay()
    return queryPage(payment, { ...mockPaymentQuery(query), auditStatus: '财务审核通过' })
  }
  return request({ url: PAYMENT, method: 'get', params: paymentQuery(query) })
}

export async function getPaymentDetail(id) {
  if (USE_MOCK) {
    await delay()
    return findById(payment, id)
  }
  return request({ url: `${PAYMENT}/${id}`, method: 'get' })
}

export async function createPayment(data) {
  if (USE_MOCK) {
    await delay()
    return insertRow(payment, data)
  }
  return request({ url: PAYMENT, method: 'post', data })
}

export async function updatePayment(id, data) {
  if (USE_MOCK) {
    await delay()
    return updateById(payment, id, data)
  }
  return request({ url: `${PAYMENT}/${id}`, method: 'put', data })
}

export async function deletePayment(id) {
  if (USE_MOCK) {
    await delay()
    return removeById(payment, id)
  }
  return request({ url: `${PAYMENT}/${id}`, method: 'delete' })
}

/**
 * 关注 / 取消关注回款（后端 POST / DELETE /finance/payment/{id}/star，幂等）。
 *
 * mock 下没有关注表，就地改这一行的 starred —— 否则「我关注的回款」胶囊
 * （SCOPE_PREDICATES.starred 读 r.starred）与星标列会立刻变回原样。
 */
export async function starPayment(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(payment, id, { starred: true })
  }
  return request({ url: `${PAYMENT}/${id}/star`, method: 'post' })
}

export async function unstarPayment(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(payment, id, { starred: false })
  }
  return request({ url: `${PAYMENT}/${id}/star`, method: 'delete' })
}

/** 提交审核 —— mock 下把状态推进到「财务审核中」，好让列表能看出变化 */
export async function submitPayment(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(payment, id, { auditStatus: '财务审核中' })
  }
  return request({ url: `${PAYMENT}/${id}/submit`, method: 'post' })
}

/**
 * 财务回款审核
 * @param {Object} data { result: 1 通过 / 2 驳回, comment }
 */
export async function auditPayment(id, data) {
  if (USE_MOCK) {
    await delay()
    const row = updateById(payment, id, {
      auditStatus: Number(data?.result) === 2 ? '财务审核拒绝' : '财务审核通过'
    })
    // 审完从待审列表摘掉，否则它一直挂在「财务审核」页上
    const i = paymentAudit.findIndex((r) => String(r.paymentId ?? r.id) === String(id))
    if (i > -1) paymentAudit.splice(i, 1)
    return row
  }
  return request({ url: `${PAYMENT}/${id}/audit`, method: 'post', data })
}

/** 待审核列表（对应「财务审核」页） */
export async function getPaymentAuditList(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(paymentAudit, params)
  }
  return request({ url: `${PAYMENT}/audit-list`, method: 'get', params })
}

export function exportPayment(params) {
  if (USE_MOCK) return mockNotImplemented('导出回款')
  return request({ url: `${PAYMENT}/export`, method: 'get', params: paymentQuery(params) })
}

// ---------------------------------------------------------------------------
//  7.2 发票
// ---------------------------------------------------------------------------
export async function getInvoicePage(params) {
  if (USE_MOCK) {
    await delay()
    return queryPage(invoice, mockInvoiceQuery(params))
  }
  return request({ url: INVOICE, method: 'get', params: invoiceQuery(params) })
}

/**
 * 详情 —— 带上 allocations（回款明细）
 *
 * ⚠️ 后端 `GET /finance/invoice/{id}` 返回的明细行字段是 `paymentAmount`
 *    （该笔回款总额）与 `writeOffAmount`（本次开票金额），而**不是** `amount`。
 *    表单里那一列要显示「可开余额」，靠的是减掉他人占用后的**剩余额**，
 *    不是回款原额 —— 两者不同名，别顺手改名对齐，会读到一个不存在的字段。
 */
export async function getInvoiceDetail(id) {
  if (USE_MOCK) {
    await delay()
    const row = findById(invoice, id)
    if (!row) return null
    return { ...row, allocations: mockAllocationsOf(id) }
  }
  return request({ url: `${INVOICE}/${id}`, method: 'get' })
}

/** 某张票的明细行，附上回款方的展示字段（与后端 loadAllocations 的补值同款） */
function mockAllocationsOf(invoiceId) {
  return invoicePayment
    .filter((ip) => String(ip.invoiceId) === String(invoiceId))
    .map((ip) => {
      const p = findById(payment, ip.paymentId)
      return {
        id: ip.id,
        paymentId: ip.paymentId,
        paymentNo: p?.paymentNo ?? '',
        paymentMethod: p?.paymentMethod ?? null,
        paymentMethodName: mockPaymentMethodName(p?.paymentMethod),
        paymentDate: p?.paymentDate ?? '',
        paymentAmount: p?.amount ?? 0,
        writeOffAmount: ip.writeOffAmount
      }
    })
}

/**
 * 选客户联动：默认开票信息 + 该客户当下可开票的回款
 *
 * 对应后端 `GET /finance/invoice/customer-form`。两段数据的权限语义不同
 * （候选回款受数据范围约束，开票信息不受），但前端只关心结果。
 *
 * ⚠️ `invoiceId`：编辑态必须传。它把**本发票自己**已占用的额度加回去，
 *    否则一打开编辑，被本票占满的回款就凭空消失了。
 */
export async function getInvoiceCustomerForm(params = {}) {
  const { customerId, invoiceId } = params
  if (USE_MOCK) {
    await delay()
    const cid = Number(customerId)
    const list = dbInvoiceInfoByCustomer(cid)
    const info = list.find((r) => r.isDefault) || list[0] || null
    return {
      invoiceInfo: info
        ? {
            invoiceTitle: info.title,
            taxNo: info.taxNo,
            bankName: info.bankName,
            bankAccount: info.bankAccount,
            invoiceAddr: info.address,
            invoicePhone: info.phone
          }
        : null,
      payments: payment
        .filter((p) => Number(p.customerId) === cid && p.status === 1)
        .map((p) => {
          const allocated = allocatedOfPayment(p.id, invoiceId)
          const remaining = round2(p.amount - allocated)
          return {
            paymentId: p.id,
            paymentNo: p.paymentNo,
            contractId: p.contractId,
            contractNo: p.contractNo,
            contractName: p.contractName,
            paymentMethod: p.paymentMethod,
            paymentMethodName: mockPaymentMethodName(p.paymentMethod),
            paymentDate: p.paymentDate,
            amount: p.amount,
            allocatedAmount: allocated,
            remainingAmount: remaining,
            writeOffAmount: 0
          }
        })
        // 可开余额为 0 的隐藏，与后端 listInvoiceablePayments 的过滤一致
        .filter((r) => r.remainingAmount > 0)
    }
  }
  return request({ url: `${INVOICE}/customer-form`, method: 'get', params })
}

/** mock 下的开票信息按客户分组，直接用 mock/db 的那份映射（不在 api 层重复一份） */
function dbInvoiceInfoByCustomer(cid) {
  return invoiceInfoByCustomer[cid] || []
}

/**
 * 回款方式的展示文本（**仅 mock 分支用**）
 *
 * 口径 = `sys_dict_data.fin_payment_method` = 后端 `FinanceDictLabels.paymentMethod`。
 *
 * ⚠️ 别想着在这里改成 `import { dictLabel } from '@/composables/useDictOptions'` ——
 *    `npm run check:mock` 会把 `src/api/*.js` 拷到临时目录、只重写固定几个 import 别名
 *    （见 scripts/check-api-mock.mjs 的替换表）。引入表外的新别名会让它
 *    以 ERR_MODULE_NOT_FOUND **整体挂掉**（是加载失败，不是断言失败），
 *    而且是「run 起来之前就死」。`@/constants/regions` 当年就是这么踩的。
 *    页面侧走字典，api 层的 mock 分支保留这份常量是对的。
 */
function mockPaymentMethodName(code) {
  return PAYMENT_METHOD_NAME[code] || '--'
}
const PAYMENT_METHOD_NAME = { 1: '银行转账', 2: '现金', 3: '支票', 4: '在线支付', 5: '其他' }

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100
}

/**
 * 从明细推出父单的客户与金额。
 *
 * 请求体里**没有 customerId 也没有金额**（后端 InvoiceSaveReqVO 就是这样）：
 * 客户由所选回款推导，金额由明细汇总。mock 这里必须自己推一遍，
 * 否则新建的发票落库没有 customerId，下次编辑时「选客户带出可开票回款」无从下手。
 */
function deriveFromItems(items) {
  const first = findById(payment, items[0]?.paymentId)
  // 主回款取第一条明细，与后端 applyFields 的 v.setPaymentId(items.get(0).paymentId()) 一致
  return {
    paymentId: first?.id ?? null,
    customerId: first?.customerId ?? null,
    customerName: first?.customerName ?? '',
    totalAmount: round2(items.reduce((s, r) => s + Number(r.writeOffAmount || 0), 0))
  }
}

/** 由税率把含税合计拆成不含税 / 税额（税额取残差，保证三者分位恒等） */
function splitTax(totalAmount, taxRate) {
  const amount = round2(totalAmount / (1 + Number(taxRate || 0) / 100))
  return { amount, taxAmount: round2(totalAmount - amount) }
}

/**
 * 新增发票登记
 *
 * mock 下要**同时写两张表**：父单 invoice 与明细 invoicePayment。
 * 只写父单的话，详情/编辑读到的 allocations 是空的，用户会以为明细没存上。
 * 价税合计由明细汇总 —— 与后端 applyFields 的口径一致，不信任提交上来的金额。
 *
 * @param {string} [action] 'draft' | 'submit'，见 useFormDialog.submit 的透传。
 *   仅用来给 status 一个正确的初值：『保存草稿』= 未提交、『提交审核』= 开票中。
 *   不区分的话新行 status 为空，列表列显示 --，且点任何状态胶囊都查不到它。
 */
export async function createInvoice(data) {
  if (USE_MOCK) {
    await delay()
    const { items = [], ...rest } = data
    const derived = deriveFromItems(items)
    const split = splitTax(derived.totalAmount, rest.taxRate)
    const row = insertRow(invoice, {
      ...rest,
      ...derived,
      ...split,
      // 申请编号由「编号规则引擎」生成（表单里是只读的）——mock 照约定造一个
      applyNo: `KP${20260000 + invoice.length}`,
      invoiceNo: null,
      issueDate: null,
      status: '未提交',
      // 新建的发票没有负责人姓名（请求体里只有 id），用当前登录人兜底 ——
      // 否则列表「负责人」列一路显示 --，看着像字段没存上
      ownerName: rest.ownerName || MOCK_CURRENT_USER
    })
    replaceMockAllocations(row.id, items)
    return row.id
  }
  return request({ url: INVOICE, method: 'post', data })
}

/**
 * 修改发票登记
 *
 * ⚠️ 刻意**不碰 status / applyNo**：与后端 update 一致（它不写这两列）。
 *    在这里顺手把 status 复位成「未提交」会把已经提交过的单据打回草稿。
 */
export async function updateInvoice(id, data) {
  if (USE_MOCK) {
    await delay()
    const { items = [], ...rest } = data
    const derived = deriveFromItems(items)
    const split = splitTax(derived.totalAmount, rest.taxRate)
    const row = updateById(invoice, id, { ...rest, ...derived, ...split })
    // 明细整批重建 —— 与后端 update 里先 delete 再 insert 的做法一致
    replaceMockAllocations(id, items)
    return row
  }
  return request({ url: `${INVOICE}/${id}`, method: 'put', data })
}

/** 把某张票的明细整批重建（先按 invoiceId 清掉旧的，再插新的） */
function replaceMockAllocations(invoiceId, items) {
  for (let i = invoicePayment.length - 1; i >= 0; i--) {
    if (String(invoicePayment[i].invoiceId) === String(invoiceId)) invoicePayment.splice(i, 1)
  }
  for (const item of items) {
    invoicePayment.push({
      id: invoicePayment.length + 1,
      invoiceId: Number(invoiceId),
      paymentId: item.paymentId,
      writeOffAmount: round2(item.writeOffAmount)
    })
  }
}

export async function deleteInvoice(id) {
  if (USE_MOCK) {
    await delay()
    // 明细一并删掉：留着孤儿明细会让「累计已开票」把已删发票继续算进去，
    // 那笔回款的额度就永远放不出来了（与后端 delete 的顺序一致）
    replaceMockAllocations(id, [])
    return removeById(invoice, id)
  }
  return request({ url: `${INVOICE}/${id}`, method: 'delete' })
}

/**
 * 提交审核 —— mock 下推进到「开票中」
 *
 * ⚠️ 后端这一个接口同时写两列：`audit_status = 2`（审批中）与 `status = 0`（待开票）。
 *    mock 只有中文标签，两列都写 —— 「待开票」进不了 mockInvoiceQuery 的状态胶囊，
 *    但「财务开票」页（getInvoiceAuditList）读的就是它，只写 status 会让新单不进去。
 */
export async function submitInvoice(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(invoice, id, { auditStatus: '审批中', status: '开票中' })
  }
  return request({ url: `${INVOICE}/${id}/submit`, method: 'post' })
}

/**
 * 财务开票 ⭐ 回填 invoiceNo
 *
 * ⚠️ 申请编号 applyNo 与实际发票号 invoiceNo 是两个字段：
 *    申请时只有 applyNo，开票后才回填 invoiceNo。
 *
 * @param {Object} data { invoiceNo, issueDate, attachmentIds }
 */
export async function issueInvoice(id, data) {
  if (USE_MOCK) {
    await delay()
    // 开票后回填发票号与开票日期，状态转「已开票」
    return updateById(invoice, id, {
      invoiceNo: data?.invoiceNo,
      issueDate: data?.issueDate,
      status: '已开票'
    })
  }
  return request({ url: `${INVOICE}/${id}/issue`, method: 'post', data })
}

/**
 * 财务拒绝开票
 *
 * 与 issue 共用权限码 fin:invoice:issue —— 后端 InvoiceController 注释：拒绝和开票是
 * 同一个财务动作，不新增权限点。请求体只有 { comment }（@NotBlank + @Size(max=500)）。
 *
 * ⚠️ comment 只校验、不落库：fin_invoice 没有审核意见列，后端 InvoiceServiceImpl#reject
 *    明确只写 audit_status=3（已驳回），status 保持待开票。mock 只有中文标签，
 *    用「财务拒绝」表达这个状态 —— 让「财务开票」页的待开列表把它摘掉，
 *    也让「发票登记」页的「财务拒绝」胶囊能查到它（与 backend reject 的语义一致）。
 *
 * @param {Object} data { comment }
 */
export async function rejectInvoice(id, data) {
  if (USE_MOCK) {
    await delay()
    return updateById(invoice, id, { status: '财务拒绝' })
  }
  return request({ url: `${INVOICE}/${id}/reject`, method: 'post', data })
}

/**
 * 关注 / 取消关注发票
 *
 * 与回款页同款：mock 下就地改这一行的 starred —— 否则「我关注的发票」胶囊
 * 与星标列会立刻变回原样。后端是幂等的 POST / DELETE，重复调也不会翻错。
 */
export async function starInvoice(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(invoice, id, { starred: true })
  }
  return request({ url: `${INVOICE}/${id}/star`, method: 'post' })
}

export async function unstarInvoice(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(invoice, id, { starred: false })
  }
  return request({ url: `${INVOICE}/${id}/star`, method: 'delete' })
}

/**
 * 作废发票
 *
 * ⚠️ mock 下**明细刻意不删**：作废要保留核销轨迹供审计，额度靠
 *    `activeAllocations()` 里的「排除已作废发票」口径释放 —— 与后端
 *    `InvoiceServiceImpl#voidInvoice` 的注释是同一个决定。
 *    在这里删明细虽然也能让额度回来，但会丢掉「这张票当初开了哪些回款」。
 */
export async function voidInvoice(id) {
  if (USE_MOCK) {
    await delay()
    return updateById(invoice, id, { status: '已作废' })
  }
  return request({ url: `${INVOICE}/${id}/void`, method: 'post' })
}

/**
 * 待开票列表（对应「财务开票」页）
 *
 * ⚠️ 从 `invoice` **现算**，不用 db.js 里那份模块加载时就冻结的 `invoiceIssue` 快照。
 *    用快照的话，「发票登记」里新提交的单据永远不会出现在开票页上
 *    （快照是启动那一刻的拷贝），而「提交审核 → 去财务开票」正是主流程 ——
 *    这会让验收的最后一步看起来像后端没实现。
 *
 * 口径与后端 auditPage 一致：audit_status = 2（审批中）且 status = 0（待开票）。
 * mock 只有中文标签，用「开票中」表达这个状态。
 */
export async function getInvoiceAuditList(params) {
  if (USE_MOCK) {
    await delay()
    const pending = invoice.filter((v) => v.status === '开票中')
    return queryPage(pending, params)
  }
  return request({ url: `${INVOICE}/audit-list`, method: 'get', params })
}

export function exportInvoice(params) {
  if (USE_MOCK) return mockNotImplemented('导出发票')
  return request({ url: `${INVOICE}/export`, method: 'get', params: invoiceQuery(params) })
}

// ---------------------------------------------------------------------------
//  7.3 核销
// ---------------------------------------------------------------------------
export async function createWriteOff(data) {
  if (USE_MOCK) {
    await delay()
    return null
  }
  return request({ url: '/finance/write-off', method: 'post', data })
}

export async function getWriteOffList(params) {
  if (USE_MOCK) {
    await delay()
    return { list: [], total: 0, pageNo: 1, pageSize: 20 }
  }
  return request({ url: '/finance/write-off', method: 'get', params })
}
