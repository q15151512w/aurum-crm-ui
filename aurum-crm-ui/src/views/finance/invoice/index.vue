<template>
  <pro-list
    ref="listRef"
    detail-path="/finance/invoice/:id"
    title="发票登记"
    add-text="新增发票登记"
    :fetcher="getInvoicePage"
    :columns="columns"
    :filters="FILTERS"
    :toolbar="TOOLBAR"
    search-placeholder="发票申请编号/发票号"
    @add="onAdd"
    @action="onAction"
    @toggle-star="onToggleStar"
  >
    <template #filter-right>
      <el-button @click="onExport">导出</el-button>
      <el-button @click="onAdvancedFilter">高级筛选</el-button>
    </template>

    <!-- 发票状态：开票中黄、已开票绿、财务拒绝红 -->
    <template #cell-status="{ value }">
      <el-tag :type="STATUS_TYPE[value] || 'info'" effect="plain" size="small">
        {{ value || '--' }}
      </el-tag>
    </template>
  </pro-list>

  <!--
    表单弹窗

    ⚠️ 底部三个按钮（取消 / 保存草稿 / 提交审核）是**自己渲染**的，
       所以要把 #footer 插槽整个接管过来。两个提交按钮走同一条
       `submit(action)`，「保存草稿」与「提交审核」的差别只是 action 透传值
       （见 useFormDialog 与下面的 createX 包装）。

    ⚠️ 校验入口用插槽给的 `validate()`，不要自己再拿一个 formRef ——
       两条路径各校验一遍，规则迟早漂移。页面里拿不到 formRef，
       这就是 ConfigFormDialog 要把 validate 暴露出来的原因。
  -->
  <config-form-dialog
    ref="formDialogRef"
    v-model="visible"
    :title="title"
    :fields="FIELDS"
    :model="form"
    :submitting="submitting"
    width="960px"
    label-width="110px"
  >
    <template #footer="{ validate }">
      <div class="dialog-footer">
        <el-button @click="closeForm">取消</el-button>
        <el-button :disabled="submitting" @click="onSaveDraft(validate)">保存草稿</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmitAudit(validate)">
          提交审核
        </el-button>
      </div>
    </template>
  </config-form-dialog>

  <!-- 导出下载弹窗：点「下载文件」才下载，点 X /「稍后再说」只关闭 -->
  <export-download-dialog v-model="exportVisible" :download-url="exportUrl" :filename="exportName" @downloaded="onDownloaded" />
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ProList from '@/components/ProList.vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import ExportDownloadDialog from '@/components/ExportDownloadDialog.vue'
import { exportNameOf } from '@/utils/exportName'
import {
  getInvoicePage,
  getInvoiceDetail,
  deleteInvoice,
  submitInvoice,
  exportInvoice,
  createInvoice,
  updateInvoice,
  getInvoiceCustomerForm,
  starInvoice,
  unstarInvoice,
  voidInvoice
} from '@/api/finance'
import { useFormDialog } from '@/composables/useFormDialog'
import { dictLabel, dictOptions, ensureDictOptions } from '@/composables/useDictOptions'
import { calcInvoiceTotals, formatMoney } from '@/utils/number'

// 预热没跑到或失败过时补一次（正常情况零请求）
ensureDictOptions(['fin_invoice_type'])

const listRef = ref(null)
const formDialogRef = ref(null)

/**
 * 表格列
 *
 * 宽度取自原型「发票登记」页的表头。
 * prop 必须与后端 InvoiceRespVO / mock/db.js 的 invoice 字段一致，否则整列显示 --。
 *
 * ⚠️ 申请编号 applyNo 与实际发票号 invoiceNo 是两个字段：
 *    申请时只有 applyNo，开票后才回填 invoiceNo
 *    （《05-接口文档.md》7.2 特别强调，对应「财务开票」页的 issueInvoice）。
 *
 * ⚠️ 「本次开票金额」显示 totalAmount（含税，= Σ 明细本次开票金额），
 *    不是 amount。amount 是**不含税**金额，两个是不同口径的列
 *    （《02-建表文档》3.6.3：total_amount = amount + tax_amount）。
 */
