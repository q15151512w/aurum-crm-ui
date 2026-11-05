<template>
  <pro-list
    ref="listRef"
    detail-path="/finance/payment/:id"
    title="回款登记"
    add-text="新增回款"
    :fetcher="getPaymentPage"
    :columns="columns"
    :filters="FILTERS"
    :toolbar="TOOLBAR"
    search-placeholder="回款编号/客户名称"
    @add="onAdd"
    @action="onAction"
    @toggle-star="onToggleStar"
  >
    <template #filter-right>
      <el-button @click="onExport">导出</el-button>
      <el-button @click="onAdvancedFilter">高级筛选</el-button>
    </template>

    <!-- 回款状态：财务审核中黄、通过绿、拒绝红 -->
    <template #cell-auditStatus="{ row }">
      <el-tag :type="STATUS_TYPE[row.auditStatus] || 'info'" effect="plain" size="small">
        {{ PAYMENT_STATUS[row.auditStatus] || '--' }}
      </el-tag>
    </template>

    <template #cell-paymentMethod="{ value }">{{ PAYMENT_METHOD[value] ?? '--' }}</template>

    <!-- 开票状态：已开票绿、未开票灰、无值直接显示 -- -->
    <template #cell-invoiceStatus="{ value }">
      <el-tag v-if="INVOICE_TYPE[value]" :type="INVOICE_TYPE[value]" effect="plain" size="small">
        {{ value }}
      </el-tag>
      <span v-else>{{ value || '--' }}</span>
    </template>
  </pro-list>

  <config-form-dialog
    v-model="visible"
    :title="title"
    :fields="FIELDS"
    :model="form"
    :submitting="submitting"
    width="720px"
    @submit="submit"
  />

  <!-- 导出下载弹窗：点「下载文件」才下载，点 X /「稍后再说」只关闭 -->
  <export-download-dialog v-model="exportVisible" :download-url="exportUrl" :filename="exportName" @downloaded="onDownloaded" />
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ProList from '@/components/ProList.vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import ExportDownloadDialog from '@/components/ExportDownloadDialog.vue'
import { exportNameOf } from '@/utils/exportName'
import { useUserStore } from '@/store/user'
import {
  getPaymentPage,
  deletePayment,
  submitPayment,
  exportPayment,
  createPayment,
  updatePayment,
  starPayment,
  unstarPayment
} from '@/api/finance'
import { useFormDialog } from '@/composables/useFormDialog'
import { useDictMap, ensureDictOptions } from '@/composables/useDictOptions'
// 表单配置与详情页共用一份，别在这里另写
import { FIELDS, emptyForm } from './form-config'

// 预热没跑到或失败过时补一次（正常情况零请求）
ensureDictOptions(['fin_payment_method'])

const listRef = ref(null)

/**
 * 表格列
 *
 * 顺序与宽度取自原型「回款登记」页的表头。
 * prop 必须与 mock/db.js 的 payment 字段一致，否则整列显示 --。
 */
const columns = [
  { prop: 'paymentNo', label: '回款编号', minWidth: 170, link: true },
  { prop: 'customerName', label: '客户名称', minWidth: 115 },
  { prop: 'amount', label: '本次回款金额', minWidth: 143, money: true },
  { prop: 'unpaidAmount', label: '未回款金额', minWidth: 157, money: true },
  { prop: 'paymentDate', label: '回款日期', minWidth: 143 },
  { prop: 'paymentMethod', label: '回款方式', minWidth: 115 },
  { prop: 'auditStatus', label: '状态', minWidth: 128 },
  { prop: 'invoiceStatus', label: '开票状态', minWidth: 121 },
  { prop: 'remark', label: '备注', minWidth: 157 },
  { prop: 'creator', label: '创建人', minWidth: 110 },
  { prop: 'createTime', label: '创建时间', minWidth: 206 }
]

/** 回款状态 → el-tag 类型 */
const STATUS_TYPE = { 0: 'info', 1: 'warning', 2: 'success', 3: 'danger', 未提交: 'info', 财务审核中: 'warning', 财务审核通过: 'success', 财务审核拒绝: 'danger' }
const PAYMENT_STATUS = { 0: '未提交', 1: '财务审核中', 2: '已确认', 3: '财务审核拒绝', 未提交: '未提交', 财务审核中: '财务审核中', 财务审核通过: '已确认', 财务审核拒绝: '财务审核拒绝' }
/**
 * 回款方式（字典 fin_payment_method）
 *
 * ⚠️ 这里原先是一份**手写的常量 map** —— 同一张字典在项目里有 4 份副本
 *    （本文件、payment/detail.vue、payment/form-config.js 的内联选项、
 *     还有 constants/options.js 里一份内容完全错误的「支付宝/银行转账/微信」）。
 *    现在统一走字典，只有这一个来源。
 */
const PAYMENT_METHOD = useDictMap('fin_payment_method')

