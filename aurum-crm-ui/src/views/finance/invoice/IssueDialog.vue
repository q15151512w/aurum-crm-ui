<template>
  <!--
    确认开票弹窗（财务开票页专用）

    与发票登记 / 回款审核不同：这个弹窗是「核对 + 录入」两段式 ——
      上半部（回款信息 / 发票信息）**只读**，是财务核对依据，不允许改；
      下半部（实际发票号 / 开票日期 / 开票资料）是本次开票要回填的东西。
    所以不套 ConfigFormDialog，自己写 el-form。只读部分用 el-descriptions /
    el-table 展示，天然没有可编辑控件。

    ⚠️ 为什么不放进 ConfigFormDialog 的字段配置里：回款明细是一张只读表，
       字段驱动模型只有「输入控件」，没有「只读表格」这种形态 —— 硬塞进去
       反而要把 FormField 的 type 分发再扩一个「只读表格」出来，不值。
  -->
  <el-dialog
    :model-value="modelValue"
    title="确认开票"
    width="760px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading">
      <!--
        区块顺序与原型「确认开票」一致：回款信息 → 本次总开票金额 → 发票信息 → 开票录入。
        回款信息在最上，是财务核对的第一依据（这笔票开的是哪几笔回款）；
        发票信息是登记时存下的快照，核对无误后才在底部录入实际发票号。
      -->

      <!-- 回款信息（只读，唯一事实来源是 fin_invoice_payment） -->
      <div class="issue-dialog__section">回款信息</div>
      <el-table :data="allocations" size="small" border>
        <el-table-column prop="paymentNo" label="回款编号" min-width="150" />
        <el-table-column label="回款方式" min-width="100">
          <template #default="{ row }">{{ dash(row.paymentMethodName) }}</template>
        </el-table-column>
        <el-table-column label="回款日期" min-width="110">
          <template #default="{ row }">{{ dash(row.paymentDate) }}</template>
        </el-table-column>
        <el-table-column label="回款金额" min-width="130" align="right">
          <template #default="{ row }">{{ formatMoney(row.paymentAmount) }}</template>
        </el-table-column>
        <el-table-column label="本次开票金额" min-width="130" align="right">
          <template #default="{ row }">{{ formatMoney(row.writeOffAmount) }}</template>
        </el-table-column>
        <template #empty>暂无回款明细</template>
      </el-table>

      <!-- 本次总开票金额：原型在回款表正下方那一行 -->
      <div class="issue-dialog__total">
        <span class="issue-dialog__total-label">本次总开票金额</span>
        <b class="issue-dialog__total-value">{{ formatMoney(totalWriteOff) }}</b>
      </div>

      <!-- 发票信息（只读，登记时存的快照） -->
      <div class="issue-dialog__section">发票信息</div>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="发票抬头">{{ dash(summary.invoiceTitle) }}</el-descriptions-item>
        <el-descriptions-item label="纳税人识别号">{{ dash(summary.taxNo) }}</el-descriptions-item>
        <el-descriptions-item label="开户行">{{ dash(summary.bankName) }}</el-descriptions-item>
        <el-descriptions-item label="银行账号">{{ dash(summary.bankAccount) }}</el-descriptions-item>
        <el-descriptions-item label="开户行地址">{{ dash(summary.invoiceAddr) }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ dash(summary.invoicePhone) }}</el-descriptions-item>
      </el-descriptions>

      <!-- 开票录入 -->
      <div class="issue-dialog__section">开票信息</div>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="实际发票号" prop="invoiceNo">
          <el-input
            v-model="form.invoiceNo"
            maxlength="64"
            placeholder="请输入实际发票号"
            clearable
          />
        </el-form-item>
        <el-form-item label="开票日期" prop="issueDate">
          <el-date-picker
            v-model="form.issueDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="请选择开票日期"
            :disabled-date="disabledDate"
          />
        </el-form-item>
        <el-form-item label="开票资料" prop="attachmentIds">
          <pdf-attachment-upload
            v-model="form.attachmentIds"
            biz-type="invoice"
            :biz-id="invoiceId"
          />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button :disabled="submitting" @click="emit('update:modelValue', false)">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onConfirm">确认开票</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PdfAttachmentUpload from '@/components/form/PdfAttachmentUpload.vue'
import { getInvoiceDetail, issueInvoice } from '@/api/finance'
import { formatMoney } from '@/utils/number'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 待开票行（来自 getInvoiceAuditList） */
  row: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue', 'success'])

const formRef = ref(null)
const submitting = ref(false)
const loading = ref(false)
const detail = ref(null)

const form = ref({ invoiceNo: '', issueDate: today(), attachmentIds: [] })

