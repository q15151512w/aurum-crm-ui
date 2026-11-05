<template>
  <!--
    报价单详情（只读展示页）

    路由 /crm/quotation/:id 由后端菜单树生成（sys_menu 里 visible=0 的隐藏节点，
    与线索/客户/商机/合同的详情页同一形态），所以本页没有自己的路由表项。

    定位：**只展示，不给编辑入口**。要改报价单走列表页的「编辑」——
    那里才有 ProductItemEditor 与「转合同 / 作废」两个状态动作。
  -->
  <div v-loading="loading" class="detail">
    <!-- ---------------- 头部 ---------------- -->
    <div class="detail__head">
      <div class="detail__title-wrap">
        <el-button link class="detail__back" @click="router.back()">
          <el-icon><ArrowLeft /></el-icon>返回
        </el-button>
        <h2 class="detail__title">{{ base.name || '报价单详情' }}</h2>
        <!-- 状态标签：配色与列表页同一份常量（constants/statusTags.js），两处永远同色 -->
        <el-tag v-if="base.status" :type="QUOTATION_STATUS_TAG[base.status] || 'info'" effect="plain" size="small">
          {{ base.status }}
        </el-tag>
      </div>

      <div class="detail__head-right">
        <span v-if="base.quotationNo" class="detail__no">{{ base.quotationNo }}</span>
        <!-- 关联合同：与列表「关联合同」列同一个入口，1:N 时提示只给最新一份 -->
        <el-tooltip v-if="base.contractId" :content="contractTip" placement="top">
          <el-button link type="primary" @click="openContract">
            {{ base.contractNo || '查看合同' }}
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!--
      ---------------- 金额概览 ----------------
      三个数与列表行的口径完全对应（后端 QuotationRespVO 注释）：
        totalAmount = 不含税合计（落库的明细汇总）
        taxAmount   = 税额
        finalAmount = **折后**价税合计 = 价税合计 × (1 − 商机折扣/100)
      折扣来自关联商机，报价单自己不存折扣；profit 在「有明细缺成本」时后端给 null → 显示 --
    -->
    <div class="detail__card">
      <div class="detail__kpis">
        <div class="detail__kpi">
          <span class="detail__kpi-label">合计价格（不含税）</span>
          <b class="detail__kpi-value">{{ money(base.totalAmount) }}</b>
        </div>
        <div class="detail__kpi">
          <span class="detail__kpi-label">税额</span>
          <b class="detail__kpi-value">{{ money(base.taxAmount) }}</b>
        </div>
        <div class="detail__kpi">
          <span class="detail__kpi-label">整单最终价（折后含税）</span>
          <b class="detail__kpi-value detail__kpi-value--primary">{{ money(base.finalAmount) }}</b>
        </div>
      </div>

      <div class="detail__kpi-side">
        <span>整单折扣 <b>{{ discountText }}</b></span>
        <span>整单利润 <b>{{ money(base.profit) }}</b></span>
        <span>商品总数 <b>{{ countText }}</b></span>
      </div>
    </div>

    <!-- ---------------- 基础信息 ---------------- -->
    <h3 class="detail__section">基础信息</h3>
    <el-descriptions :column="3" border>
      <el-descriptions-item label="报价单名称">{{ dash(base.name) }}</el-descriptions-item>
      <el-descriptions-item label="报价单编号">{{ dash(base.quotationNo) }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{ dash(base.status) }}</el-descriptions-item>
      <el-descriptions-item label="客户名称">{{ dash(base.customerName) }}</el-descriptions-item>
      <el-descriptions-item label="报价商机">{{ dash(base.opportunityName) }}</el-descriptions-item>
      <el-descriptions-item label="负责人">{{ dash(base.ownerName) }}</el-descriptions-item>
      <el-descriptions-item label="报价日期">{{ dash(base.quoteDate) }}</el-descriptions-item>
      <el-descriptions-item label="有效期至">{{ dash(base.validDate) }}</el-descriptions-item>
      <el-descriptions-item label="关联合同">{{ dash(base.contractNo) }}</el-descriptions-item>
      <el-descriptions-item label="创建人">{{ dash(base.creator) }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ dash(base.createTime) }}</el-descriptions-item>
      <el-descriptions-item label="更新时间">{{ dash(base.updateTime) }}</el-descriptions-item>
      <el-descriptions-item label="备注" :span="3">{{ dash(base.remark) }}</el-descriptions-item>
    </el-descriptions>

    <!-- ---------------- 产品明细 ---------------- -->
    <h3 class="detail__section">
      产品明细
      <span class="detail__section-sub">共 {{ (base.products || []).length }} 行</span>
    </h3>
    <el-table :data="base.products || []" style="width: 100%">
      <el-table-column prop="productName" label="产品名称" min-width="140">
        <template #default="{ row }">{{ dash(row.productName) }}</template>
      </el-table-column>
      <el-table-column prop="unitName" label="单位" width="90" />
      <el-table-column label="单价(含税)" min-width="120" align="right">
        <template #default="{ row }">{{ money(row.unitPrice) }}</template>
      </el-table-column>
      <el-table-column prop="quantity" label="数量" width="90">
        <template #default="{ row }">{{ num(row.quantity) }}</template>
      </el-table-column>
      <el-table-column label="折扣(%)" width="100">
        <template #default="{ row }">{{ num(row.discountRate) }}</template>
      </el-table-column>
      <el-table-column label="税率(%)" width="100">
        <template #default="{ row }">{{ num(row.taxRate) }}</template>
      </el-table-column>
      <el-table-column label="行金额" min-width="120" align="right">
        <template #default="{ row }">
          <span class="detail__money">{{ money(row.amount) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="120">
        <template #default="{ row }">{{ dash(row.remark) }}</template>
      </el-table-column>

      <template #empty>
        <el-empty description="这张报价单还没有产品明细" :image-size="80" />
      </template>
    </el-table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { getQuotationDetail } from '@/api/opportunity'
import { formatMoney } from '@/utils/number'
import { QUOTATION_STATUS_TAG } from '@/constants/statusTags'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const base = ref({})

/** 字段权限会把敏感字段置 null（接口文档 1.7），统一兜底成 -- */
const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v)

/**
 * 金额：先判空再格式化
 *
 * ⚠️ 不能直接 `formatMoney(v)` —— 它内部是 `Number(v)`，
 *    `Number(null) === 0`，于是「未知」会被显示成 `0.00`（整单利润那种可空字段就会骗人）。
 */
const money = (v) => (v === null || v === undefined || v === '' ? '--' : formatMoney(v))

/** 数量/折扣/税率这类数值：0 是有效值，只兜 null */
const num = (v) => (v === null || v === undefined || v === '' ? '--' : Number(v))

const discountText = computed(() => `${Number(base.value.discount) || 0}%`)

const countText = computed(() => {
  const n = Number(base.value.productCount)
  if (!Number.isFinite(n)) return '--'
  // 数量可能有小数（SUM(quantity)），是整数就不显示 .00
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)))
})