const columns = [
  { prop: 'applyNo', label: '发票申请编号', minWidth: 188, link: true },
  { prop: 'invoiceNo', label: '发票号', minWidth: 130 },
  { prop: 'customerName', label: '客户名称', minWidth: 127 },
  { prop: 'totalAmount', label: '本次开票金额', minWidth: 158, money: true },
  { prop: 'applyDate', label: '申请开票日期', minWidth: 158 },
  { prop: 'issueDate', label: '开票日期', minWidth: 158 },
  { prop: 'invoiceType', label: '发票类型', minWidth: 127, format: (v) => invoiceTypeLabel(v) },
  { prop: 'ownerName', label: '负责人', minWidth: 140 },
  { prop: 'status', label: '状态', minWidth: 140 },
  { prop: 'remark', label: '备注说明', minWidth: 174 },
  { prop: 'creator', label: '创建人', minWidth: 122 },
  { prop: 'createTime', label: '创建时间', minWidth: 230 }
]

/**
 * 发票类型码 → 中文（列的 format 用）
 *
 * 口径统一在 `dictLabel` 里：未命中返回原值，所以「老数据直接存了中文」的历史行
 * 会原样显示 —— 原先这里手写的那段「中文直通」兼容分支因此可以删掉。
 */
const invoiceTypeLabel = (value) => dictLabel('fin_invoice_type', value)

/** 发票状态 → el-tag 类型 */
const STATUS_TYPE = {
  未提交: 'info',
  开票中: 'warning',
  已开票: 'success',
  已作废: 'danger',
  财务拒绝: 'danger'
}

const FILTERS = [
  { label: '全部发票', value: 'all' },
  { label: '我负责的发票', value: 'mine' },
  { label: '下属负责的发票', value: 'subordinate' },
  { label: '我关注的发票', value: 'starred' },
  { label: '未提交', value: 'draft' },
  { label: '开票中', value: 'issuing' },
  { label: '已开票', value: 'issued' },
  { label: '财务拒绝', value: 'rejected' }
]

/** 原型工具栏：编辑 / 删除 / 提交审核 / 作废 */
const TOOLBAR = [
  { key: 'edit', perm: 'fin:invoice:update', label: '编辑' },
  { key: 'delete', perm: 'fin:invoice:delete', label: '删除' },
  { key: 'submit', perm: 'fin:invoice:submit', label: '提交审核' },
  { key: 'void', perm: 'fin:invoice:void', label: '作废' }
]

/**
 * 新增/编辑表单字段
 *
 * 按原型「新增发票登记」弹窗的顺序排：抬头字段 → 回款信息子表 → 本次总开票金额
 * → 发票信息六项。分区标题用 `type: 'section'`（无 prop，纯装饰）。
 *
 * ⚠️ FIELDS 保持**普通数组**（不要改成 computed）：`npm run check:static` 靠
 *    `const X_FIELDS = [` 这个形状抽取字段块做「type 有没有控件 / selector 有没有注册 /
 *    prop 有没有进 emptyForm」三项检查，换成 computed 会让这些检查**静默跳过**这个文件。
 *
 * ⚠️ 这里**没有 customerId / contractId / 金额**的输入项：客户由所选回款推导、
 *    金额由明细算。所以 submitPayload() 走的是白名单，不是把 form 整个发出去。
 */