const rules = {
  invoiceNo: [{ required: true, message: '请输入实际发票号', trigger: 'blur' }],
  issueDate: [{ required: true, message: '请选择开票日期', trigger: 'change' }],
  attachmentIds: [{ required: true, message: '请上传开票 PDF 资料', trigger: 'change' }]
}

/** 待开票行真正的发票主键是 invoiceId（没有时退回 id），issue 接口靠它定位 */
const invoiceId = computed(() => props.row?.invoiceId ?? props.row?.id ?? null)

/** 展示数据：优先详情（带 allocations），退回列表行兜底 */
const summary = computed(() => detail.value || props.row || {})
const allocations = computed(() => summary.value.allocations || [])

/**
 * 本次总开票金额
 *
 * 由明细的 writeOffAmount 求和 —— 与后端 totalAmount 同一口径
 * （服务端按明细汇总算价税合计，这里再算一遍只是为了在明细还没到位时不显示 0）。
 * 明细为空的老单据（本功能上线前用 SQL 直接插的历史行）退回列表行的 totalAmount，
 * 否则会显示一个误导人的 0.00。
 */
const totalWriteOff = computed(() => {
  if (!allocations.value.length) return summary.value.totalAmount ?? 0
  return allocations.value.reduce((sum, row) => sum + Number(row.writeOffAmount || 0), 0)
})

/**
 * 打开时拉一次详情拿回款明细
 *
 * 真实后端的 audit-list 已经带 allocations（InvoiceServiceImpl.pageQuery 的「列表也带上明细」），
 * 但 mock 的待开列表只过滤 invoice 数组、不带明细 —— 统一走一次详情，两种模式都拿得到。
 * 详情失败时退回列表行：六个发票信息字段列表行里本来就有，明细为空表但不阻塞开票。
 */
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    detail.value = null
    form.value = { invoiceNo: '', issueDate: today(), attachmentIds: [] }
    loading.value = true
    try {
      const resp = await getInvoiceDetail(invoiceId.value)
      detail.value = resp || props.row
    } catch {
      detail.value = props.row
    } finally {
      loading.value = false
    }
  }
)

/** 当天日期，与 mock/db.js 的日期字段保持一致（yyyy-MM-dd） */
function today() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/**
 * 开票日期不能早于申请日期
 *
 * 后端 issue 用 `issueDate.isBefore(applyDate)` 判（严格早于才算错），
 * 所以这里只禁用申请日期**之前**的日期，申请日当天可选。
 * applyDate 是 'yyyy-MM-dd' 字符串，解析成本地零点再比，避免 `new Date('yyyy-MM-dd')`
 * 按 UTC 解析带来的时区偏移（UTC+8 下会误禁掉申请日当天）。
 */
function disabledDate(time) {
  const ap = toLocalDate(summary.value.applyDate)
  if (!ap) return false
  return time.getTime() < ap.getTime()
}

function toLocalDate(s) {
  if (!s) return null
  const [y, m, d] = String(s).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v)

/**
 * 确认开票：先校验 → 二次确认 → 提交
 *
 * 校验失败、二次确认取消、请求失败都不关弹窗；提交中 disabled/loading 挡住重复点。
 * 失败提示由 request.js 统一处理，这里只负责成功后的通知（emit success 交给父页面刷新）。
 */
async function onConfirm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  // 前端即时校验（disabledDate 已经挡住大部分，这里兜底）
  if (summary.value.applyDate && form.value.issueDate < summary.value.applyDate) {
    ElMessage.warning('开票日期不能早于申请日期')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认对发票 ${dash(summary.value.applyNo)} 执行开票吗？`,
      '确认开票',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  submitting.value = true
  try {
    await issueInvoice(invoiceId.value, {
      invoiceNo: form.value.invoiceNo,
      issueDate: form.value.issueDate,
      attachmentIds: form.value.attachmentIds
    })
    emit('success')
    emit('update:modelValue', false)
  } catch {
    // 失败提示已由 request.js 统一处理，保持弹窗打开
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.issue-dialog__section {
  margin: 12px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--crm-text-primary);
}

.issue-dialog__section:first-child {
  margin-top: 0;
}

/* 本次总开票金额：与 InvoicePaymentEditor 的同名汇总行保持同一视觉 */
.issue-dialog__total {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
  padding: 10px 12px;
  background-color: var(--crm-bg-hover);
  border-radius: 4px;
}

.issue-dialog__total-label {
  font-size: 13px;
  color: var(--crm-text-secondary);
}

.issue-dialog__total-value {
  font-size: 15px;
  color: var(--crm-text-primary);
  font-variant-numeric: tabular-nums;
}
</style>
