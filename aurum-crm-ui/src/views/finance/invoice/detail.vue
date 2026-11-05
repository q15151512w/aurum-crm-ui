<template>
  <!--
    发票详情（hidden 路由，由「发票登记」与「财务开票」两个列表点申请编号进入）

    与「确认开票」弹窗的分工：弹窗是财务在**开票那一刻**的核对+录入；
    本页是**随时可查**的完整单据视图，所以开票资料在这里是可下载的，
    而弹窗里是可以上传的。
  -->
  <div v-loading="loading" class="detail">
    <div class="detail__head">
      <div class="detail__title-wrap">
        <el-button link class="detail__back" @click="router.back()">
          <el-icon><ArrowLeft /></el-icon>返回
        </el-button>
        <h2 class="detail__title">{{ base.applyNo || '发票详情' }}</h2>
        <el-tag :type="statusType(base)" effect="plain">{{ statusText(base) }}</el-tag>
        <el-tag v-if="base.invoiceNo" type="success" effect="plain">
          发票号 {{ base.invoiceNo }}
        </el-tag>
      </div>

      <div>
        <el-button
          v-if="canIssue"
          type="primary"
          v-permission="'fin:invoice:issue'"
          @click="issueVisible = true"
        >确认开票</el-button>
      </div>
    </div>

    <!-- 基本信息 -->
    <div class="detail__section">基本信息</div>
    <el-descriptions :column="3" border>
      <el-descriptions-item label="发票申请编号">{{ dash(base.applyNo) }}</el-descriptions-item>
      <el-descriptions-item label="客户名称">{{ dash(base.customerName) }}</el-descriptions-item>
      <el-descriptions-item label="发票类型">{{ invoiceTypeText(base.invoiceType) }}</el-descriptions-item>
      <el-descriptions-item label="申请开票日期">{{ dash(base.applyDate) }}</el-descriptions-item>
      <el-descriptions-item label="开票日期">{{ dash(base.issueDate) }}</el-descriptions-item>
      <el-descriptions-item label="实际发票号">{{ dash(base.invoiceNo) }}</el-descriptions-item>
      <el-descriptions-item label="含税合计">{{ money(base.totalAmount) }}</el-descriptions-item>
      <el-descriptions-item label="不含税金额">{{ money(base.amount) }}</el-descriptions-item>
      <el-descriptions-item label="税率">{{ base.taxRate != null ? base.taxRate + '%' : '--' }}</el-descriptions-item>
      <el-descriptions-item label="税额">{{ money(base.taxAmount) }}</el-descriptions-item>
      <el-descriptions-item label="负责人">{{ dash(base.ownerName) }}</el-descriptions-item>
      <el-descriptions-item label="创建人">{{ dash(base.creator) }}</el-descriptions-item>
      <el-descriptions-item label="备注" :span="3">{{ dash(base.remark) }}</el-descriptions-item>
      <el-descriptions-item label="创建时间" :span="3">{{ dash(base.createTime) }}</el-descriptions-item>
    </el-descriptions>

    <!-- 回款信息（一票多回款，唯一事实来源是 fin_invoice_payment） -->
    <div class="detail__section">回款信息</div>
    <el-table :data="allocations" border size="small">
      <el-table-column prop="paymentNo" label="回款编号" min-width="150" />
      <el-table-column label="回款方式" min-width="100">
        <template #default="{ row }">{{ dash(row.paymentMethodName) }}</template>
      </el-table-column>
      <el-table-column label="回款日期" min-width="110">
        <template #default="{ row }">{{ dash(row.paymentDate) }}</template>
      </el-table-column>
      <el-table-column label="回款金额" min-width="130" align="right">
        <template #default="{ row }">{{ money(row.paymentAmount) }}</template>
      </el-table-column>
      <el-table-column label="本次开票金额" min-width="130" align="right">
        <template #default="{ row }">{{ money(row.writeOffAmount) }}</template>
      </el-table-column>
      <template #empty>暂无回款明细</template>
    </el-table>

    <!-- 本次总开票金额：与「确认开票」弹窗同一口径 -->
    <div class="detail__total">
      <span class="detail__total-label">本次总开票金额</span>
      <b class="detail__total-value">{{ money(totalWriteOff) }}</b>
    </div>

    <!-- 发票信息（登记时存的客户开票信息快照） -->
    <div class="detail__section">发票信息</div>
    <el-descriptions :column="2" border>
      <el-descriptions-item label="发票抬头">{{ dash(base.invoiceTitle) }}</el-descriptions-item>
      <el-descriptions-item label="纳税人识别号">{{ dash(base.taxNo) }}</el-descriptions-item>
      <el-descriptions-item label="开户行">{{ dash(base.bankName) }}</el-descriptions-item>
      <el-descriptions-item label="银行账号">{{ dash(base.bankAccount) }}</el-descriptions-item>
      <el-descriptions-item label="开户行地址">{{ dash(base.invoiceAddr) }}</el-descriptions-item>
      <el-descriptions-item label="联系电话">{{ dash(base.invoicePhone) }}</el-descriptions-item>
    </el-descriptions>

    <!-- 开票资料（有附件才显示这一块） -->
    <template v-if="attachmentIds.length">
      <div class="detail__section">开票资料</div>
      <ul class="detail__files">
        <li v-for="id in attachmentIds" :key="id">
          <el-button link type="primary" @click="onDownload(id)">附件-{{ id }}.pdf</el-button>
        </li>
      </ul>
    </template>

    <!-- 财务在详情页也能直接开票，复用「财务开票」页的同一个弹窗 -->
    <issue-dialog v-model="issueVisible" :row="base" @success="onIssued" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import IssueDialog from './IssueDialog.vue'
