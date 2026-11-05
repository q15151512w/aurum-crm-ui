<template>
  <pro-list
    ref="listRef"
    detail-path="/crm/customer/:id"
    title="客户"
    add-text="新增客户"
    :fetcher="getCustomerPage"
    :columns="columns"
    :filters="FILTERS"
    :toolbar="TOOLBAR"
    search-placeholder="客户名称/负责人/联系电话"
    @add="onAdd"
    @action="onAction"
    @toggle-star="onToggleStar"
  >
    <template #filter-right>
      <el-button @click="onExport">导出</el-button>
      <el-button @click="onAdvancedFilter">高级筛选</el-button>
    </template>

    <!-- 成交状态用标签区分：已成交=绿 -->
    <template #cell-dealStatus="{ row }">
      <el-tag :type="DEAL_STATUS_TAG[row.dealStatus] ?? 'info'" effect="plain" size="small">
        {{ DEAL_STATUS_MAP[row.dealStatus] ?? '--' }}
      </el-tag>
    </template>

    <template #cell-source="{ row }">{{ SOURCE_MAP[row.source] ?? '--' }}</template>
    <template #cell-industry="{ row }">{{ INDUSTRY_MAP[row.industry] ?? '--' }}</template>
    <template #cell-level="{ row }">{{ LEVEL_MAP[row.level] ?? '--' }}</template>

    <!-- 地区由 province/city/district 拼接 -->
    <template #cell-region="{ row }">
      {{ dash(joinRegion(row)) }}
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

  <!-- 高级筛选弹窗：行业/来源/级别/成交状态/创建时间区间 -->
  <el-dialog v-model="filterVisible" title="高级筛选" width="640px" :close-on-click-modal="false">
    <el-form label-width="100px">
      <el-form-item label="客户行业">
        <el-select v-model="filterForm.industry" clearable placeholder="全部" style="width: 100%">
          <el-option v-for="o in dictOptions('crm_industry')" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="客户来源">
        <el-select v-model="filterForm.source" clearable placeholder="全部" style="width: 100%">
          <el-option v-for="o in dictOptions('crm_source')" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="客户级别">
        <el-select v-model="filterForm.level" clearable placeholder="全部" style="width: 100%">
          <el-option v-for="o in dictOptions('crm_customer_level')" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="成交状态">
        <el-select v-model="filterForm.dealStatus" clearable placeholder="全部" style="width: 100%">
          <el-option v-for="o in dictOptions('crm_deal_status')" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="创建时间">
        <el-date-picker
          v-model="filterForm.createTimeRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="onResetFilter">重置</el-button>
      <el-button type="primary" @click="onApplyFilter">确定</el-button>
    </template>
  </el-dialog>

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
  getCustomerPage,
  deleteCustomer,
  customerToPool,
  exportCustomer,
  createCustomer,
  updateCustomer,
  starCustomer,
  unstarCustomer
} from '@/api/customer'
import { useFormDialog } from '@/composables/useFormDialog'
import { dictOptions, useDictMap, ensureDictOptions } from '@/composables/useDictOptions'
// 表单配置与详情页共用一份，别在这里另写
import { FIELDS, emptyForm } from './form-config'

// 本页用到的字典（预热没跑到或失败过时，这里会补一次；正常情况是零请求）
ensureDictOptions(['crm_source', 'crm_industry', 'crm_customer_level', 'crm_deal_status'])

const listRef = ref(null)

/**
 * 码值映射（数据源是 sys_dict_data，见 composables/useDictOptions.js）
 *
 * ⚠️ 必须是 `useDictMap()` 返回的 computed，**不能写成 `Object.fromEntries(...)` 常量** ——
 *    那是一次性快照：首屏渲染时字典还没到，快照就定格在兜底种子上，之后永不更新。
 */
const SOURCE_MAP = useDictMap('crm_source')
const INDUSTRY_MAP = useDictMap('crm_industry')
const LEVEL_MAP = useDictMap('crm_customer_level')
const DEAL_STATUS_MAP = useDictMap('crm_deal_status')

/** 成交状态 → el-tag 类型（对象键会被强制成字符串，数字 / 数字串都命中） */
const DEAL_STATUS_TAG = { 1: 'info', 2: 'success' }

/**
 * 表格列
 *
 * prop 与后端 CustomerRespVO 对齐：名称/来源/电话/邮箱/行业/负责人/级别/下次联系
 * 时间/地区/详细地址/成交状态/创建人/创建时间。
 */
const columns = [
  { prop: 'name', label: '客户名称', minWidth: 108, link: true },
  { prop: 'source', label: '客户来源', minWidth: 100 },
  { prop: 'phone', label: '联系电话', minWidth: 118 },
  { prop: 'email', label: '联系邮箱', minWidth: 150 },
  { prop: 'industry', label: '客户行业', minWidth: 100 },
  { prop: 'ownerName', label: '负责人', minWidth: 88 },
  { prop: 'level', label: '客户级别', minWidth: 100 },
  { prop: 'lastFollowTime', label: '最后跟进时间', minWidth: 122 },
  { prop: 'region', label: '地区', minWidth: 140 },
  { prop: 'dealStatus', label: '成交状态', minWidth: 96 },
  { prop: 'createTime', label: '创建时间', minWidth: 150 }
]

