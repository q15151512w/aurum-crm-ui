<template>
  <pro-list
    ref="listRef"
    title="公海"
    :fetcher="getCustomerPoolPage"
    :columns="columns"
    :filters="FILTERS"
    :toolbar="TOOLBAR"
    :starrable="false"
    search-placeholder="客户名称/负责人"
    @action="onAction"
  >
    <template #filter-right>
      <el-button @click="onExport">导出</el-button>
      <el-button @click="onAdvancedFilter">高级筛选</el-button>
    </template>

    <template #cell-source="{ row }">{{ SOURCE_MAP[row.source] ?? '--' }}</template>
    <template #cell-industry="{ row }">{{ INDUSTRY_MAP[row.industry] ?? '--' }}</template>
    <template #cell-level="{ row }">{{ LEVEL_MAP[row.level] ?? '--' }}</template>
    <template #cell-region="{ row }">{{ dash([row.province, row.city, row.district].filter(Boolean).join('')) }}</template>
    <template #cell-enterPoolReasonCode="{ row }">{{ POOL_REASON_MAP[row.enterPoolReasonCode] ?? '--' }}</template>
  </pro-list>

  <!-- 分配：选人 + 填原因。原来用两个输入框凑，现在通用选择器有了 -->
  <config-form-dialog
    v-model="assignVisible"
    :title="assignTitle"
    :fields="ASSIGN_FIELDS"
    :model="assignForm"
    :submitting="assignSubmitting"
    width="520px"
    @submit="submitAssign"
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
import {
  getCustomerPoolPage,
  assignCustomerFromPool,
  claimCustomerFromPool,
  deleteCustomerFromPool,
  exportCustomerPool
} from '@/api/customer'
import { useFormDialog } from '@/composables/useFormDialog'
import { useDictMap, ensureDictOptions } from '@/composables/useDictOptions'

// 本页用到的字典（预热没跑到或失败过时补一次，正常情况零请求）
ensureDictOptions(['crm_source', 'crm_industry', 'crm_customer_level', 'crm_pool_reason'])

const listRef = ref(null)

/**
 * 码值映射（数据源是 sys_dict_data）
 *
 * ⚠️ 必须是 `useDictMap()` 返回的 computed，不能退回 `Object.fromEntries(...)` 常量。
 */
const SOURCE_MAP = useDictMap('crm_source')
const INDUSTRY_MAP = useDictMap('crm_industry')
const LEVEL_MAP = useDictMap('crm_customer_level')

/**
 * 公海原因（字典 crm_pool_reason，共 5 项）
 *
 * ⚠️ 这里原先是一份**手写的 map，而且内容是错的** —— 写成
 *    「2业务调整 / 3离职转交 / 4其他」，与字典和线索池页都对不上，
 *    还漏了第 5 项「客户失联」。同一张字典在两个页面显示成两套中文。
 *    现在统一走字典，不会再有第二份。
 */
const POOL_REASON_MAP = useDictMap('crm_pool_reason')

/**
 * 表格列
 *
 * prop 必须与 src/mock/db.js 里 customerPool 的字段名一致，
 * 与线索池同构（partyFields + 放入原因/备注/放入人/放入时间）。
 */
const columns = [
  { prop: 'name', label: '客户名称', minWidth: 108, link: true },
  { prop: 'source', label: '客户来源', minWidth: 110 },
  { prop: 'phone', label: '联系电话', minWidth: 117 },
  { prop: 'email', label: '联系邮箱', minWidth: 162 },
  { prop: 'industry', label: '客户行业', minWidth: 94 },
  { prop: 'level', label: '客户级别', minWidth: 94 },
  { prop: 'region', label: '地区', minWidth: 151 },
  { prop: 'enterPoolTime', label: '进入公海时间', minWidth: 150 },
  { prop: 'enterPoolReasonCode', label: '放入原因', minWidth: 108 },
  { prop: 'enterPoolRemark', label: '放入备注', minWidth: 116 }
]