/** 开票状态 → el-tag 类型（'--' 不是状态，走纯文本分支） */
const INVOICE_TYPE = {
  已开票: 'success',
  未开票: 'info'
}

/**
 * 筛选项：范围 4 个 + 状态 4 个 + 开票 2 个（原型里最多的一页）。
 *
 * 角色不同、胶囊不同：顶级管理员（admin，data_scope=全部）自己名下没有回款，
 * 「我负责的回款」对 TA 无意义，只保留「下属负责的回款」。其余角色维持默认口径。
 * 后续若要按 data_scope 细分其它角色，在这里扩展 SCOPE_FILTERS 的过滤条件即可。
 */
const SCOPE_FILTERS = [
  { label: '全部回款', value: 'all' },
  { label: '我负责的回款', value: 'mine' },
  { label: '下属负责的回款', value: 'subordinate' },
  { label: '我关注的回款', value: 'starred' }
]
const STATUS_FILTERS = [
  { label: '未提交', value: 'draft' },
  { label: '审核中', value: 'auditing' },
  { label: '审核通过', value: 'approved' },
  { label: '审核拒绝', value: 'rejected' },
  { label: '已开票', value: 'invoiced' },
  { label: '未开票', value: 'notInvoiced' }
]

const userStore = useUserStore()
const FILTERS = computed(() => {
  const scopes = userStore.roles.includes('admin')
    ? SCOPE_FILTERS.filter((f) => f.value !== 'mine')
    : SCOPE_FILTERS
  return [...scopes, ...STATUS_FILTERS]
})

/** 原型工具栏：编辑 / 删除 / 提交审核 */
const TOOLBAR = [
  { key: 'edit', perm: 'fin:payment:update', label: '编辑' },
  { key: 'delete', perm: 'fin:payment:delete', label: '删除' },
  { key: 'submit', perm: 'fin:payment:submit', label: '提交审核' }
]

const { visible, form, title, submitting, openAdd, openEdit, submit } = useFormDialog({
  label: '回款',
  emptyForm,
  create: createPayment,
  update: updatePayment,
  onSuccess: (mode) => {
    ElMessage.success(mode === 'add' ? '新增成功' : '修改成功')
    listRef.value?.clearSelection()
    listRef.value?.reload()
  }
})

function onAdd() {
  openAdd()
}

/**
 * 关注 / 取消关注
 *
 * 与线索列表（views/crm/lead/index.vue#onToggleStar）同一套做法：
 * **先翻转图标再发请求**（乐观更新），且**不再无条件整表重取**。
 * 接口是幂等的 star/unstar 一对（刻意不用 toggle），所以即使 row.starred 过期，
 * 也只会多打一次等价请求，不会把 crm_star 里的记录翻错；失败时回滚图标即可。
 *
 * ⚠️ 别再改回「发完请求 → reload()」：
 *   ① reload() 会重新拉一整页（多一次远程库往返，图标要等两次请求才变，像"点了没反应"）；
 *   ② useTable.reload() 会把 pageNo 归 1 —— 在第 3 页点个星标就被踢回第 1 页。
 * 只有「我关注的回款」口径下行的**集合**才会随关注态改变，那时才需要重新取数。
 */
async function onToggleStar(row) {
  const wasStarred = row.starred
  // 「我关注的回款」口径下，取消关注会让这一行从结果集里消失，必须重新取数；
  // 其余口径星标只影响图标本身，本地翻转就够。
  const needReload = listRef.value?.getQuery?.().scope === 'starred'

  row.starred = !wasStarred   // 乐观翻转：先给反馈，失败再回滚
  try {
    if (wasStarred) {
      await unstarPayment(row.id)
    } else {
      await starPayment(row.id)
    }
    if (needReload) {
      listRef.value?.reload()
    }
  } catch {
    row.starred = wasStarred   // 回滚，别让图标和库里的状态对不上
    // 失败提示已由 request.js 统一处理
  }
}

function onAdvancedFilter() {
  ElMessage.info('高级筛选尚未实现')
}

async function onExport() {
  try {
    const q = listRef.value?.getQuery?.() || {}
    const url = await exportPayment({ ...q })
    exportUrl.value = url || ''
    exportName.value = exportNameOf(FILTERS.value, q.scope, '回款登记')
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

async function onAction({ key, rows, ids, clear }) {
  if (key === 'edit') {
    if (ids.length !== 1) return ElMessage.warning('请选择一条记录编辑')
    openEdit(rows[0])
    return
  }

  if (key === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 条回款吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await Promise.all(ids.map((id) => deletePayment(id)))
    ElMessage.success('删除成功')
    clear()
    listRef.value?.reload()
    return
  }

  if (key === 'submit') {
    try {
      await ElMessageBox.confirm(
        `确定提交选中的 ${ids.length} 条回款进行财务审核吗？提交后不可编辑。`,
        '提示',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    await Promise.all(ids.map((id) => submitPayment(id)))
    ElMessage.success('已提交审核')
    clear()
    listRef.value?.reload()
  }
}
</script>