import { getInvoiceDetail } from '@/api/finance'
import { downloadFile } from '@/api/system'
import { dictLabel, ensureDictOptions } from '@/composables/useDictOptions'

// 预热没跑到或失败过时补一次（正常情况零请求）
ensureDictOptions(['fin_invoice_type'])

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const base = ref({})
const issueVisible = ref(false)

/**
 * 单据状态文案
 *
 * ⚠️ 后端把「审核态」与「单据态」拆成两列（audit_status / status），
 *    用户看不到两列，所以要合成一个可读状态：
 *      已作废(status=2) > 已开票(status=1) > 已驳回(audit=3) > 审批中(audit=1)
 *      > 已通过待开票(audit=2) > 未提交。
 *    判定顺序不能调 —— 比如一张已开票的票 status=1 同时 audit=2，
 *    先判 audit 会显示成「待开票」。
 */
function statusText(row) {
  if (row.status === 2) return '已作废'
  if (row.status === 1) return '已开票'
  if (row.auditStatus === 3) return '财务拒绝'
  if (row.auditStatus === 1) return '开票中'
  if (row.auditStatus === 2) return '待开票'
  return '未提交'
}

function statusType(row) {
  if (row.status === 2) return 'danger'
  if (row.status === 1) return 'success'
  if (row.auditStatus === 3) return 'danger'
  if (row.auditStatus === 1) return 'warning'
  if (row.auditStatus === 2) return 'warning'
  return 'info'
}

/** 只有「已通过 + 待开票」才轮得到财务开票 —— 与后端 issue 的前置条件一致 */
const canIssue = computed(() => base.value.auditStatus === 2 && base.value.status === 0)

const allocations = computed(() => base.value.allocations || [])
const attachmentIds = computed(() => base.value.attachmentIds || [])

/** 本次总开票金额：明细求和；没有明细的老单据退回价税合计 */
const totalWriteOff = computed(() => {
  if (!allocations.value.length) return base.value.totalAmount ?? 0
  return allocations.value.reduce((s, r) => s + Number(r.writeOffAmount || 0), 0)
})

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v)

const money = (v) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '--'
}

function invoiceTypeText(v) {
  // 口径统一在 dictLabel（未命中返回原值，兼容老数据里的中文）
  return dictLabel('fin_invoice_type', v)
}

async function onDownload(id) {
  try {
    const blob = await downloadFile(id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `附件-${id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    // 失败提示已由 request.js 统一处理
  }
}

function onIssued() {
  ElMessage.success('开票成功')
  load()
}

async function load() {
  loading.value = true
  try {
    base.value = (await getInvoiceDetail(route.params.id)) || {}
  } catch (e) {
    console.error('[发票详情] 加载失败', e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.detail {
  min-height: 200px;
}

.detail__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.detail__title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail__back {
  color: var(--crm-text-secondary);
}

.detail__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--crm-text-primary);
}

.detail__section {
  margin: 20px 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--crm-text-primary);
}

/* 本次总开票金额：与 InvoicePaymentEditor / IssueDialog 同一视觉口径 */
.detail__total {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
  padding: 10px 12px;
  background-color: var(--crm-bg-hover);
  border-radius: 4px;
}

.detail__total-label {
  font-size: 13px;
  color: var(--crm-text-secondary);
}

.detail__total-value {
  font-size: 15px;
  color: var(--crm-text-primary);
  font-variant-numeric: tabular-nums;
}

.detail__files {
  margin: 0;
  padding-left: 18px;
}
</style>
