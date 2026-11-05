<template>
  <!--
    商机详情

    除基础信息外还有产品明细与阶段变更历史，
    分别对应接口文档 5.1 的 `POST /crm/opportunity/{id}/products` 与
    `GET /crm/opportunity/{id}/stage-log`。
  -->
  <div v-loading="loading" class="detail">
    <div class="detail__head">
      <div class="detail__title-wrap">
        <el-button link class="detail__back" @click="router.back()">
          <el-icon><ArrowLeft /></el-icon>返回
        </el-button>
        <h2 class="detail__title">{{ base.name || '商机详情' }}</h2>
        <el-tag v-if="base.stage" effect="plain">{{ base.stage }}</el-tag>
      </div>

      <div>
        <el-button v-permission="'crm:opportunity:update'" @click="onEdit">编辑</el-button>
        <el-button type="primary" v-permission="'crm:opportunity:changeStage'" @click="openStageAdd()">变更阶段</el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="基础信息" name="base">
        <el-descriptions :column="3" border>
          <el-descriptions-item label="商机名称">{{ dash(base.name) }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ dash(base.customerName) }}</el-descriptions-item>
          <el-descriptions-item label="负责人">{{ dash(base.ownerName) }}</el-descriptions-item>
          <el-descriptions-item label="当前阶段">{{ dash(base.stage) }}</el-descriptions-item>
          <el-descriptions-item label="预计成交时间">{{ dash(base.expectDealTime) }}</el-descriptions-item>
          <el-descriptions-item label="下次联系时间">{{ dash(base.nextContactTime) }}</el-descriptions-item>
          <el-descriptions-item label="商品种类">{{ dash(base.productKinds) }}</el-descriptions-item>
          <el-descriptions-item label="商品总数">{{ dash(base.productCount) }}</el-descriptions-item>
          <el-descriptions-item label="整单折扣(%)">{{ base.discount != null ? base.discount + '%' : '--' }}</el-descriptions-item>
          <el-descriptions-item label="合计总价">{{ money(base.totalAmount) }}</el-descriptions-item>
          <el-descriptions-item label="整单最终价">{{ money(base.finalAmount) }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{ dash(base.creator) }}</el-descriptions-item>
          <el-descriptions-item label="创建时间" :span="3">{{ dash(base.createTime) }}</el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>

      <el-tab-pane label="产品明细" name="products">
        <div class="detail__tab-actions">
          <el-button type="primary" size="large" v-permission="'crm:opportunity:addProduct'" @click="openProductAdd()">添加产品</el-button>
        </div>

        <!--
          明细合计（含税）

          这个数就是保存后服务端回写到「合计总价」的值（Σ 明细行的含税金额），
          放在这里是为了让用户在点保存**之前**就看到它，而不是保存完才发现基础信息里的
          金额变了 —— 早先明细根本不影响金额，看起来就像「加了产品没生效」。
        -->
        <div class="detail__items-total">
          <span>明细合计（含税）：<b>{{ money(itemsTotal.totalWithTax) }}</b></span>
          <span class="detail__items-total-hint">
            保存后自动回写到基础信息的「合计总价」；没有明细时「合计总价」才是手填的预计金额
          </span>
        </div>

        <el-table :data="base.products || []" style="width: 100%">
          <el-table-column prop="productName" label="产品名称" min-width="140" />
          <el-table-column prop="unitName" label="单位" width="90" />
          <el-table-column prop="unitPrice" label="单价(含税)" min-width="120" />
          <el-table-column prop="quantity" label="数量" width="90" />
          <el-table-column prop="discountRate" label="折扣(%)" width="100" />
          <el-table-column prop="taxRate" label="税率(%)" width="100" />
          <el-table-column prop="amount" label="行金额" min-width="120" />
        </el-table>
        <el-empty v-if="!base.products?.length" description="暂无产品明细" :image-size="80" />
      </el-tab-pane>

      <el-tab-pane label="阶段变更历史" name="stageLog">
        <el-table :data="stageLog" style="width: 100%">
          <el-table-column prop="fromStage" label="原阶段" min-width="130" />
          <el-table-column prop="toStage" label="新阶段" min-width="130" />
          <el-table-column prop="operator" label="操作人" min-width="120" />
          <el-table-column prop="time" label="操作时间" min-width="170" />
          <el-table-column prop="remark" label="备注" min-width="180" />
        </el-table>
        <el-empty v-if="!stageLog.length" description="暂无阶段变更记录" :image-size="80" />
      </el-tab-pane>
    </el-tabs>

    <config-form-dialog
      v-model="visible"
      :title="title"
      :fields="FIELDS"
      :model="form"
      :submitting="submitting"
      width="720px"
      @submit="submit"
    />

    <config-form-dialog
      v-model="stageVisible"
      title="变更阶段"
      :fields="stageFields"
      :model="stageForm"
      :submitting="stageSubmitting"
      width="520px"
      @submit="submitStage"
    />

    <!-- 产品明细：回填现有明细，保存时走 PUT /products（整份覆盖） -->
    <config-form-dialog
      v-model="productVisible"
      :title="productTitle"
      :fields="PRODUCT_FIELDS"
      :model="productForm"
      :submitting="productSubmitting"
      width="1080px"
      label-width="110px"
      @submit="submitProducts"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import {
  getOpportunityDetail, getOpportunityStageLog,
  updateOpportunity, changeOpportunityStage, updateOpportunityProducts
} from '@/api/opportunity'
import { useFormDialog } from '@/composables/useFormDialog'
import { OPPORTUNITY_STAGE_OPTIONS } from '@/constants/options'
import { calcItemsTotal } from '@/utils/number'
import { FIELDS, emptyForm } from './form-config'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const activeTab = ref('base')
const base = ref({})
const stageLog = ref([])

