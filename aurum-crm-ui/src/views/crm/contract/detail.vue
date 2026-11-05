<template>
  <!--
    合同详情（对应原型「合同详情」页）

    原型有 6 个 Tab：基础信息 / 产品 / 回款 / 发票 / 附件 / 操作记录
  -->
  <div v-loading="loading" class="detail">
    <div class="detail__head">
      <div class="detail__title-wrap">
        <el-button link class="detail__back" @click="router.back()">
          <el-icon><ArrowLeft /></el-icon>返回
        </el-button>
        <h2 class="detail__title">{{ base.name || '合同详情' }}</h2>
        <el-tag v-if="base.auditStatus" :type="statusType(base.auditStatus)" effect="plain">
          {{ base.auditStatus }}
        </el-tag>
      </div>

      <div>
        <el-button v-permission="'crm:contract:update'" @click="onEdit">编辑</el-button>
        <el-button type="primary" v-permission="'crm:contract:submit'" @click="onSubmit">提交审核</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <!-- ---------- 基础信息 ---------- -->
      <el-tab-pane label="基础信息" name="base">
        <el-descriptions :column="3" border>
          <el-descriptions-item label="合同名称">{{ dash(base.name) }}</el-descriptions-item>
          <el-descriptions-item label="合同编号">{{ dash(base.contractNo) }}</el-descriptions-item>
          <el-descriptions-item label="合同状态">{{ dash(base.auditStatus) }}</el-descriptions-item>
          <el-descriptions-item label="客户名称">{{ dash(base.customerName) }}</el-descriptions-item>
          <el-descriptions-item label="商机名称">{{ dash(base.opportunityName) }}</el-descriptions-item>
          <el-descriptions-item label="报价单编号">{{ dash(base.quotationNo) }}</el-descriptions-item>
          <el-descriptions-item label="签约日期">{{ dash(base.signDate) }}</el-descriptions-item>
          <el-descriptions-item label="合同开始时间">{{ dash(base.startDate) }}</el-descriptions-item>
          <el-descriptions-item label="合同结束时间">{{ dash(base.endDate) }}</el-descriptions-item>
          <el-descriptions-item label="客户签约人">{{ dash(base.customerSigner) }}</el-descriptions-item>
          <el-descriptions-item label="公司签约人">{{ dash(base.companySigner) }}</el-descriptions-item>
          <el-descriptions-item label="负责人">{{ dash(base.ownerName) }}</el-descriptions-item>
          <el-descriptions-item label="整单最终价">{{ money(base.finalAmount) }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{ dash(base.creator) }}</el-descriptions-item>
          <el-descriptions-item label="创建时间" :span="3">{{ dash(base.createTime) }}</el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>

      <!-- ---------- 审批进度 ---------- -->
      <!-- v-if：切到这个 Tab 才取数（el-tab-pane 默认会把所有面板都渲染出来） -->
      <el-tab-pane label="审批进度" name="approval">
        <approval-progress v-if="activeTab === 'approval'" :contract-id="route.params.id" />
      </el-tab-pane>

      <!-- ---------- 产品明细 ---------- -->
      <el-tab-pane label="产品" name="products">
        <el-table :data="base.items || []" style="width: 100%">
          <el-table-column prop="productName" label="产品名称" min-width="140" />
          <el-table-column prop="unitName" label="单位" width="90" />
          <el-table-column prop="unitPrice" label="单价(含税)" min-width="120" />
          <el-table-column prop="quantity" label="数量" width="90" />
          <el-table-column prop="discountRate" label="折扣(%)" width="100" />
          <el-table-column prop="taxRate" label="税率(%)" width="100" />
          <el-table-column prop="amount" label="行金额" min-width="120" />
        </el-table>
      </el-tab-pane>

      <!-- ---------- 其余 Tab 暂无数据源，等后端实现 ---------- -->
      <el-tab-pane
        v-for="tab in EMPTY_TABS"
        :key="tab"
        :label="tab"
        :name="tab"
      >
        <el-empty :description="`暂无${tab}`" :image-size="80" />
      </el-tab-pane>
    </el-tabs>

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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import ApprovalProgress from './ApprovalProgress.vue'
import { getContractDetail, updateContract, submitContract } from '@/api/contract'
import { useFormDialog } from '@/composables/useFormDialog'
import { FIELDS, emptyForm } from './form-config'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const activeTab = ref('base')
const base = ref({})

/**
 * 回款 / 发票 / 附件 / 操作记录
 *
 * 接口文档里合同只有一个 /crm/contract/{id}（含明细），没有像客户那样的
 * 聚合接口，这四个 Tab 的数据源待后端补齐。
 */
const EMPTY_TABS = ['回款', '发票', '附件', '操作记录']

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v)
const money = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'
}

function statusType(status) {
  return { 未提交: 'info', 审核中: 'warning', 审核通过: 'success', 审核拒绝: 'danger' }[status] || 'info'
}

async function load() {
  loading.value = true
  try {
    base.value = (await getContractDetail(route.params.id)) || {}
  } catch (e) {
    console.error('[合同详情] 加载失败', e)
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** 表单配置与列表页共用 ./form-config */
const { visible, form, title, submitting, openEdit, submit } = useFormDialog({
  label: '合同',
  emptyForm,
  update: updateContract,
  onSuccess: async () => {
    ElMessage.success('修改成功')
    await load()
  }
})

function onEdit() {
  openEdit(base.value)
}

async function onSubmit() {
  try {
    await ElMessageBox.confirm('提交后进入审核流程，审核期间不可修改。确定提交吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  await submitContract(route.params.id)
  ElMessage.success('已提交审核')
  await load()
}
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
  margin-bottom: 8px;
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