const FIELDS = [
  {
    prop: 'applyNo',
    label: '发票申请编号',
    type: 'readonly',
    tip: '保存时由编号规则引擎自动生成'
  },
  {
    prop: 'ownerName',
    label: '负责人',
    type: 'selector',
    selector: 'owner',
    extraProp: 'ownerUserId'
  },
  {
    prop: 'customerName',
    label: '客户名称',
    type: 'selector',
    selector: 'customer',
    extraProp: 'customerId',
    required: true,
    onSelect: (model, row) => onCustomerSelected(model, row)
  },
  {
    prop: 'invoiceType',
    label: '开票类型',
    type: 'select',
    options: () => dictOptions('fin_invoice_type'),
    required: true
  },
  { prop: 'applyDate', label: '开票日期', type: 'date', required: true },
  { prop: 'taxRate', label: '税率(%)', type: 'number', min: 0, max: 100, precision: 2, step: 1 },
  { prop: 'remark', label: '备注说明', type: 'textarea', span: 24, maxlength: 500 },

  // ---- 回款信息（原型的核心：一张票合并多笔回款）----
  { label: '回款信息', type: 'section', span: 24 },
  // 明细行的必填校验在 validateItems() 里单独做（错误信息要带上回款编号，el-form
  // 推导不出来的那种），所以这里不配 required
  { prop: 'items', label: '', type: 'paymentAllocation', span: 24 },
  {
    prop: 'totalAmount',
    label: '本次总开票金额',
    type: 'readonly',
    format: (v) => formatMoney(v),
    tip: '等于上表每行「本次开票金额」之和，随行内金额实时变化',
    compute: (model) => calcInvoiceTotals(model.items || [], model.taxRate).totalAmount
  },
  {
    prop: 'taxAmount',
    label: '税额',
    type: 'readonly',
    format: (v) => formatMoney(v),
    compute: (model) => calcInvoiceTotals(model.items || [], model.taxRate).taxAmount
  },
  {
    prop: 'netAmount',
    label: '不含税金额',
    type: 'readonly',
    format: (v) => formatMoney(v),
    compute: (model) => calcInvoiceTotals(model.items || [], model.taxRate).amount
  },

  // ---- 发票信息（快照，选客户时带出、可改）----
  { label: '发票信息', type: 'section', span: 24 },
  { prop: 'invoiceTitle', label: '发票抬头', type: 'input', span: 12, maxlength: 128 },
  { prop: 'taxNo', label: '纳税人识别号', type: 'input', span: 12, maxlength: 64 },
  { prop: 'bankName', label: '开户行', type: 'input', span: 12, maxlength: 128 },
  { prop: 'bankAccount', label: '开户账号', type: 'input', span: 12, maxlength: 64 },
  { prop: 'invoiceAddr', label: '开户行地址', type: 'input', span: 12, maxlength: 255 },
  { prop: 'invoicePhone', label: '联系电话', type: 'input', span: 12, maxlength: 32 }
]

const { visible, form, title, submitting, openAdd, openEdit, submit } = useFormDialog({
  label: '发票登记',
  width: '960px',
  emptyForm: () => ({
    applyNo: '',
    customerName: '',
    customerId: null,
    ownerName: '',
    ownerUserId: null,
    invoiceType: 1,
    taxRate: 6,
    applyDate: '',
    remark: '',
    items: [],
    totalAmount: 0,
    taxAmount: 0,
    netAmount: 0,
    // 可开票回款候选：由「选客户」写入，供 InvoicePaymentEditor 增删行。
    // 它不在请求体里（见 submitPayload 的白名单），只是表单的运行时状态。
    candidates: [],
    invoiceTitle: '',
    taxNo: '',
    bankName: '',
    bankAccount: '',
    invoiceAddr: '',
    invoicePhone: ''
  }),
  create: (payload, action) => createWithAction(payload, action),
  update: (id, payload, action) => updateWithAction(id, payload, action),
  onSuccess: (mode, action) => {
    ElMessage.success(action === 'audit' ? '已提交审核' : '已保存草稿')
    listRef.value?.clearSelection()
    listRef.value?.reload()
  }
})

