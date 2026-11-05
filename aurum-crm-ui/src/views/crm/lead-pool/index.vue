<template>
  <pro-list
    ref="listRef"
    title="线索池"
    :fetcher="getLeadPoolPage"
    :columns="columns"
    :filters="FILTERS"
    :toolbar="TOOLBAR"
    :starrable="false"
    search-placeholder="线索名称/负责人"
    @action="onAction"
  >
    <template #filter-right>
      <el-button @click="onExport">导出</el-button>
      <el-button @click="onAdvancedFilter">高级筛选</el-button>
    </template>

    <template #cell-nextContactTime="{ value }">
      <span :class="{ 'is-overdue': isOverdue(value) }">{{ dash(value) }}</span>
    </template>

    <!-- 字典字段：后端返回码值，这里映射成中文（与线索页 / 公海页同一套写法） -->
    <template #cell-source="{ row }">{{ SOURCE_MAP[row.source] ?? '--' }}</template>
    <template #cell-industry="{ row }">{{ INDUSTRY_MAP[row.industry] ?? '--' }}</template>
    <template #cell-level="{ row }">{{ LEVEL_MAP[row.level] ?? '--' }}</template>
    <template #cell-enterPoolReasonCode="{ row }">{{ POOL_REASON_MAP[row.enterPoolReasonCode] ?? '--' }}</template>
  </pro-list>

  <!-- 分配：选人 + 填原因 -->
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
import { useFormDialog } from '@/composables/useFormDialog'
import {
  getLeadPoolPage,
  assignLeadFromPool,
  claimLeadFromPool,
  deleteLeadFromPool,
  exportLeadPool
} from '@/api/lead'
import { useDictMap, ensureDictOptions } from '@/composables/useDictOptions'

// 本页用到的字典（预热没跑到或失败过时补一次，正常情况零请求）
ensureDictOptions(['crm_source', 'crm_industry', 'crm_customer_level', 'crm_pool_reason'])

const listRef = ref(null)

/** 码值映射（数据源是 sys_dict_data；与线索页共用同一套字典） */
const SOURCE_MAP = useDictMap('crm_source')
const INDUSTRY_MAP = useDictMap('crm_industry')
const LEVEL_MAP = useDictMap('crm_customer_level')

/**
 * 进入线索池原因（字典 crm_pool_reason，共 5 项）
 *
 * ⚠️ 这里原先是一份**手写的 map，漏了第 5 项「客户失联」**（后端 DictLabels 当时也漏了，
 *    已一并补上）。客户池那份更离谱，2/3/4 三项的中文完全不同。
 *    现在两页统一走字典，不会再各写一份。
 */
const POOL_REASON_MAP = useDictMap('crm_pool_reason')

/**
 * 表格列
 *
 * ⚠️ prop 必须与后端 {@code LeadRespVO} 对齐，不是 src/mock/db.js 里 leadPool 的字段名。
 * 池相关的四个字段后端叫 enterPoolTime / enterPoolReasonCode / enterPoolRemark /
 * prevOwnerName，早先照 mock 写成了 poolTime / poolReason / poolRemark / poolUserName，
 * 一个都对不上，于是这四列不管放进什么内容都恒显示 --。
 */
const columns = [
  { prop: 'name', label: '线索名称', minWidth: 108, link: true },
  { prop: 'source', label: '线索来源', minWidth: 110 },
  { prop: 'phone', label: '联系电话', minWidth: 117 },
  { prop: 'email', label: '联系邮箱', minWidth: 162 },
  { prop: 'industry', label: '客户行业', minWidth: 94 },
  { prop: 'ownerName', label: '负责人', minWidth: 80 },
  { prop: 'level', label: '客户级别', minWidth: 94 },
  { prop: 'nextContactTime', label: '下次联系时间', minWidth: 129 },
  { prop: 'region', label: '地区', minWidth: 151 },
  { prop: 'address', label: '详细地址', minWidth: 119 },
  { prop: 'enterPoolReasonCode', label: '放入原因', minWidth: 108 },
  { prop: 'enterPoolRemark', label: '放入备注说明', minWidth: 116 },
  { prop: 'prevOwnerName', label: '放入人', minWidth: 80 },
  { prop: 'enterPoolTime', label: '放入时间', minWidth: 150 }
]

/** 原型上线索池没有筛选行，传空数组即可 */
const FILTERS = []

/** 原型工具栏：分配 / 领取 / 删除 */
const TOOLBAR = [
  { key: 'assign', perm: 'crm:leadPool:assign', label: '分配' },
  { key: 'claim', perm: 'crm:leadPool:claim', label: '领取' },
  { key: 'delete', perm: 'crm:leadPool:delete', label: '删除' }
]

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v)

/** 下次联系时间早于今天 → 标红提醒 */
function isOverdue(value) {
  if (!value) return false
  return new Date(value).getTime() < new Date(new Date().toDateString()).getTime()
}

/** 导出线索池 —— 后端返回 OSS 下载 URL，弹窗让用户选择是否下载 */
async function onExport() {
  try {
    const url = await exportLeadPool({ ...listRef.value?.getQuery?.() })
    exportUrl.value = url || ''
    exportName.value = '线索池导出'
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
 * 同公海页：请求体按《05-接口文档.md》4.2 取 { ownerUserId, reasonRemark }，
 * 负责人改用通用选择器选（早先手打的「姓名或用户ID」后端用不了）。
 */
const ASSIGN_FIELDS = [
  {
    prop: 'ownerName',
    label: '负责人',
    type: 'selector',
    selector: 'owner',
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
  assignTarget.value ? `分配线索：${assignTarget.value.name}` : '分配线索'
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
  create: (payload) => assignLeadFromPool(assignTarget.value.id, payload),
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
 * 多个用户同时点领取时，后端只让一个成功，其余返回 code 4902「该线索已被他人领取」。
 * request.js 已经统一弹了错误提示，这里 catch 住即可 —— 但必须刷新列表，
 * 否则那条已经被别人领走的线索还留在页面上，用户会反复点。
 */
async function onClaim(row) {
  try {
    await ElMessageBox.confirm(`确定领取线索「${row.name}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }

  try {
    await claimLeadFromPool(row.id)
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
      await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 条线索池记录吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await Promise.all(ids.map((id) => deleteLeadFromPool(id)))
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