const FILTERS = [
  { label: '全部客户', value: 'all' },
  { label: '我负责的客户', value: 'mine' },
  { label: '下属负责的客户', value: 'subordinate' },
  { label: '我关注的客户', value: 'starred' },
  { label: '已成交客户', value: 'dealt' },
  { label: '未成交客户', value: 'undealt' }
]

const TOOLBAR = [
  { key: 'edit', perm: 'crm:customer:update', label: '编辑' },
  { key: 'delete', perm: 'crm:customer:delete', label: '删除' },
  { key: 'toPool', perm: 'crm:customer:toPool', label: '放入公海' }
]

const { visible, form, title, submitting, openAdd, openEdit, submit } = useFormDialog({
  label: '客户',
  emptyForm,
  create: createCustomer,
  update: updateCustomer,
  onSuccess: (mode) => {
    ElMessage.success(mode === 'add' ? '新增成功' : '修改成功')
    listRef.value?.clearSelection()
    listRef.value?.reload()
  }
})

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v)

/** province/city/district 拼成地区展示 */
function joinRegion(row) {
  const parts = [row.province, row.city, row.district].filter(Boolean)
  return parts.join('')
}

function onAdd() {
  openAdd()
}

// —— 高级筛选（本地弹窗 + 合并进查询参数）——
const filterVisible = ref(false)
const filterForm = ref({ industry: null, source: null, level: null, dealStatus: null, createTimeRange: null })

function onAdvancedFilter() {
  filterVisible.value = true
}

function onResetFilter() {
  filterForm.value = { industry: null, source: null, level: null, dealStatus: null, createTimeRange: null }
}

function onApplyFilter() {
  const f = filterForm.value
  const extra = {
    industry: f.industry ?? null,
    source: f.source ?? null,
    level: f.level ?? null,
    dealStatus: f.dealStatus ?? null,
    createTimeStart: f.createTimeRange?.[0] ? `${f.createTimeRange[0]} 00:00:00` : null,
    createTimeEnd: f.createTimeRange?.[1] ? `${f.createTimeRange[1]} 23:59:59` : null
  }
  listRef.value?.applyQuery(extra)
  filterVisible.value = false
}

/**
 * 关注 / 取消关注
 *
 * ⚠️ 与线索列表同一套做法：**先翻转图标再发请求**（乐观更新），且**不再无条件整表重取**。
 * 原先的「发完请求 → reload()」要打两次请求，而后端连的是远程库（单次往返 ~50ms），
 * 图标得等两次都跑完才变 —— 看起来就是「点了没反应」。
 * 只有「我关注的客户」这个口径下行的**集合**才会随关注态改变，那时才需要重新取数。
 */
async function onToggleStar(row) {
  const wasStarred = row.starred
  const needReload = listRef.value?.getQuery?.().scope === 'starred'

  row.starred = !wasStarred   // 乐观翻转：先给反馈，失败再回滚
  try {
    if (wasStarred) {
      await unstarCustomer(row.id)
    } else {
      await starCustomer(row.id)
    }
    if (needReload) {
      listRef.value?.reload()
    }
  } catch {
    row.starred = wasStarred   // 回滚，别让图标和库里的状态对不上
    // 失败提示由 request.js 统一处理
  }
}

async function onExport() {
  try {
    const q = currentQuery()
    const url = await exportCustomer({ ...q })
    exportUrl.value = url || ''
    exportName.value = exportNameOf(FILTERS, q.scope, '客户')
    exportVisible.value = true
  } catch {
    // 失败提示已由 request.js 统一处理
  }
}

const exportVisible = ref(false)
const exportUrl = ref('')
const exportName = ref('')

/** 下载完成后关闭弹窗并提示（点「下载文件」已触发实际下载） */
function onDownloaded() {
  ElMessage.success('下载完成')
}

/** 拿到当前查询条件（含 scope/keyword/高级筛选），导出与列表口径一致 */
function currentQuery() {
  return listRef.value?.getQuery?.() || {}
}

async function onAction({ key, rows, ids, clear }) {
  if (key === 'edit') {
    if (ids.length !== 1) return ElMessage.warning('请选择一条记录编辑')
    openEdit(rows[0])
    return
  }

  if (key === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 条客户吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await Promise.all(ids.map((id) => deleteCustomer(id)))
    ElMessage.success('删除成功')
    clear()
    listRef.value?.reload()
    return
  }

  if (key === 'toPool') {
    // 放入原因不再强制填写：只确认一次，不再弹输入框。
    try {
      await ElMessageBox.confirm(
        `确定把选中的 ${ids.length} 条客户放入公海吗？放入后负责人将被清空。`,
        '放入公海',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
      // 显式发一个空对象：ToPoolReqVO 的 reasonCode / reasonRemark 都可选，
      // 两者均为 null → 进公海原因记为 NULL。
      // ⚠️ 不要省掉请求体：request.js 默认带 Content-Type: application/json，
      //    POST + 该类型 + 空 body 会被 Spring 判成 415，而不是当成 null 放行。
      await Promise.all(ids.map((id) => customerToPool(id, {})))
    } catch {
      return
    }
    ElMessage.success('已放入公海')
    clear()
    listRef.value?.reload()
  }
}
</script>
