<template>
  <pro-list
    ref="listRef"
    detail-path="/crm/opportunity/:id"
    title="商机"
    add-text="新增商机"
    :fetcher="getOpportunityPage"
    :columns="columns"
    :filters="FILTERS"
    :toolbar="TOOLBAR"
    search-placeholder="商机名称/负责人"
    @add="onAdd"
    @action="onAction"
    @toggle-star="onToggleStar"
  >
    <!-- 商机阶段用标签区分，颜色随阶段推进由浅到深 -->
    <template #cell-stage="{ value }">
      <el-tag :type="STAGE_TAG[value] || 'info'" effect="plain" size="small">
        {{ value }}
      </el-tag>
    </template>

    <!-- 整单折扣：库里存的是数字（如 15），原型上表头带 %，单元格显示成 15% -->
    <template #cell-discount="{ value }">
      {{ value === null || value === undefined || value === '' ? '--' : `${value}%` }}
    </template>

    <template #filter-right>
      <el-button @click="onExport">导出</el-button>
      <el-button @click="onAdvancedFilter">高级筛选</el-button>
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
  getOpportunityPage,
  deleteOpportunity,
  exportOpportunity,
  createOpportunity,
  updateOpportunity,
  starOpportunity,
  unstarOpportunity
} from '@/api/opportunity'
import { useFormDialog } from '@/composables/useFormDialog'
// 表单配置与详情页共用一份，别在这里另写
import { FIELDS, emptyForm } from './form-config'

const listRef = ref(null)

/**
 * 表格列
 *
 * 顺序与宽度取自原型「商机」页的表头（按元件绝对坐标的 left 升序提取）。
 * 一律用 minWidth，让表格自适应内容区宽度。
 */
const columns = [
  { prop: 'name', label: '商机名称', minWidth: 116, link: true },
  { prop: 'customerName', label: '客户', minWidth: 119 },
  { prop: 'ownerName', label: '负责人', minWidth: 126 },
  { prop: 'expectDealTime', label: '预计成交时间', minWidth: 144 },
  { prop: 'nextContactTime', label: '下次联系时间', minWidth: 144 },
  { prop: 'productKinds', label: '商品种类', minWidth: 86 },
  { prop: 'productCount', label: '商品总数', minWidth: 128 },
  { prop: 'totalAmount', label: '合计总价（含税）', minWidth: 155, money: true },
  { prop: 'discount', label: '整单折扣(%)', minWidth: 163 },
  { prop: 'finalAmount', label: '整单最终价', minWidth: 128, money: true },
  { prop: 'stage', label: '商机阶段', minWidth: 110 },
  { prop: 'creator', label: '创建人', minWidth: 86 },
  { prop: 'createTime', label: '创建时间', minWidth: 185 }
]

/** 阶段标签配色：越往后越「热」；赢单/输单是终态，单独给色 */
const STAGE_TAG = {
  初步接洽: 'info',
  需求确认: 'warning',
  方案报价: 'primary',
  商务谈判: 'success',
  赢单: 'success',
  输单: 'danger'
}

/** 原型筛选胶囊：全部 / 我负责的 / 下属负责的 / 我关注的 */
const FILTERS = [
  { label: '全部商机', value: 'all' },
  { label: '我负责的商机', value: 'mine' },
  { label: '下属负责的商机', value: 'subordinate' },
  { label: '我关注的商机', value: 'starred' }
]

/** 原型商机页的批量按钮只有编辑和删除两项 */
const TOOLBAR = [
  { key: 'edit', perm: 'crm:opportunity:update', label: '编辑' },
  { key: 'delete', perm: 'crm:opportunity:delete', label: '删除' }
]

async function onExport() {
  try {
    const q = listRef.value?.getQuery?.() || {}
    const url = await exportOpportunity({ ...q })
    exportUrl.value = url || ''
    exportName.value = exportNameOf(FILTERS, q.scope, '商机')
    exportVisible.value = true
  } catch {
    // mock 模式下会提示「接口尚未实现」；真实环境的失败提示由 request.js 统一处理
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
 * 只有「我关注的商机」口径下行的**集合**才会随关注态改变，那时才需要重新取数。
 */
async function onToggleStar(row) {
  const wasStarred = row.starred
  // 「我关注的商机」口径下，取消关注会让这一行从结果集里消失，必须重新取数；
  // 其余口径星标只影响图标本身，本地翻转就够。
  const needReload = listRef.value?.getQuery?.().scope === 'starred'

  row.starred = !wasStarred   // 乐观翻转：先给反馈，失败再回滚
  try {
    if (wasStarred) {
      await unstarOpportunity(row.id)
    } else {
      await starOpportunity(row.id)
    }
    if (needReload) {
      listRef.value?.reload()
    }
  } catch {
    row.starred = wasStarred   // 回滚，别让图标和库里的状态对不上
    // 失败提示已由 request.js 统一处理
  }
}

const { visible, form, title, submitting, openAdd, openEdit, submit } = useFormDialog({
  label: '商机',
  emptyForm,
  create: createOpportunity,
  update: updateOpportunity,
  onSuccess: (mode) => {
    ElMessage.success(mode === 'add' ? '新增成功' : '修改成功')
    listRef.value?.clearSelection()
    listRef.value?.reload()
  }
})

function onAdd() {
  openAdd()
}

async function onAction({ key, rows, ids, clear }) {
  if (key === 'edit') {
    if (ids.length !== 1) return ElMessage.warning('请选择一条记录编辑')
    openEdit(rows[0])
    return
  }

  if (key === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 条商机吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await Promise.all(ids.map((id) => deleteOpportunity(id)))
    ElMessage.success('删除成功')
    clear()
    listRef.value?.reload()
  }
}
</script>