/* ------------------------------------------------------------------ *
 * 提交
 *
 * 两条路径发的东西都取自**当前表单** submitPayload()，不用 useFormDialog
 * 透传进来的 payload —— 那个快照里带着 candidates 等运行时字段，而
 * 「哪些字段发给后端」的白名单只该有一处。
 * ------------------------------------------------------------------ */

/**
 * 只挑后端认识的字段
 *
 * ⚠️ 不能用 `{ id, ...payload }` 那种「整份表单发出去」的做法：
 *    form 里还有 customerName / customerId / candidates / totalAmount 等
 *    **后端不接收**的字段（InvoiceSaveReqVO 明确没有 customerId 与任何金额）。
 *    多发的字段 Spring 会忽略，但 `candidates` 是一整个对象数组 ——
 *    白白扩大请求体，还会让人误以为后端认这个字段。白名单最省事也最明确。
 */
function submitPayload() {
  const f = form.value
  return {
    invoiceType: f.invoiceType,
    taxRate: f.taxRate,
    applyDate: f.applyDate,
    remark: f.remark || '',
    items: (f.items || []).map((r) => ({
      paymentId: r.paymentId,
      writeOffAmount: Number(r.writeOffAmount || 0)
    })),
    invoiceTitle: f.invoiceTitle || '',
    taxNo: f.taxNo || '',
    bankName: f.bankName || '',
    bankAccount: f.bankAccount || '',
    invoiceAddr: f.invoiceAddr || '',
    invoicePhone: f.invoicePhone || ''
  }
}

/**
 * 明细的本地校验
 *
 * 后端会拦（3103/3106/3107），但那要等一个往返。这里先挡一道，
 * 让用户立刻看到问题在哪一行 —— 尤其是「某行金额填了 0」这种，
 * 报错信息里带上回款编号比一句「开票金额必须大于 0」有用得多。
 *
 * @returns {string} 错误信息，通过时返回空串
 */
function validateItems() {
  const rows = form.value.items || []
  if (!rows.length) return '请至少选择一笔回款'
  for (const row of rows) {
    const amount = Number(row.writeOffAmount || 0)
    if (!(amount > 0)) return `回款 ${row.paymentNo || row.paymentId} 的本次开票金额必须大于 0`
    if (amount > Number(row.remainingAmount || 0) + 1e-6) {
      const remain = Number(row.remainingAmount || 0)
      return `回款 ${row.paymentNo || row.paymentId} 可开票余额不足，还可开票 ${remain.toFixed(2)} 元`
    }
  }
  return ''
}

/** 先过表单校验与明细校验，把 validate 注入进来是因为它只存在于插槽作用域里 */
async function passValidation(validate) {
  if (!(await validate())) return false
  const msg = validateItems()
  if (msg) {
    ElMessage.warning(msg)
    return false
  }
  return true
}

/** 『保存草稿』：存下来即可，不推进状态 */
async function onSaveDraft(validate) {
  if (!(await passValidation(validate))) return
  await submit('draft')
}

/**
 * 『提交审核』：先存再提
 *
 * ⚠️ 顺序不能反：后端 `POST /{id}/submit` 只改已存在单据的状态，
 *    得先有 id。而 `useFormDialog.submit` 里拿不到 create 的返回值，
 *    所以「存完拿到 id 再提交」只能写在调用方自己的 create/update 包装里
 *    （见 createWithAction / updateWithAction）—— action 透传就是为这件事准备的。
 */
async function onSubmitAudit(validate) {
  if (!(await passValidation(validate))) return
  await submit('audit')
}

/**
 * 新增：[可选] 先保存，再按 action 决定要不要提交审核
 *
 * `useFormDialog.submit` 拿不到这里 return 的 id，所以「先存草稿、再提交」
 * 的串联必须发生在这一层：create 内部做完两件事，外层只看到一个 Promise。
 */
async function createWithAction(payload, action) {
  const id = await createInvoice(submitPayload())
  if (action === 'audit') {
    await submitInvoice(id)
  }
  return id
}

