<template>
  <!--
    回款详情（hidden 路由，由回款登记列表跳转进入）
  -->
  <div v-loading="loading" class="detail">
    <div class="detail__head">
      <div class="detail__title-wrap">
        <el-button link class="detail__back" @click="router.back()">
          <el-icon><ArrowLeft /></el-icon>返回
        </el-button>
        <h2 class="detail__title">{{ base.paymentNo || '回款详情' }}</h2>
        <el-tag v-if="base.auditStatus != null" :type="statusType(base.auditStatus)" effect="plain">
          {{ statusText(base.auditStatus) }}
        </el-tag>
      </div>

      <div>
        <el-button v-permission="'fin:payment:update'" @click="onEdit">编辑</el-button>
        <el-button type="primary" v-permission="'fin:payment:submit'" @click="onSubmit">提交审核</el-button>
      </div>
    </div>

    <el-descriptions :column="3" border>
      <el-descriptions-item label="回款编号">{{ dash(base.paymentNo) }}</el-descriptions-item>
      <el-descriptions-item label="客户名称">{{ dash(base.customerName) }}</el-descriptions-item>
      <el-descriptions-item label="回款日期">{{ dash(base.paymentDate) }}</el-descriptions-item>
      <el-descriptions-item label="本次回款金额">{{ money(base.amount) }}</el-descriptions-item>
      <el-descriptions-item label="未回款金额">{{ money(base.unpaidAmount) }}</el-descriptions-item>
      <el-descriptions-item label="回款方式">{{ paymentMethodText(base.paymentMethod) }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{ statusText(base.auditStatus) }}</el-descriptions-item>
      <el-descriptions-item label="开票状态">{{ dash(base.invoiceStatus) }}</el-descriptions-item>
      <el-descriptions-item label="创建人">{{ dash(base.creator) }}</el-descriptions-item>
      <el-descriptions-item label="备注" :span="3">{{ dash(base.remark) }}</el-descriptions-item>
      <el-descriptions-item label="创建时间" :span="3">{{ dash(base.createTime) }}</el-descriptions-item>
    </el-descriptions>

    <!--
      ⚠️ 金额字段对非财务角色会被后端置 null（接口文档 1.7 字段权限），
      上面的 money() 已统一兜底成 `--`。
    -->

    <config-form-dialog
      v-model="visible"
      :title="title"
      :fields="FIELDS"
      :model="form"
      :submitting="submitting"
      width="720px"
      @submit="submit"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import { getPaymentDetail, submitPayment, updatePayment } from '@/api/finance'
import { useFormDialog } from '@/composables/useFormDialog'
import { useDictMap, ensureDictOptions } from '@/composables/useDictOptions'
import { FIELDS, emptyForm } from './form-config'

// 预热没跑到或失败过时补一次（正常情况零请求）
ensureDictOptions(['fin_payment_method'])

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const base = ref({})

/** 表单配置与列表页共用 ./form-config */
const { visible, form, title, submitting, openEdit, submit } = useFormDialog({
  label: '回款',
  emptyForm,
  update: updatePayment,
  onSuccess: async () => {
    ElMessage.success('修改成功')
    await load()
  }
})

function onEdit() {
  openEdit(base.value)
}

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v)
const money = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'
}

/** 回款审核态 → 中文（兼容 mock 中文与后端数字两种取值） */
const PAYMENT_STATUS = {
  0: '未提交', 1: '财务审核中', 2: '已确认', 3: '财务审核拒绝',
  未提交: '未提交', 财务审核中: '财务审核中', 财务审核通过: '已确认', 财务审核拒绝: '财务审核拒绝'
}

/** 回款审核态 → el-tag 类型（兼容数字与中文） */
function statusType(status) {
  return {
    0: 'info', 1: 'warning', 2: 'success', 3: 'danger',
    未提交: 'info', 财务审核中: 'warning', 财务审核通过: 'success', 财务审核拒绝: 'danger'
  }[status] || 'info'
}

/** 回款方式数字 → 中文（字典 fin_payment_method，见 payment/index.vue 的说明） */
const PAYMENT_METHOD = useDictMap('fin_payment_method')
const statusText = (v) => PAYMENT_STATUS[v] || dash(v)
const paymentMethodText = (v) => PAYMENT_METHOD.value[v] ?? dash(v)

async function onSubmit() {
  try {
    await ElMessageBox.confirm('提交后进入财务审核流程，审核期间不可修改。确定提交吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  await submitPayment(route.params.id)
  ElMessage.success('已提交审核')
  await load()
}

async function load() {
  loading.value = true
  try {
    base.value = (await getPaymentDetail(route.params.id)) || {}
  } catch (e) {
    console.error('[回款详情] 加载失败', e)
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
</style>
