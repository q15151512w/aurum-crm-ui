<template>
  <!--
    财务开票（对应原型「财务开票」页）

    与「发票登记」的区别：没有新增按钮、没有筛选行，
    列里不含状态 / 开票日期 —— 这些是开票动作的结果，开完票才回填。

    两个财务处置动作：确认开票 / 拒绝。它们共用同一个权限点 fin:invoice:issue
    （后端 InvoiceController：拒绝和开票是同一个财务动作，不新增权限点）。
  -->
  <pro-list
    ref="listRef"
    detail-path="/finance/invoice/:id"
    title="财务开票"
    :fetcher="getInvoiceAuditList"
    :columns="columns"
    :filters="[]"
    :searchable="false"
    :toolbar="TOOLBAR"
    @action="onAction"
  >
    <template #filter-right>
      <el-button @click="onExport">导出</el-button>
      <el-button @click="onAdvancedFilter">高级筛选</el-button>
    </template>
  </pro-list>

  <!-- 确认开票：核对只读信息（发票信息 / 回款明细）+ 录入发票号 / 日期 / 资料 -->
  <issue-dialog v-model="issueVisible" :row="issueRow" @success="onIssueSuccess" />

  <!--
    拒绝：录入拒绝原因

    ⚠️ 底部按钮自己渲染，是为了把「二次确认」放在校验之后、提交之前 ——
       确认在 submit() 外，确认期间提交按钮不会进入 loading。校验入口用插槽给的
       validate()，与 ConfigFormDialog 内部共用同一套规则。
  -->
  <config-form-dialog
    v-model="visible"
    :title="rejectTitle"
    :fields="REJECT_FIELDS"
    :model="form"
    :submitting="submitting"
    width="520px"
    label-width="84px"
  >
    <template #footer="{ validate, close }">
      <div class="dialog-footer">
        <el-button :disabled="submitting" @click="close()">取消</el-button>
        <el-button type="danger" :loading="submitting" @click="onReject(validate)">拒绝</el-button>
      </div>
    </template>
  </config-form-dialog>

  <!-- 导出下载弹窗：点「下载文件」才下载，点 X /「稍后再说」只关闭 -->
  <export-download-dialog v-model="exportVisible" :download-url="exportUrl" :filename="exportName" @downloaded="onDownloaded" />
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ProList from '@/components/ProList.vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import ExportDownloadDialog from '@/components/ExportDownloadDialog.vue'
import IssueDialog from './IssueDialog.vue'
import { getInvoiceAuditList, rejectInvoice, exportInvoice } from '@/api/finance'
import { useFormDialog } from '@/composables/useFormDialog'
import { dictLabel, ensureDictOptions } from '@/composables/useDictOptions'

// 预热没跑到或失败过时补一次（正常情况零请求）
ensureDictOptions(['fin_invoice_type'])

const listRef = ref(null)
const issueRow = ref(null)
const rejectRow = ref(null)
const issueVisible = ref(false)

/* ------------------------------------------------------------------ *
 * 拒绝
 * ------------------------------------------------------------------ */

const rejectTitle = computed(() =>
  rejectRow.value ? `拒绝开票：${rejectRow.value.applyNo}` : '拒绝开票'
)

/**
 * 拒绝表单：只有拒绝原因一项（后端 InvoiceRejectReqVO：@NotBlank + @Size(max=500)）。
 * comment 只校验、不落库，所以列表里不会有「拒绝原因」列 —— 见 finance.js 的 rejectInvoice。
 */
const REJECT_FIELDS = [
  {
    prop: 'comment',
    label: '拒绝原因',
    type: 'textarea',
    span: 24,
    maxlength: 500,
    required: true,
    requiredMessage: '拒绝时必须填写拒绝原因'
  }
]

const { visible, form, submitting, openAdd, submit } = useFormDialog({
  label: '拒绝开票',
  emptyForm: () => ({ comment: '' }),
  create: (payload) => rejectInvoice(bizIdOf(rejectRow.value), payload),
  onSuccess: () => {
    ElMessage.success('已拒绝')
    listRef.value?.clearSelection()
    listRef.value?.reload()
  }
})

