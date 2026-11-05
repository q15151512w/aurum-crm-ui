<template>
  <!--
    产品详情（只读展示页）

    路由 /crm/product/:id 由后端菜单树生成（sys_menu 里 visible=0 的隐藏节点，
    与线索/客户/商机/合同的详情页同一形态）。

    定位：**只展示，不给编辑入口**。改产品走列表页的「编辑」——
    那里才有 ProductImageUpload（图片上传）等控件。
  -->
  <div v-loading="loading" class="detail">
    <!-- ---------------- 头部 ---------------- -->
    <div class="detail__head">
      <div class="detail__title-wrap">
        <el-button link class="detail__back" @click="router.back()">
          <el-icon><ArrowLeft /></el-icon>返回
        </el-button>
        <h2 class="detail__title">{{ base.name || '产品详情' }}</h2>
        <!-- 上架/下架标签：颜色与列表同源（constants/statusTags.js），两处永远一致 -->
        <el-tag v-if="base.onShelf !== undefined && base.onShelf !== null" :type="shelfTagType(base.onShelf)" effect="plain" size="small">
          {{ base.onShelf ? '上架' : '下架' }}
        </el-tag>
      </div>

      <span v-if="base.code" class="detail__no">{{ base.code }}</span>
    </div>

    <!-- ---------------- 概览：产品图 + 关键数字 ---------------- -->
    <div class="detail__card">
      <el-image
        v-if="base.imageUrl"
        :src="base.imageUrl"
        :preview-src-list="[base.imageUrl]"
        preview-teleported
        fit="cover"
        class="detail__thumb"
      />
      <!-- 没图时给一个占位块，比留白更像"这里本该有张图" -->
      <div v-else class="detail__thumb detail__thumb--empty">
        <el-icon><Picture /></el-icon>
        <span>暂无图片</span>
      </div>

      <div class="detail__overview">
        <div class="detail__kpis">
          <div class="detail__kpi">
            <span class="detail__kpi-label">建议销售价</span>
            <b class="detail__kpi-value detail__kpi-value--primary">{{ money(base.salePrice) }}</b>
          </div>
          <div class="detail__kpi">
            <!-- 成本价受字段权限保护，非授权角色后端返回 null → 显示 -- -->
            <span class="detail__kpi-label">成本价</span>
            <b class="detail__kpi-value">{{ money(base.costPrice) }}</b>
          </div>
          <div class="detail__kpi">
            <span class="detail__kpi-label">税率</span>
            <b class="detail__kpi-value">{{ percent(base.taxRate) }}</b>
          </div>
          <div class="detail__kpi">
            <span class="detail__kpi-label">计量单位</span>
            <b class="detail__kpi-value">{{ dash(base.unitName) }}</b>
          </div>
        </div>

        <div class="detail__overview-sub">
          <span>产品类型：<b>{{ dash(base.categoryName) }}</b></span>
          <span>创建人：<b>{{ dash(base.creator) }}</b></span>
        </div>
      </div>
    </div>

    <!-- ---------------- 基础信息 ---------------- -->
    <h3 class="detail__section">基础信息</h3>
    <el-descriptions :column="3" border>
      <el-descriptions-item label="产品名称">{{ dash(base.name) }}</el-descriptions-item>
      <el-descriptions-item label="产品编码">{{ dash(base.code) }}</el-descriptions-item>
      <el-descriptions-item label="产品类型">{{ dash(base.categoryName) }}</el-descriptions-item>
      <el-descriptions-item label="计量单位">{{ dash(base.unitName) }}</el-descriptions-item>
      <el-descriptions-item label="建议销售价">{{ money(base.salePrice) }}</el-descriptions-item>
      <el-descriptions-item label="成本价">{{ money(base.costPrice) }}</el-descriptions-item>
      <el-descriptions-item label="税率">{{ percent(base.taxRate) }}</el-descriptions-item>
      <el-descriptions-item label="是否上架销售">{{ base.onShelf ? '上架' : '下架' }}</el-descriptions-item>
      <el-descriptions-item label="创建人">{{ dash(base.creator) }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ dash(base.createTime) }}</el-descriptions-item>
      <el-descriptions-item label="更新时间" :span="2">{{ dash(base.updateTime) }}</el-descriptions-item>
      <el-descriptions-item label="产品描述" :span="3">{{ dash(base.description) }}</el-descriptions-item>
      <el-descriptions-item label="备注" :span="3">{{ dash(base.remark) }}</el-descriptions-item>
    </el-descriptions>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Picture } from '@element-plus/icons-vue'
import { getProductDetail } from '@/api/product'
import { formatMoney } from '@/utils/number'
import { shelfTagType } from '@/constants/statusTags'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const base = ref({})

/** 字段权限会把敏感字段置 null（接口文档 1.7），统一兜底成 -- */
const dash = (v) => (v === null || v === undefined || v === '' ? '--' : v)

/**
 * 金额：先判空再格式化
 *
 * ⚠️ 不能直接 `formatMoney(v)` —— 它内部是 `Number(v)`，而 `Number(null) === 0`，
 *    于是「成本价不可见」会被显示成 `0.00`，看起来像"成本价是 0"，属于会误导人的假数据。
 */
const money = (v) => (v === null || v === undefined || v === '' ? '--' : formatMoney(v))

/** 税率：库里是 DECIMAL(5,2)（如 6.00），界面上补个 % 更好读 */
const percent = (v) => (v === null || v === undefined || v === '' ? '--' : `${Number(v)}%`)

async function load() {
  loading.value = true
  try {
    base.value = (await getProductDetail(route.params.id)) || {}
  } catch (e) {
    // 失败提示由 request.js 统一弹（如 2401 产品不存在），这里只留日志
    console.error('[产品详情] 加载失败', e)
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

.detail__no {
  font-size: 13px;
  color: var(--crm-text-secondary);
}

/* 白底卡片：与 el-card 同一套规格，在灰色内容区上读起来是一块整体 */
.detail__card {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  padding: 20px 24px;
  margin-bottom: 20px;
  background-color: var(--crm-bg-white);
  border: 1px solid var(--crm-border-light);
  border-radius: 4px;
}

.detail__thumb {
  width: 120px;
  height: 120px;
  flex: 0 0 auto;
  border: 1px solid var(--crm-border);
  border-radius: 4px;
  cursor: zoom-in;
}

.detail__thumb--empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: var(--crm-text-secondary);
  cursor: default;
  background-color: var(--crm-bg-hover);

  .el-icon {
    font-size: 22px;
  }
}

.detail__overview {
  flex: 1;
  min-width: 0;
}

.detail__kpis {
  display: flex;
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

.detail__overview-sub {
  display: flex;
  gap: 24px;
  margin-top: 18px;
  font-size: 12px;
  color: var(--crm-text-secondary);

  b {
    font-weight: 600;
    color: var(--crm-text-regular);
  }
}

.detail__section {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--crm-text-primary);
}
</style>
