<template>
  <!--
    财务审核（对应原型「财务回款审核」页）

    与「回款登记」的区别：没有新增按钮、没有筛选行，
    列里不含状态 / 开票状态，只有待审核的回款信息。
  -->
  <pro-list
    ref="listRef"
    title="财务审核"
    :fetcher="getPaymentAuditList"
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

  <config-form-dialog
    v-model="visible"
    :title="auditTitle"
    :fields="AUDIT_FIELDS"
    :model="form"
    :submitting="submitting"
    width="520px"
    label-width="84px"
    @submit="submit"
  />

  <!-- 导出下载弹窗：点「下载文件」才下载，点 X /「稍后再说」只关闭 -->
  <export-download-dialog v-model="exportVisible" :download-url="exportUrl" :filename="exportName" @downloaded="onDownloaded" />
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import ProList from '@/components/ProList.vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import ExportDownloadDialog from '@/components/ExportDownloadDialog.vue'
import { getPaymentAuditList, auditPayment, exportPayment } from '@/api/finance'
import { useFormDialog } from '@/composables/useFormDialog'

const listRef = ref(null)

/** 本次要审核的回款行 */
const auditRow = ref(null)

const auditTitle = computed(() =>
  auditRow.value ? `财务审核：${auditRow.value.paymentNo}` : '财务审核'
)

/**
 * 审核表单
 *
 * 请求体沿用《05-接口文档.md》第六节的审核约定 { result: 1 通过 / 2 驳回, comment }。
 * 驳回必须给理由，所以意见的 required 写成函数 —— 选「通过」时它不拦提交。
 */
const AUDIT_FIELDS = [
  {
    prop: 'result',
    label: '审核结果',
    type: 'radio',
    span: 24,
    required: true,
    options: [
      { label: '审核通过', value: 1 },
      { label: '审核驳回', value: 2 }
    ]
  },
  {
    prop: 'comment',
    label: '审核意见',
    type: 'textarea',
    span: 24,
    maxlength: 500,
    placeholder: '通过时选填；驳回时必填',
    required: (model) => model.result === 2,
    requiredMessage: '驳回时必须填写审核意见'
  }
]

const { visible, form, submitting, openAdd, submit } = useFormDialog({
  label: '财务审核',
  emptyForm: () => ({ result: 1, comment: '' }),
  create: (payload) => auditPayment(bizIdOf(auditRow.value), payload),
  onSuccess: () => {
    ElMessage.success(form.value.result === 2 ? '已驳回' : '审核通过')
    listRef.value?.reload()
  }
})

/**
 * 表格列
 *
 * 宽度取自原型「财务回款审核」页的表头。
 * prop 必须与 mock/db.js 的 paymentAudit 字段一致，否则整列显示 --。
 */
const columns = [
  { prop: 'paymentNo', label: '回款编号', minWidth: 209, link: true },
  { prop: 'customerName', label: '客户', minWidth: 142 },
  { prop: 'amount', label: '本次回款金额', minWidth: 176, money: true },
  { prop: 'unpaidAmount', label: '未回款金额', minWidth: 193, money: true },
  { prop: 'paymentDate', label: '回款日期', minWidth: 176 },
  { prop: 'paymentMethod', label: '回款方式', minWidth: 142 },
  { prop: 'remark', label: '备注', minWidth: 193 },
  { prop: 'creator', label: '创建人', minWidth: 135 },
  { prop: 'createTime', label: '创建时间', minWidth: 252 }
]

/** 原型工具栏：审核 */
const TOOLBAR = [{ key: 'audit', perm: 'fin:payment:audit', label: '审核' }]

/** 待审核行取自 paymentAudit，真正的回款主键是 paymentId（没有时退回 id） */
const bizIdOf = (row) => row.paymentId ?? row.id

function onAdvancedFilter() {
  ElMessage.info('高级筛选尚未实现')
}

async function onExport() {
  try {
    const url = await exportPayment({ ...listRef.value?.getQuery?.() })
    exportUrl.value = url || ''
    exportName.value = '财务审核导出'
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

function onAction({ key, rows }) {
  if (key !== 'audit') return
  if (rows.length !== 1) return ElMessage.warning('请选择一条记录审核')

  auditRow.value = rows[0]
  openAdd()
}
</script>