async function updateWithAction(id, payload, action) {
  await updateInvoice(id, submitPayload())
  if (action === 'audit') {
    await submitInvoice(id)
  }
}

/* ------------------------------------------------------------------ *
 * 选客户联动
 * ------------------------------------------------------------------ */

/**
 * 选好客户后一次拿全：默认开票信息 + 该客户的可开票回款
 *
 * 对应原型的黄色标注：「选择客户后，1、显示该客户下所有未全部开票的回款信息。
 * 2、自动带出客户的发票抬头，支持调整」。
 *
 * ⚠️ 选**同一个客户**时不要重新拉取：EntitySelector 的确认按钮可以被重复点，
 *    重拉会把用户刚改过的抬头与行内金额冲掉。只有客户真的变了才拉。
 */
async function onCustomerSelected(model, row) {
  const nextId = row?.id ?? row?.customerId ?? null
  const changed = String(nextId ?? '') !== String(model.customerId ?? '')
  model.customerId = nextId
  model.customerName = row?.name ?? row?.customerName ?? ''
  if (!changed) return
  if (nextId == null) {
    clearCustomerForm(model)
    return
  }
  try {
    // 编辑态传本发票 id：把它自己的占用加回去，被本票占满的回款才不会凭空消失
    const data = await getInvoiceCustomerForm({ customerId: nextId, invoiceId: editingId.value })
    const info = data?.invoiceInfo
    model.invoiceTitle = info?.invoiceTitle ?? ''
    model.taxNo = info?.taxNo ?? ''
    model.bankName = info?.bankName ?? ''
    model.bankAccount = info?.bankAccount ?? ''
    model.invoiceAddr = info?.invoiceAddr ?? ''
    model.invoicePhone = info?.invoicePhone ?? ''
    model.candidates = data?.payments || []
    // 换了客户，旧客户名下的明细行全部作废
    model.items = (data?.payments || []).map(toItemRow)
  } catch {
    // 失败提示已由 request.js 统一处理；把联动结果清空，避免留下上一个客户的数据
    clearCustomerForm(model)
  }
}

function clearCustomerForm(model) {
  model.invoiceTitle = ''
  model.taxNo = ''
  model.bankName = ''
  model.bankAccount = ''
  model.invoiceAddr = ''
  model.invoicePhone = ''
  model.candidates = []
  model.items = []
}

/**
 * 候选回款 → 明细行
 *
 * 金额预填为**可开余额**（原型「带出后支持调整」）。`remainingAmount` 是后端
 * 扣掉他人占用后的余额，编辑态还包含了本票自己的占用 —— 所以编辑时回显的
 * writeOffAmount 会小于等于它，两者都是对的。
 */
function toItemRow(p) {
  return {
    paymentId: p.paymentId,
    paymentNo: p.paymentNo,
    paymentMethodName: p.paymentMethodName,
    paymentDate: p.paymentDate,
    amount: Number(p.amount || 0),
    allocatedAmount: Number(p.allocatedAmount || 0),
    remainingAmount: Number(p.remainingAmount || 0),
    writeOffAmount: Number(p.remainingAmount || 0)
  }
}

/* ------------------------------------------------------------------ *
 * 列表动作
 * ------------------------------------------------------------------ */

const editingId = ref(null)

function onAdd() {
  openAdd()
  editingId.value = null
}

/**
 * 打开编辑
 *
 * 明细不在列表列里，必须取详情（走 getInvoiceDetail）。
 * 取到之后再拉一次候选回款（customer-form 传 invoiceId），
 * 否则用户一打开就看不到「还能再开哪些行」，也没法把移除过的加回来。
 */
