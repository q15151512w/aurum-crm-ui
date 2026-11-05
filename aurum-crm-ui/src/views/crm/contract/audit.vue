<template>
  <!--
    合同审核（对应原型「合同审核」页）

    与「合同」列表的区别：没有新增按钮、没有筛选胶囊行，
    列里也不含合同状态，而是换成提交人 / 提交时间。
  -->
  <pro-list
    ref="listRef"
    title="合同审核"
    :fetcher="getContractAuditList"
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

    <!--
      当前环节 / 下一步：这一页是审批人的主战场，光有「审核中」三个字答不出「现在该谁审」。
      两个字段由后端在 /crm/contract/audit-list 每行回填（含待办人 / 预计审批人），点一下看完整链路。
    -->
    <template #cell-currentNodeName="{ row }">
      <span v-if="row.currentNodeName" class="crm-link" @click.stop="openProgress(row)">
        {{ currentNodeText(row) }}
      </span>
      <span v-else>--</span>
    </template>

    <template #cell-nextNodeName="{ row }">
      <span v-if="row.nextNodeName" class="crm-link" @click.stop="openProgress(row)">
        {{ nextNodeText(row) }}
      </span>
      <span v-else>--</span>
    </template>
  </pro-list>

  <!-- 审批进度：当前环节 / 下一步到谁 / 每一步谁审的。v-if 保证每次打开都重新取数 -->
  <el-dialog v-model="progressVisible" title="审批进度" width="680px">
    <approval-progress v-if="progressVisible" :contract-id="progressRow.contractId ?? progressRow.id" />
  </el-dialog>

  <!--
    审核弹窗直接复用配置驱动的 ConfigFormDialog —— 字段 schema 已经能表达
    「单选结果 + 意见仅驳回时必填」（required 支持函数），不必另写一个组件。
  -->
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
import ApprovalProgress from './ApprovalProgress.vue'
import {
  getContractAuditList, auditContract, batchAuditContract, exportContract
} from '@/api/contract'
import { useFormDialog } from '@/composables/useFormDialog'

const listRef = ref(null)

/** 本次要审核的行（单条或批量） */
const auditRows = ref([])

/** 审批进度弹窗：点「当前环节 / 下一步」两列打开 */
const progressVisible = ref(false)
const progressRow = ref({})

function openProgress(row) {
  progressRow.value = row
  progressVisible.value = true
}

/** 后端遵循 non_null：空字段可能整个不出现 */
const names = (v) => (Array.isArray(v) ? v : [])

/** 单元格文案：「财务审批 · 待 赵财务、陈会计」（列是 show-overflow-tooltip，悬停看全） */
function currentNodeText(row) {
  const who = names(row.pendingApproverNames)
  return who.length ? `${row.currentNodeName} · 待 ${who.join('、')}` : row.currentNodeName
}

/** 「财务审批 · 预计 赵财务、陈会计」—— 预计值，不是既成事实 */
function nextNodeText(row) {
  const who = names(row.nextApproverNames)
  return who.length ? `${row.nextNodeName} · 预计 ${who.join('、')}` : row.nextNodeName
}

const auditTitle = computed(() => {
  const n = auditRows.value.length
  return n > 1 ? `批量审核（${n} 份合同）` : '合同审核'
})

/**
 * 审核表单
 *
 * 请求体按《05-接口文档.md》第六节：{ result: 1 通过 / 2 驳回, comment }。
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
  label: '合同审核',
  emptyForm: () => ({ result: 1, comment: '' }),
  create: async (payload) => {
    const ids = auditRows.value.map(bizIdOf)
    if (ids.length === 1) {
      await auditContract(ids[0], payload)
    } else {
      await batchAuditContract({ ids, ...payload })
    }
  },
  onSuccess: () => {
    // form 在提交后不会被重置，这里直接读刚提交的结果
    ElMessage.success(form.value.result === 2 ? '已驳回' : '审核通过')
    listRef.value?.clearSelection()
    listRef.value?.reload()
  }
})

/**
 * 表格列
 *
 * 宽度取自原型「合同审核」页的表头。
 * prop 与后端 `ContractRespVO` 对齐（`id` / `name` / `customerName` 等是后端给的别名）。
 *
 * ⚠️ 「整单利润」列已移除：全库没有 profit 列，这一版不计算利润（《02-建表文档》3.6）。
 * ⚠️ 提交人 / 提交时间取的是审批实例的 `applyUserName` / `applyTime`（点「提交审核」的人与时间），
 *    **不是** `creator` / `createTime`（建单人、建单时间）—— 单据可以甲建乙提交。
 *    它们与「当前环节 / 下一步」一起，由后端在 /crm/contract/audit-list 每行回填。
 */
const columns = [
  { prop: 'name', label: '合同名称', minWidth: 109, link: true },
  { prop: 'contractNo', label: '合同编号', minWidth: 128 },
  { prop: 'customerName', label: '客户名称', minWidth: 88 },
  { prop: 'opportunityName', label: '商机名称', minWidth: 109 },
  { prop: 'quotationNo', label: '报价单编号', minWidth: 120 },
  { prop: 'signDate', label: '签约日期', minWidth: 109 },
  { prop: 'ownerName', label: '负责人', minWidth: 88 },
  { prop: 'startDate', label: '合同开始时间', minWidth: 120 },
  { prop: 'endDate', label: '合同结束时间', minWidth: 120 },
  { prop: 'customerSigner', label: '客户签约人', minWidth: 88 },
  { prop: 'companySigner', label: '公司签约人', minWidth: 88 },
  { prop: 'finalAmount', label: '整单最终价', minWidth: 109, money: true },
  { prop: 'applyUserName', label: '提交人', minWidth: 84 },
  { prop: 'applyTime', label: '提交时间', minWidth: 152 },
  { prop: 'currentNodeName', label: '当前环节', minWidth: 150 },
  { prop: 'nextNodeName', label: '下一步', minWidth: 150 }
]

/** 原型工具栏：审核 / 批量审核 */
const TOOLBAR = [
  { key: 'audit', perm: 'crm:contract:audit', label: '审核' },
  { key: 'batchAudit', perm: 'crm:contract:batchAudit', label: '批量审核' }
]

/** 待审核行取自 contractAudit，真正的合同主键是 contractId（没有时退回 id） */
const bizIdOf = (row) => row.contractId ?? row.id

function onAdvancedFilter() {
  ElMessage.info('高级筛选尚未实现')
}

async function onExport() {
  try {
    const url = await exportContract({ ...listRef.value?.getQuery?.() })
    exportUrl.value = url || ''
    exportName.value = '合同审核导出'
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
 * 审核
 *
 * 单条和批量走同一个弹窗，只是提交时调的接口不同：
 * 单条 POST /crm/contract/{id}/audit，批量 POST /crm/contract/batch-audit。
 */
function onAction({ key, rows }) {
  if (key === 'audit') {
    if (rows.length !== 1) return ElMessage.warning('请选择一条记录审核')
  } else if (key === 'batchAudit') {
    if (!rows.length) return ElMessage.warning('请选择要审核的记录')
  } else {
    return
  }

  auditRows.value = rows
  openAdd()
}
</script>