/** 原型上公海没有筛选行，传空数组即可 */
const FILTERS = []

/** 原型工具栏：分配 / 领取 / 删除 */
const TOOLBAR = [
  { key: 'assign', perm: 'crm:customerPool:assign', label: '分配' },
  { key: 'claim', perm: 'crm:customerPool:claim', label: '领取' },
  { key: 'delete', perm: 'crm:customerPool:delete', label: '删除' }
]

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v)

/** 下次联系时间早于今天 → 标红提醒 */
function isOverdue(value) {
  if (!value) return false
  return new Date(value).getTime() < new Date(new Date().toDateString()).getTime()
}

/** 导出公海 —— 后端返回 OSS 下载 URL，弹窗让用户选择是否下载 */
async function onExport() {
  try {
    const url = await exportCustomerPool({ ...listRef.value?.getQuery?.() })
    exportUrl.value = url || ''
    exportName.value = '公海导出'
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

function onAdvancedFilter() {
  ElMessage.info('高级筛选尚未实现')
}

/**
 * 分配
 *
 * 请求体按《05-接口文档.md》4.2：{ ownerUserId, reasonRemark }。
 * 早先是两个 ElMessageBox.prompt 让用户手打「姓名或用户ID」，
 * 那个 ID 拿到后端没法用；现在换成通用选择器，选出来的就是真实的用户 id。
 */
const ASSIGN_FIELDS = [
  {
    prop: 'ownerName',
    label: '负责人',
    type: 'selector',
    selector: 'salesOwner',
    extraProp: 'ownerUserId',
    required: true,
    span: 24
  },
  {
    prop: 'reasonRemark',
    label: '分配原因',
    type: 'textarea',
    required: true,
    span: 24,
    maxlength: 255,
    placeholder: '如：区域调整'
  }
]

const assignTarget = ref(null)
const assignTitle = computed(() =>
  assignTarget.value ? `分配客户：${assignTarget.value.name}` : '分配客户'
)

const {
  visible: assignVisible,
  form: assignForm,
  submitting: assignSubmitting,
  openAdd: openAssign,
  submit: submitAssign
} = useFormDialog({
  label: '分配',
  emptyForm: () => ({ ownerName: '', ownerUserId: null, reasonRemark: '' }),
  create: (payload) => assignCustomerFromPool(assignTarget.value.id, payload),
  onSuccess: () => {
    ElMessage.success('分配成功')
    listRef.value?.reload()
  }
})

function onAssign(row) {
  assignTarget.value = row
  openAssign()
}

/**
 * 领取：并发场景
 *
 * 后端对同一客户的领取只放行一个，其余返回 code 4902「该客户已被他人领取」。
 * request.js 已统一弹出提示，这里 catch 住即可 —— 但必须刷新列表，
 * 否则那条已经被别人领走的数据还留在页面上，用户会反复点。
 */
async function onClaim(row) {
  try {
    await ElMessageBox.confirm(`确定领取客户「${row.name}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }

  try {
    await claimCustomerFromPool(row.id)
    ElMessage.success('领取成功')
  } catch {
    // 已被他人领取等失败：提示已由 request.js 弹出，这里只负责刷新
  }
  listRef.value?.reload()
}

async function onAction({ key, rows, ids, clear }) {
  // 分配 / 领取都只针对单条（接口是 /{id}/assign、/{id}/claim，没有批量入口）
  if (key === 'assign' || key === 'claim') {
    if (rows.length !== 1) return ElMessage.warning('请选择一条记录操作')
    return key === 'assign' ? onAssign(rows[0]) : onClaim(rows[0])
  }

  if (key === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 条公海记录吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await Promise.all(ids.map((id) => deleteCustomerFromPool(id)))
    ElMessage.success('删除成功')
    clear()
    listRef.value?.reload()
  }
}
</script>

<style scoped lang="scss">
.is-overdue {
  color: #e8657a;
}
</style>
