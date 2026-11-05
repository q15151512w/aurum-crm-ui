<template>
  <pro-list
    ref="listRef"
    detail-path="/crm/lead/:id"
    title="线索"
    add-text="新增线索"
    :fetcher="getLeadPage"
    :columns="columns"
    :filters="FILTERS"
    :toolbar="TOOLBAR"
    search-placeholder="线索名称/负责人"
    @add="onAdd"
    @action="onAction"
    @toggle-star="onToggleStar"
  >
    <template #filter-right>
      <el-button @click="onExport">导出</el-button>
      <el-button @click="onAdvancedFilter">高级筛选</el-button>
    </template>

    <!-- 字典字段：后端返回码值，这里映射成中文（与客户模块同一套写法） -->
    <template #cell-source="{ row }">{{ SOURCE_MAP[row.source] ?? '--' }}</template>
    <template #cell-industry="{ row }">{{ INDUSTRY_MAP[row.industry] ?? '--' }}</template>
    <template #cell-level="{ row }">{{ LEVEL_MAP[row.level] ?? '--' }}</template>

    <template #cell-nextContactTime="{ value }">
      <span :class="{ 'is-overdue': isOverdue(value) }">{{ dash(value) }}</span>
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
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ProList from '@/components/ProList.vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import ExportDownloadDialog from '@/components/ExportDownloadDialog.vue'
import { exportNameOf } from '@/utils/exportName'
import {
  getLeadPage,
  batchDeleteLead,
  leadToPool,
  exportLead,
  createLead,
  updateLead,
  starLead,
  unstarLead
} from '@/api/lead'
import { useFormDialog } from '@/composables/useFormDialog'
import { useDictMap, ensureDictOptions } from '@/composables/useDictOptions'
// 表单配置与详情页共用一份，别在这里另写
import { FIELDS, emptyForm } from './form-config'

// 本页用到的字典（预热没跑到或失败过时补一次，正常情况零请求）
ensureDictOptions(['crm_source', 'crm_industry', 'crm_customer_level'])

const listRef = ref(null)

/**
 * 码值映射（数据源是 sys_dict_data，见 composables/useDictOptions.js）
 *
 * ⚠️ 必须是 computed（`useDictMap` 返回的就是），不能退回 `Object.fromEntries(...)` 常量 ——
 *    那是一次性快照，首屏字典还没到就定格了，之后永不更新。
 */
const SOURCE_MAP = useDictMap('crm_source')
const INDUSTRY_MAP = useDictMap('crm_industry')
const LEVEL_MAP = useDictMap('crm_customer_level')

/**
 * 表格列
 *
 * prop 与后端 `LeadRespVO` 对齐（`leadName` 而不是 `name`，`id`/`name` 是后端给的别名）。
 * 顺序与宽度取自原型「线索」页的表头。
 */
const columns = [
  { prop: 'leadName', label: '线索名称', minWidth: 108, link: true },
  { prop: 'source', label: '线索来源', minWidth: 110 },
  { prop: 'phone', label: '联系电话', minWidth: 117 },
  { prop: 'email', label: '联系邮箱', minWidth: 162 },
  { prop: 'industry', label: '客户行业', minWidth: 119 },
  { prop: 'ownerName', label: '负责人', minWidth: 80 },
  { prop: 'level', label: '客户级别', minWidth: 119 },
  { prop: 'nextContactTime', label: '下次联系时间', minWidth: 129 },
  { prop: 'region', label: '地区', minWidth: 151 },
  { prop: 'address', label: '详细地址', minWidth: 119 },
  { prop: 'remark', label: '备注说明', minWidth: 99 },
  { prop: 'creator', label: '创建人', minWidth: 80 },
  { prop: 'createTime', label: '创建时间', minWidth: 171 }
]

/** 原型筛选行：全部 / 我负责的 / 下属负责的 / 我关注的 */
const FILTERS = [
  { label: '全部线索', value: 'all' },
  { label: '我负责的线索', value: 'mine' },
  { label: '下属负责的线索', value: 'subordinate' },
  { label: '我关注的线索', value: 'starred' }
]

