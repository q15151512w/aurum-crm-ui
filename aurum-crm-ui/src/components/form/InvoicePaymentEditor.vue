<template>
  <!--
    回款分摊明细编辑器（发票登记）

    原型「新增发票登记」的核心：一张发票合并该客户的多笔回款。
    - 选好客户后自动带出该客户「尚未全部开票」的回款
    - 每行可改「本次开票金额」，底部实时汇总成「本次总开票金额」
    - 可移除行；「添加回款」把移除过的候选再加回来

    ⚠️ 与 ProductItemEditor 的关键差别：本控件**要读父表单的 customerId** 才能拉候选。
    所以 FormField 除了 v-model 还多传了一个 `:model`（父表单对象）。
    产品明细自给自足（选项来自独立接口），不需要这个。

    ⚠️ 候选回款只在「选客户」那一步拉一次（由页面负责），
    本控件只做「从已有候选里增删行」与「改金额」。这样用户改行内金额时
    不会触发网络请求，也不会因为重新拉取而把用户刚填的数冲掉。
  -->
  <div class="crm-payment-editor">
    <div class="crm-payment-editor__head">
      <span class="crm-payment-editor__title">回款信息</span>
      <el-button
        type="primary"
        size="small"
        :disabled="!model?.customerId || !available.length"
        @click="pickerVisible = true"
      >添加回款</el-button>
      <span class="crm-payment-editor__hint">
        <template v-if="!model?.customerId">请先选择客户</template>
        <template v-else-if="!candidates.length">
          该客户暂无未全部开票的回款
        </template>
        <template v-else>「本次开票金额」不得超过该行的可开余额</template>
      </span>
    </div>

    <el-table :data="items" class="crm-payment-editor__table" border size="small">
      <el-table-column type="index" label="#" width="40" align="center" />

      <el-table-column label="回款编号" min-width="140">
        <template #default="{ row }">
          <span class="crm-payment-editor__no">{{ row.paymentNo || '--' }}</span>
        </template>
      </el-table-column>

      <el-table-column label="回款方式" width="100">
        <template #default="{ row }">{{ row.paymentMethodName || '--' }}</template>
      </el-table-column>

      <el-table-column label="回款日期" width="112">
        <template #default="{ row }">{{ row.paymentDate || '--' }}</template>
      </el-table-column>

      <el-table-column label="本次回款金额" width="122" align="right">
        <template #default="{ row }">
          <span class="crm-payment-editor__money">{{ formatMoney(paymentAmount(row)) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="本次开票金额" width="160">
        <template #default="{ row }">
          <!--
            max 取该行的可开余额：后端也会拦（错误码 3106），但前端先挡住能省一次往返，
            也给用户即时反馈。余额同时含「他人已开」与「本行已开」的语义，
            见下方 rowMax() 的注释。
          -->
          <el-input-number
            v-model="row.writeOffAmount"
            :min="0"
            :max="rowMax(row)"
            :precision="2"
            :controls="false"
            placeholder="0.00"
            class="crm-payment-editor__input"
          />
        </template>
      </el-table-column>

      <el-table-column label="操作" width="64" align="center">
        <template #default="{ $index }">
          <el-button link type="danger" size="small" @click="removeItem($index)">移除</el-button>
        </template>
      </el-table-column>

      <template #empty>暂无回款，点「添加回款」从该客户的可开票回款里选</template>
    </el-table>

    <!-- 本次总开票金额：原型底部那一行，实时联动 -->
    <div class="crm-payment-editor__total">
      <span class="crm-payment-editor__total-label">本次总开票金额</span>
      <b class="crm-payment-editor__total-value">{{ formatMoney(totalAmount) }}</b>
    </div>

    <!-- 候选选择器：只列还没加进明细的那些 -->
    <el-dialog v-model="pickerVisible" title="选择回款" width="680px" :close-on-click-modal="false">
      <el-table
        ref="pickTableRef"
        :data="available"
        border
        size="small"
        @selection-change="(rows) => (picked = rows)"
      >
        <el-table-column type="selection" width="42" />
        <el-table-column prop="paymentNo" label="回款编号" min-width="140" />
        <el-table-column prop="paymentMethodName" label="回款方式" width="100" />
        <el-table-column prop="paymentDate" label="回款日期" width="112" />
        <el-table-column label="本次回款金额" width="122" align="right">
          <template #default="{ row }">
            {{ formatMoney(row.amount) }}
          </template>
        </el-table-column>
        <el-table-column label="可开余额" width="122" align="right">
          <template #default="{ row }">
            <b class="crm-payment-editor__money">{{ formatMoney(row.remainingAmount) }}</b>
          </template>
        </el-table-column>
        <template #empty>没有可添加的回款了</template>
      </el-table>

      <template #footer>
        <el-button @click="pickerVisible = false">取消</el-button>
        <el-button type="primary" @click="addPicked">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatMoney } from '@/utils/number'

const props = defineProps({
  /** 明细行数组：{ paymentId, paymentNo, paymentMethodName, paymentDate, amount, allocatedAmount, writeOffAmount } */
  modelValue: { type: Array, default: () => [] },
  /** 父表单对象：只需要 customerId / candidates 两项（页面在选客户时写入） */
  model: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['update:modelValue'])

const pickerVisible = ref(false)
const pickTableRef = ref(null)
const picked = ref([])

const items = computed({
  get: () => props.modelValue || [],
  set: (v) => emit('update:modelValue', v)
})

/**
 * 该客户的可开票回款候选
 *
 * 由页面在「选客户 / 加载编辑数据」时一次性写入 `model.candidates`，
 * 本控件只消费不请求 —— 避免行内改金额时触发重新拉取、把用户填的数冲掉。
 */
const candidates = computed(() => props.model?.candidates || [])

/** 还没加进明细的候选 */
const available = computed(() => {
  const used = new Set(items.value.map((i) => String(i.paymentId)))
  return candidates.value.filter((c) => !used.has(String(c.paymentId)))
})

/**
 * 单行的可开上限
 *
 * `remainingAmount` 是后端给的「扣除他人占用后」的余额，**不含本行自己已填的数**
 * （后端算剩余额度时把本发票的占用排除了）。所以本行能填的最大值就是它本身，
 * 不需要再加回 writeOffAmount —— 加了会让用户能填出超过余额的数、保存时才被后端拒绝。
 */
function rowMax(row) {
  return Number(row.remainingAmount ?? row.amount ?? 0)
}

/** 该行的回款总额（回款本身的金额，不是本次开票金额） */
function paymentAmount(row) {
  return Number(row.amount || 0)
}

/** 本次总开票金额 = Σ 本次开票金额，实时算 */
const totalAmount = computed(() =>
  items.value.reduce((sum, row) => sum + Number(row.writeOffAmount || 0), 0)
)

/** 把选中的候选追加成明细行，金额预填为可开余额 */
function addPicked() {
  const added = picked.value.map((c) => ({
    paymentId: c.paymentId,
    paymentNo: c.paymentNo,
    paymentMethodName: c.paymentMethodName,
    paymentDate: c.paymentDate,
    amount: Number(c.amount || 0),
    allocatedAmount: Number(c.allocatedAmount || 0),
    remainingAmount: Number(c.remainingAmount || 0),
    // 预填可开余额，用户按需改小 —— 与原型「选客户后带出、支持调整」一致
    writeOffAmount: Number(c.remainingAmount || 0)
  }))
  items.value = [...items.value, ...added]
  picked.value = []
  pickerVisible.value = false
}

function removeItem(index) {
  const next = [...items.value]
  next.splice(index, 1)
  items.value = next
}
</script>

<style scoped lang="scss">
.crm-payment-editor {
  width: 100%;
  min-width: 0; /* 让表格能自己出横向滚动条，而不是顶破弹窗 */
}

.crm-payment-editor__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.crm-payment-editor__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--crm-text-primary);
}

.crm-payment-editor__hint {
  font-size: 12px;
  color: var(--crm-text-secondary);
}

.crm-payment-editor__table {
  width: 100%;
}

.crm-payment-editor__no,
.crm-payment-editor__money {
  font-variant-numeric: tabular-nums;
}

.crm-payment-editor__input {
  width: 100%;
}

.crm-payment-editor__total {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
  padding: 10px 12px;
  background-color: var(--crm-bg-hover);
  border-radius: 4px;
}

.crm-payment-editor__total-label {
  font-size: 13px;
  color: var(--crm-text-secondary);
}

.crm-payment-editor__total-value {
  font-size: 15px;
  color: var(--crm-text-primary);
  font-variant-numeric: tabular-nums;
}
</style>