async function openEditAndLoad(row) {
  const detail = await getInvoiceDetail(row.id)
  const items = (detail?.allocations || []).map((a) => ({
    paymentId: a.paymentId,
    paymentNo: a.paymentNo,
    paymentMethodName: a.paymentMethodName,
    paymentDate: a.paymentDate,
    amount: Number(a.paymentAmount || 0),
    allocatedAmount: 0,
    remainingAmount: Number(a.paymentAmount || 0),
    writeOffAmount: Number(a.writeOffAmount || 0)
  }))
  openEdit({ ...row, ...detail, items, totalAmount: detail?.totalAmount ?? 0 })
  editingId.value = row.id
  // 拉候选并把本票已开的额度加回去，供「添加回款」使用
  if (detail?.customerId) {
    try {
      const data = await getInvoiceCustomerForm({
        customerId: detail.customerId,
        invoiceId: row.id
      })
      form.value.candidates = data?.payments || []
      // 用带余额的候选覆盖行上的 remainingAmount：上面那批是从明细推的，没有余额信息
      form.value.items = items.map((it) => {
        const c = form.value.candidates.find((x) => String(x.paymentId) === String(it.paymentId))
        return c ? { ...it, remainingAmount: Number(c.remainingAmount || 0) } : it
      })
    } catch {
      form.value.candidates = []
    }
  }
}

function onAdvancedFilter() {
  ElMessage.info('高级筛选尚未实现')
}

async function onExport() {
  try {
    const q = listRef.value?.getQuery?.() || {}
    const url = await exportInvoice({ ...q })
    exportUrl.value = url || ''
    exportName.value = exportNameOf(FILTERS, q.scope, '发票登记')
    exportVisible.value = true
  } catch {
    // 失败提示已由 request.js 统一处理
  }
}

const exportVisible = ref(false)
const exportUrl = ref('')
const exportName = ref('')

function onDownloaded() {
  ElMessage.success('下载完成')
}

/** 关注 / 取消关注（与回款页同款：以服务端为准，刷新而不是就地改） */
async function onToggleStar(row) {
  try {
    if (row.starred) {
      await unstarInvoice(row.id)
    } else {
      await starInvoice(row.id)
    }
    listRef.value?.reload()
  } catch {
    // 失败提示已由 request.js 统一处理
  }
}

function closeForm() {
  formDialogRef.value?.close()
}

async function onAction({ key, rows, ids, clear }) {
  if (key === 'edit') {
    if (ids.length !== 1) return ElMessage.warning('请选择一条记录编辑')
    try {
      await openEditAndLoad(rows[0])
    } catch {
      // 失败提示已由 request.js 统一处理
    }
    return
  }

  if (key === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 条发票吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await Promise.all(ids.map((id) => deleteInvoice(id)))
    ElMessage.success('删除成功')
    clear()
    listRef.value?.reload()
    return
  }

  if (key === 'submit') {
    // 只有「未提交 / 财务拒绝」的单子能提交 —— 与后端 editable() 的口径一致
    const blocked = rows.filter((r) => !['未提交', '财务拒绝'].includes(r.status))
    if (blocked.length) {
      return ElMessage.warning('只有「未提交」或「财务拒绝」的发票可以提交审核')
    }
    try {
      await ElMessageBox.confirm(
        `确定提交选中的 ${ids.length} 条发票申请吗？提交后进入财务开票流程。`,
        '提示',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    await Promise.all(ids.map((id) => submitInvoice(id)))
    ElMessage.success('已提交审核')
    clear()
    listRef.value?.reload()
    return
  }

  if (key === 'void') {
    if (rows.some((r) => r.status !== '已开票')) {
      return ElMessage.warning('只有「已开票」的发票可以作废')
    }
    try {
      await ElMessageBox.confirm(
        `作废后这 ${ids.length} 张发票占用的回款额度会被释放。确定吗？`,
        '作废',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    await Promise.all(ids.map((id) => voidInvoice(id)))
    ElMessage.success('已作废')
    clear()
    listRef.value?.reload()
  }
}
</script>
