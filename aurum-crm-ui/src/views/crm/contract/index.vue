<template>
  <pro-list
    ref="listRef"
    detail-path="/crm/contract/:id"
    title="合同"
    add-text="新增合同"
    :fetcher="getContractPage"
    :columns="columns"
    :filters="FILTERS"
    :toolbar="TOOLBAR"
    search-placeholder="合同名称/合同编号/客户"
    @add="onAdd"
    @action="onAction"
    @toggle-star="onToggleStar"
  >
    <template #filter-right>
      <el-button @click="onExport">导出</el-button>
      <el-button @click="onAdvancedFilter">高级筛选</el-button>
    </template>

    <!--
      审核态用标签区分：审核中黄、通过绿、拒绝红。
      ⚠️ 字段名是 auditStatus 而不是 status：这一列渲染的一直是**审核态**的中文标签，
         而后端 crm_contract 有两个状态列（audit_status 审核态 / status 履约状态）。
         原先挂在 status 名下属于名实不符，本次字段对齐顺手改正。
          审核态码值 → 中文：ContractAuditStatus（后端转好再返回）
    -->
    <template #cell-auditStatus="{ value }">
      <el-tag :type="STATUS_TYPE[value] || 'info'" effect="plain" size="small">
        {{ value }}
      </el-tag>
    </template>
  </pro-list>

  <config-form-dialog
    v-model="visible"
    :title="title"
    :fields="FIELDS"
    :model="form"
    :submitting="submitting"
    width="1080px"
    label-width="120px"
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
  getContractPage,
  deleteContract,
  submitContract,
  exportContract,
  getContractDetail,
  createContract,
  updateContract,
  starContract,
  unstarContract
} from '@/api/contract'
import { useFormDialog } from '@/composables/useFormDialog'
// 表单配置与详情页共用一份，别在这里另写
import { FIELDS, emptyForm } from './form-config'

const listRef = ref(null)

/**
 * 表格列
 *
 * 顺序与宽度取自原型「合同」页的表头（按元件绝对坐标的 left 升序提取）。
 * 一律用 minWidth，让表格自适应内容区宽度。
 *
 * prop 与后端 `ContractRespVO` 对齐（`id` / `name` / `customerName` /
 * `opportunityName` / `quotationNo` / `creator` 都是后端给的别名或跨表派生字段）。
 *
 * ⚠️ 原先这里叫 `orderDate` / `startTime` / `endTime`，后端是 `signDate` /
 *    `startDate` / `endDate`；`status` 渲染的其实是审核态，已改名为 `auditStatus`。
 *    这些差异会让整列显示「--」且不报错，属于 BUG-002 的一部分。
 *
 * ⚠️ 「整单利润」列已移除：全库没有 profit 列，《02-建表文档》3.6 明确这一版不计算利润，
 *    这一列永远拿不到数据。
 */
const columns = [
  { prop: 'name', label: '合同名称', minWidth: 100, link: true },
  { prop: 'contractNo', label: '合同编号', minWidth: 117 },
  { prop: 'customerName', label: '客户名称', minWidth: 80 },
  { prop: 'opportunityName', label: '商机名称', minWidth: 100 },
  { prop: 'quotationNo', label: '报价单编号', minWidth: 110 },
  { prop: 'signDate', label: '签约日期', minWidth: 100 },
  { prop: 'ownerName', label: '负责人', minWidth: 80 },
  { prop: 'startDate', label: '合同开始时间', minWidth: 110 },
  { prop: 'endDate', label: '合同结束时间', minWidth: 110 },
  { prop: 'auditStatus', label: '合同状态', minWidth: 80 },
  { prop: 'customerSigner', label: '客户签约人', minWidth: 80 },
  { prop: 'companySigner', label: '公司签约人', minWidth: 80 },
  { prop: 'finalAmount', label: '整单最终价', minWidth: 100, money: true },
  { prop: 'creator', label: '创建人', minWidth: 77 },
  { prop: 'createTime', label: '创建时间', minWidth: 140 }
]

/** 状态 → el-tag 类型 */
const STATUS_TYPE = {
  未提交: 'info',
  审核中: 'warning',
  审核通过: 'success',
  审核拒绝: 'danger'
}

const FILTERS = [
  { label: '全部合同', value: 'all' },
  { label: '我负责的合同', value: 'mine' },
  { label: '下属负责的合同', value: 'subordinate' },
  { label: '我关注的合同', value: 'starred' },
  { label: '未提交', value: 'draft' },
  { label: '审核中', value: 'auditing' },
  { label: '审核通过', value: 'approved' },
  { label: '审核拒绝', value: 'rejected' }
]

/** 原型工具栏：编辑 / 删除 / 提交审核 */
const TOOLBAR = [
  { key: 'edit', perm: 'crm:contract:update', label: '编辑' },
  { key: 'delete', perm: 'crm:contract:delete', label: '删除' },
  { key: 'submit', perm: 'crm:contract:submit', label: '提交审核' }
]

const { visible, form, title, submitting, openAdd, openEdit, submit } = useFormDialog({
  label: '合同',
  emptyForm,
  create: createContract,
  update: updateContract,
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
 * 只有「我关注的合同」口径下行的**集合**才会随关注态改变，那时才需要重新取数。
 */
async function onToggleStar(row) {
  const wasStarred = row.starred
  // 「我关注的合同」口径下，取消关注会让这一行从结果集里消失，必须重新取数；
  // 其余口径星标只影响图标本身，本地翻转就够。
  const needReload = listRef.value?.getQuery?.().scope === 'starred'

  row.starred = !wasStarred   // 乐观翻转：先给反馈，失败再回滚
  try {
    if (wasStarred) {
      await unstarContract(row.id)
    } else {
      await starContract(row.id)
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
    const url = await exportContract({ ...q })
    exportUrl.value = url || ''
    exportName.value = exportNameOf(FILTERS, q.scope, '合同')
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
    // 原型规则：未提交、审核拒绝状态下，可以编辑与删除；审核中、审核通过状态，不可操作
    // 明细行不在列表列里，必须取详情
    const detail = await getContractDetail(rows[0].id)
    openEdit({ ...rows[0], ...detail, products: detail?.products || [] })
    return
  }

  if (key === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${ids.length} 条合同吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await Promise.all(ids.map((id) => deleteContract(id)))
    ElMessage.success('删除成功')
    clear()
    listRef.value?.reload()
    return
  }

  if (key === 'submit') {
    try {
      await ElMessageBox.confirm(
        `确定提交选中的 ${ids.length} 条合同进行审核吗？提交后不可编辑。`,
        '提示',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    await Promise.all(ids.map((id) => submitContract(id)))
    ElMessage.success('已提交审核')
    clear()
    listRef.value?.reload()
  }
}
</script>