/** 原型工具栏：编辑 / 删除 / 放入线索池 */
const TOOLBAR = [
  { key: 'edit', perm: 'crm:lead:update', label: '编辑' },
  { key: 'delete', perm: 'crm:lead:delete', label: '删除' },
  { key: 'toPool', perm: 'crm:lead:toPool', label: '放入线索池' }
]

const { visible, form, title, submitting, openAdd, openEdit, submit } = useFormDialog({
  label: '线索',
  emptyForm,
  create: createLead,
  update: updateLead,
  onSuccess: (mode) => {
    ElMessage.success(mode === 'add' ? '新增成功' : '修改成功')
    listRef.value?.clearSelection()
    listRef.value?.reload()
  }
})

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v)

/** 下次联系时间早于今天 → 标红提醒 */
function isOverdue(value) {
  if (!value) return false
  return new Date(value).getTime() < new Date(new Date().toDateString()).getTime()
}

function onAdd() {
  openAdd()
}

function onAdvancedFilter() {
  ElMessage.info('高级筛选尚未实现')
}

async function onExport() {
  try {
    const q = listRef.value?.getQuery?.() || {}
    const url = await exportLead({ ...q })
    exportUrl.value = url || ''
    exportName.value = exportNameOf(FILTERS, q.scope, '线索')
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
 * 关注 / 取消关注
 *
 * ProList 只负责把星标点击 emit 出来（见 ProList#toggleStar），
 * 不接这个监听，图标就是个点了没反应的死控件。客户列表同理（onToggleStar）。
 * 接口是幂等的 star/unstar 一对，按当前 starred 走哪个。
 *
 * ⚠️ 这里**先翻转图标再发请求**（乐观更新），且**不再无条件整表重取**。
 * 原先的写法是「发完请求 → reload()」，而 reload 会重新拉一整页
 * （列表一次要打 5 条 SQL + 若干次 Redis，见后端 LeadServiceImpl#toPageResult）。
 * 后端连的是远程库，单次往返 ~50ms，于是点一下要等两次请求才看到图标变化 ——
 * 看起来就是「点了没反应」。
 *
 * 现在：一次点击 = 一个请求，图标立刻响应；只有「我关注的线索」这个口径下
 * 行的**集合**才会随关注态改变，那时才需要重新取数。
 */
async function onToggleStar(row) {
  const wasStarred = row.starred
  // 「我关注的线索」口径下，取消关注会让这一行从结果集里消失，必须重新取数；
  // 其余口径星标只影响图标本身，本地翻转就够。
  const needReload = listRef.value?.getQuery?.().scope === 'starred'

  row.starred = !wasStarred   // 乐观翻转：先给反馈，失败再回滚
  try {
    if (wasStarred) {
      await unstarLead(row.id)
    } else {
      await starLead(row.id)
    }
    if (needReload) {
      listRef.value?.reload()
    }
  } catch {
    row.starred = wasStarred   // 回滚，别让图标和库里的状态对不上
    // 失败提示由 request.js 统一处理
  }
}

async function onAction({ key, rows, ids, clear }) {
  if (key === 'edit') {
    if (ids.length !== 1) return ElMessage.warning('请选择一条记录编辑')
    openEdit(rows[0])
    return
  }

  if (key === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 条线索吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await batchDeleteLead(ids)
    ElMessage.success('删除成功')
    clear()
    listRef.value?.reload()
    return
  }

  if (key === 'toPool') {
    // 放入原因不再强制填写：这里只确认一次，不再弹输入框。
    try {
      await ElMessageBox.confirm(
        `确定把选中的 ${ids.length} 条线索放入线索池吗？`,
        '放入线索池',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
      // 显式发一个空对象：ToLeadPoolReqDTO 的 reasonCode / reasonRemark 都可选，
      // 两者均为 null → 进池原因记为 NULL。
      // ⚠️ 不要省掉请求体：request.js 默认带 Content-Type: application/json，
      //    POST + 该类型 + 空 body 会被 Spring 判成 415，而不是当成 null 放行。
      await Promise.all(ids.map((id) => leadToPool(id, {})))
    } catch {
      // 用户取消，或接口失败（失败提示已由 request.js 统一处理）
      return
    }
    ElMessage.success('已放入线索池')
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