/**
 * 明细合计（含税）= Σ 明细行的含税金额
 *
 * 这就是保存后服务端回写到「合计总价」的那个数（同一公式、同一组行金额），
 * 所以明细 Tab 里显示它 = 提前告诉用户「保存后基础信息里的合计总价会变成多少」。
 */
const itemsTotal = computed(() => calcItemsTotal(base.value.products || []))

/** 表单配置与列表页共用 ./form-config */
const { visible, form, title, submitting, openEdit, submit } = useFormDialog({
  label: '商机',
  emptyForm,
  update: updateOpportunity,
  onSuccess: async () => {
    ElMessage.success('修改成功')
    await load()
  }
})

function onEdit() {
  openEdit(base.value)
}

/**
 * 变更阶段
 *
 * 当前阶段从选项里剔掉 —— 选它等于什么都没干，还白写一条变更历史。
 * 这条历史会显示在「阶段变更历史」Tab 里（mock 会真的追加）。
 */
const stageFields = computed(() => [
  {
    prop: 'stage',
    label: '变更为',
    type: 'select',
    required: true,
    span: 24,
    options: OPPORTUNITY_STAGE_OPTIONS.filter((o) => o.value !== base.value.stage)
  },
  {
    prop: 'remark',
    label: '变更说明',
    type: 'textarea',
    span: 24,
    maxlength: 255,
    placeholder: '选填，会记入阶段变更历史'
  }
])

const {
  visible: stageVisible,
  form: stageForm,
  submitting: stageSubmitting,
  openAdd: openStageAdd,
  submit: submitStage
} = useFormDialog({
  label: '阶段',
  emptyForm: () => ({ stage: '', remark: '' }),
  create: (payload) => changeOpportunityStage(route.params.id, payload),
  onSuccess: async () => {
    ElMessage.success('阶段已变更')
    await load()
  }
})

/**
 * 产品明细
 *
 * 按钮文案沿用原型的「添加产品」，但弹窗是**回填现有明细**的：
 * 在里面既能加，也能改数量/单价、删掉不想要的行，保存时走
 * `PUT /crm/opportunity/{id}/products` 整份覆盖。
 *
 * 早先只能空弹窗追加（POST），所以已有行改不了也删不掉 ——
 * 那个 PUT 接口写好了却没有 UI，等于死代码。
 */
const PRODUCT_FIELDS = [
  {
    prop: 'products',
    label: '产品明细',
    type: 'items',
    span: 24,
    tip: '在下方直接增删改，保存后整份覆盖'
  }
]

const {
  visible: productVisible,
  form: productForm,
  title: productTitle,
  submitting: productSubmitting,
  openEdit: openProductEdit,
  submit: submitProducts
} = useFormDialog({
  label: '产品明细',
  emptyForm: () => ({ products: [] }),
  // openEdit 传的是「一行」，这里借它的 id 位放机会 id，明细放在 products
  update: (id, payload) => updateOpportunityProducts(id, payload.products),
  onSuccess: async () => {
    ElMessage.success('产品明细已保存')
    await load()
  }
})

function openProductAdd() {
  openProductEdit({ id: route.params.id, products: base.value.products || [] })
}

const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v)
const money = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'
}

async function load() {
  loading.value = true
  try {
    const [detail, log] = await Promise.all([
      getOpportunityDetail(route.params.id),
      getOpportunityStageLog(route.params.id)
    ])
    base.value = detail || {}
    stageLog.value = log || []
  } catch (e) {
    console.error('[商机详情] 加载失败', e)
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

.detail__tab-actions {
  margin-bottom: 12px;
}

.detail__items-total {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--crm-text-regular);

  b {
    color: var(--crm-text-primary);
    font-variant-numeric: tabular-nums;
  }
}

.detail__items-total-hint {
  font-size: 12px;
  color: var(--crm-text-secondary);
}
</style>