const contractTip = computed(() =>
  base.value.contractCount > 1
    ? `共 ${base.value.contractCount} 份合同，点击查看最新一份`
    : '点击查看合同详情'
)

function openContract() {
  if (!base.value.contractId) return
  router.push(`/crm/contract/${base.value.contractId}`)
}

async function load() {
  loading.value = true
  try {
    base.value = (await getQuotationDetail(route.params.id)) || {}
  } catch (e) {
    // 失败提示由 request.js 统一弹（如 2251 报价单不存在），这里只留日志
    console.error('[报价单详情] 加载失败', e)
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

.detail__head-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail__no {
  font-size: 13px;
  color: var(--crm-text-secondary);
}

/*
  金额概览：白底 + 细边框，在灰色内容区上读起来像一张卡
  （与 el-card 同一套规格：--crm-bg-white 底、--crm-border-light 边、4px 圆角）
*/
.detail__card {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 18px 24px;
  margin-bottom: 20px;
  background-color: var(--crm-bg-white);
  border: 1px solid var(--crm-border-light);
  border-radius: 4px;
}

.detail__kpis {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 40px;
}

.detail__kpi {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail__kpi-label {
  font-size: 12px;
  color: var(--crm-text-secondary);
}

.detail__kpi-value {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--crm-text-primary);
  font-variant-numeric: tabular-nums;

  &--primary {
    color: var(--crm-primary);
  }
}

/* 折扣/利润/总数是辅助信息，靠右且不抢视线 */
.detail__kpi-side {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-left: auto;
  font-size: 12px;
  color: var(--crm-text-secondary);

  b {
    font-weight: 600;
    color: var(--crm-text-regular);
    font-variant-numeric: tabular-nums;
  }
}

.detail__section {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--crm-text-primary);
}

.detail__section-sub {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: var(--crm-text-secondary);
}

.detail__money {
  font-variant-numeric: tabular-nums;
}

/* 明细表与下面一段内容之间留白，免得表格和标题黏在一起 */
.detail__section + .el-table {
  margin-bottom: 8px;
}
</style>