/**
 * 拒绝：校验 → 二次确认 → 提交
 *
 * 确认取消时直接返回（弹窗保持打开，用户改完可重来）；提交失败由 request.js 统一提示，
 * useFormDialog.submit 会保持弹窗打开、并把 submitting 复位，天然防了重复提交。
 */
async function onReject(validate) {
  if (!(await validate())) return
  try {
    await ElMessageBox.confirm(
      `确定拒绝发票 ${rejectRow.value?.applyNo || ''} 的开票申请吗？`,
      '拒绝开票',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  await submit()
}

function onIssueSuccess() {
  ElMessage.success('开票成功')
  listRef.value?.clearSelection()
  listRef.value?.reload()
}

/* ------------------------------------------------------------------ *
 * 表格列
 * ------------------------------------------------------------------ */

/**
 * 表格列
 *
 * 宽度取自原型「财务开票」页的表头。
 * prop 必须与后端 `GET /finance/invoice/audit-list` 返回的 InvoiceRespVO 字段一致，
 * 否则整列显示 --。
 *
 * ⚠️ 「本次开票金额」取 `totalAmount`（价税合计 = Σ 明细本次开票金额），
 *    **不是** `amount` —— 后者是不含税金额，两个是不同口径的列
 *    （《02-建表文档》3.6.3：total_amount = amount + tax_amount）。
 */
const columns = [
  { prop: 'applyNo', label: '发票申请编号', minWidth: 214, link: true },
  { prop: 'customerName', label: '客户名称', minWidth: 144 },
  { prop: 'totalAmount', label: '本次开票金额', minWidth: 179, money: true },
  { prop: 'applyDate', label: '申请开票日期', minWidth: 179 },
  { prop: 'invoiceType', label: '发票类型', minWidth: 144, format: (v) => invoiceTypeLabel(v) },
  { prop: 'ownerName', label: '负责人', minWidth: 159 },
  { prop: 'remark', label: '备注说明', minWidth: 198 },
  { prop: 'creator', label: '创建人', minWidth: 139 },
  { prop: 'createTime', label: '创建时间', minWidth: 262 }
]

/**
 * 发票类型码 → 中文
 *
 * 后端 `invoiceType` 是 Integer 码值（1 增值税专票 / 2 增值税普票 / 3 电子专票 / 4 电子普票，
 * 见 FinanceDictLabels）。不加这层映射的话列里会直接显示「1」「2」。
 *
 * 与「发票登记」页是同一份口径 —— 那个页面的同名函数内联在 index.vue 里，
 * 这里刻意也内联一份而不是抽公共模块：两页各自的列配置是自洽的，
 * 为一个两行的纯映射引入共享文件不划算。
 */
function invoiceTypeLabel(value) {
  // 口径统一在 dictLabel：未命中返回原值，所以「老数据直接存了中文」的历史行
  // 会原样显示 —— 原先手写的那段「中文直通」兼容分支因此可以删掉。
  return dictLabel('fin_invoice_type', value)
}

/** 原型工具栏：确认开票 / 拒绝 —— 两个动作共用同一个权限点 fin:invoice:issue */
const TOOLBAR = [
  { key: 'issue', perm: 'fin:invoice:issue', label: '确认开票' },
  { key: 'reject', perm: 'fin:invoice:issue', label: '拒绝' }
]

/** 待开票行取自 audit-list，真正的发票主键是 invoiceId（没有时退回 id） */
const bizIdOf = (row) => row.invoiceId ?? row.id

function onAdvancedFilter() {
  ElMessage.info('高级筛选尚未实现')
}

async function onExport() {
  try {
    const url = await exportInvoice({ ...listRef.value?.getQuery?.() })
    exportUrl.value = url || ''
    exportName.value = '财务开票导出'
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

/**
 * 列表批量按钮
 *
 * 确认开票 / 拒绝都是一次只处理一张票（开票要逐张核对发票信息与回款明细），
 * 选中多条时明确提示，不静默只取第一条。
 */
function onAction({ key, rows }) {
  if (key === 'issue') {
    if (rows.length !== 1) return ElMessage.warning('请选择一条记录开票')
    issueRow.value = rows[0]
    issueVisible.value = true
    return
  }

  if (key === 'reject') {
    if (rows.length !== 1) return ElMessage.warning('请选择一条记录拒绝')
    rejectRow.value = rows[0]
    openAdd()
  }
}
</script>
