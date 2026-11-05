<template>
  <!--
    产品明细行编辑器

    报价单和合同共用。原型上「添加产品」出现 3 次，都是同一件事：
    选产品 → 带出名称/单位/单价 → 填数量折扣 → 实时算金额。

    ⚠️ 金额口径见《02-建表文档》3.6（那节标注了「必须实现前定稿」）：
       行金额 = ROUND(数量 × 单价 ×(1 - 折扣/100), 2)   —— 含税
       合计先逐行四舍五入再汇总，不能先汇总再算税。
       公式本身在 utils/number.js，这里只负责渲染与交互。
  -->
  <div class="crm-item-editor">
    <div class="crm-item-editor__head">
      <el-button type="primary" @click="pickerVisible = true">添加产品</el-button>
      <span class="crm-item-editor__hint">单价为含税价，行金额自动计算</span>
    </div>

    <!--
      ⚠️ 列宽是**算过的**，别随手调大（踩过一次，见下）：

      装这张表的弹窗都是 1080px（报价单 / 合同 / 商机详情），
        可用宽度 = 1080 − body 左右内边距 48 − label-width 110~120 ≈ 900px

      早先 10 列的宽度合计最小要 1082px（固定列 802 + 两个 min-width 280），
      比容器宽出 ~170px —— 结果最右的「备注 / 操作」被挤出弹窗、中间几列的
      输入框被挤成一窄条。下面这组值是收紧后的：固定 644 + 弹性 220 = **864px**，
      在三种弹窗里都放得下；富余的宽度由两个 min-width 列（产品名称 / 备注）
      按比例吸收，所以右侧不会留白。

      加列之前先算一遍这条账，否则又会撑破容器。
    -->
    <el-table :data="items" class="crm-items-table" border size="small">
      <el-table-column type="index" label="#" width="40" align="center" />

      <el-table-column label="产品名称" min-width="130">
        <template #default="{ row }">
          <!-- 名称是快照：产品改价/下架不影响已保存的历史单据 -->
          <el-input v-model="row.productName" placeholder="产品名称" />
        </template>
      </el-table-column>

      <el-table-column label="单位" width="80">
        <template #default="{ row }">
          <el-select v-model="row.unitName" placeholder="单位" clearable>
            <el-option v-for="u in unitOptions" :key="u.value" :label="u.label" :value="u.value" />
          </el-select>
        </template>
      </el-table-column>

      <el-table-column label="数量" width="96">
        <template #default="{ row }">
          <el-input-number
            v-model="row.quantity"
            :min="0"
            :precision="4"
            :controls="false"
            placeholder="数量"
          />
        </template>
      </el-table-column>

      <el-table-column label="单价(含税)" width="96">
        <template #default="{ row }">
          <el-input-number
            v-model="row.unitPrice"
            :min="0"
            :precision="2"
            :controls="false"
            placeholder="单价"
          />
        </template>
      </el-table-column>

      <el-table-column label="折扣(%)" width="84">
        <template #default="{ row }">
          <el-input-number
            v-model="row.discountRate"
            :min="0"
            :max="100"
            :precision="2"
            :controls="false"
            placeholder="折扣"
          />
        </template>
      </el-table-column>

      <el-table-column label="税率(%)" width="84">
        <template #default="{ row }">
          <el-input-number
            v-model="row.taxRate"
            :min="0"
            :max="100"
            :precision="2"
            :controls="false"
            placeholder="税率"
          />
        </template>
      </el-table-column>

      <el-table-column label="行金额" width="104" align="right">
        <template #default="{ row }">
          <span class="crm-item-editor__money">{{ formatMoney(lineAmount(row)) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="备注" min-width="90">
        <template #default="{ row }">
          <el-input v-model="row.remark" placeholder="选填" />
        </template>
      </el-table-column>

      <el-table-column label="操作" width="60" align="center">
        <template #default="{ $index }">
          <el-button link type="danger" size="small" @click="removeItem($index)">删除</el-button>
        </template>
      </el-table-column>

      <template #empty>暂无产品明细，点「添加产品」开始</template>
    </el-table>

    <!-- 合计：三个数直接对应 3.6 的口径，方便客户/财务核对 -->
    <div class="crm-item-editor__total">
      <span class="crm-item-editor__total-item">
        含税合计：<b>{{ formatMoney(totals.totalWithTax) }}</b>
      </span>
      <span class="crm-item-editor__total-item">
        税额：<b>{{ formatMoney(totals.taxAmount) }}</b>
      </span>
      <span class="crm-item-editor__total-item">
        不含税合计：<b>{{ formatMoney(totals.totalAmount) }}</b>
      </span>
    </div>

    <entity-selector-dialog
      v-model="pickerVisible"
      selector-key="product"
      @confirm="onProductsPicked"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import EntitySelectorDialog from './EntitySelectorDialog.vue'
import { calcItemAmounts, calcItemsTotal, formatMoney } from '@/utils/number'
import { ensureUnitOptions, unitOptions } from '@/composables/useUnitOptions'

const props = defineProps({
  /** 明细行数组，写回时也是整份数组 */
  modelValue: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue'])

const pickerVisible = ref(false)

// 单位下拉的选项来自后端（只含启用单位），与产品表单共用同一份缓存
onMounted(() => {
  ensureUnitOptions()
})

const items = computed({
  get: () => props.modelValue || [],
  set: (v) => emit('update:modelValue', v)
})

/** 单行金额，随数量/单价/折扣/税率变化实时重算 */
function lineAmount(row) {
  return calcItemAmounts(row).amount
}

/**
 * 合计
 *
 * 跟着 items 的深层变化重算 —— 行里的 quantity 是原地改的，
 * 不 deep 监听的话改了数量合计不动。
 */
const totals = computed(() => calcItemsTotal(items.value))

/**
 * 把算好的行金额写回每一行
 *
 * 界面上行金额是算出来的（不落模型），但提交给后端时 payload 里得有这个字段，
 * 否则单据存下来的明细金额是空的。这里统一回写。
 */
watch(
  items,
  (rows) => {
    for (const row of rows) {
      const { amount } = calcItemAmounts(row)
      if (row.amount !== amount) row.amount = amount
    }
  },
  { deep: true, immediate: true }
)

/** 选完产品：按产品带出名称/单位/售价，数量默认 1 */
function onProductsPicked(rows) {
  const existing = new Set(items.value.map((i) => i.productId))
  const added = rows
    .filter((r) => !existing.has(r.id))
    .map((r) => ({
      productId: r.id,
      productName: r.name,
      unitName: r.unitName || '',
      quantity: 1,
      unitPrice: Number(r.salePrice) || 0,
      discountRate: 0,
      // 税率随产品带出：产品上维护的税率写进明细行，作为报价单/合同的 tax_rate 快照
      // （后端 ItemSupport 按 3.6 用这个值算行不含税与税额）。
      // ⚠️ 带出来之后**用户仍可手改**；改产品的税率不会回刷已保存的单据（快照语义）。
      // 产品没维护税率（老数据 tax_rate = 0）时带 0，与改动前的行为一致。
      taxRate: Number(r.taxRate) || 0,
      amount: 0,
      remark: ''
    }))

  items.value = [...items.value, ...added]
}

function removeItem(index) {
  const next = [...items.value]
  next.splice(index, 1)
  items.value = next
}
</script>

<style scoped lang="scss">
/*
  收缩兜底：明细表的最小列宽合计 864px，正常弹窗里放得下；
  万一以后加了列把容器撑紧，也让它能正常收缩（由表格自己出横向滚动条），
  而不是把弹窗内容区顶破 —— min-width: 0 是 flex 子项能收缩的前提。
*/
.crm-item-editor {
  width: 100%;
  min-width: 0;
}

.crm-item-editor__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.crm-item-editor__hint {
  font-size: 12px;
  color: var(--crm-text-secondary);
}

.crm-item-editor__money {
  font-variant-numeric: tabular-nums;
}

.crm-item-editor__total {
  display: flex;
  justify-content: flex-end;
  gap: 24px;
  margin-top: 12px;
  padding: 10px 12px;
  font-size: 13px;
  // 标签用次要色、数字用主色加粗：三个数一眼能摘出来
  color: var(--crm-text-secondary);
  background-color: var(--crm-bg-hover);
  border-radius: 4px;

  b {
    color: var(--crm-text-primary);
    font-variant-numeric: tabular-nums;
  }
}
</style>
