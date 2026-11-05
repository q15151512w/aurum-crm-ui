<template>
  <pro-list
    ref="listRef"
    title="公海规则"
    :fetcher="getPoolRuleList"
    :columns="columns"
    :filters="FILTERS"
    :toolbar="TOOLBAR"
    :starrable="false"
    search-placeholder="规则名称"
    @action="onAction"
  >
    <!-- 启用状态直接原地切换，不走编辑弹窗 -->
    <template #cell-enabled="{ row }">
      <el-switch
        :model-value="row.enabled"
        :loading="switchingId === row.id"
        @change="(v) => onToggleEnabled(row, v)"
      />
    </template>
  </pro-list>

  <config-form-dialog
    v-model="visible"
    :title="title"
    :fields="FIELDS"
    :model="form"
    :submitting="submitting"
    width="560px"
    @submit="submit"
  />
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import ProList from '@/components/ProList.vue'
import ConfigFormDialog from '@/components/form/ConfigFormDialog.vue'
import { getPoolRuleList, updatePoolRule } from '@/api/customer'
import { useFormDialog } from '@/composables/useFormDialog'
import { POOL_TYPE_OPTIONS, CLAIM_CYCLE_OPTIONS } from '@/constants/options'

const listRef = ref(null)

/** 正在提交的规则 id，用来给开关加 loading，避免连点 */
const switchingId = ref(null)

/**
 * 表格列
 *
 * prop 必须与 src/mock/db.js 里 poolRule 的字段名一致。
 * 规则只有两条（线索池 / 公海），原型上没有独立页面，宽度按语义取。
 */
const columns = [
  { prop: 'poolType', label: '池类型', minWidth: 100 },
  { prop: 'name', label: '规则名称', minWidth: 160 },
  { prop: 'recycleDays', label: '回收天数', minWidth: 100 },
  { prop: 'claimLimit', label: '领取上限', minWidth: 100 },
  { prop: 'claimCycle', label: '领取周期', minWidth: 100 },
  { prop: 'notifyDays', label: '提前提醒天数', minWidth: 120 },
  { prop: 'enabled', label: '是否启用', minWidth: 100 }
]

/** 原型上规则页没有筛选行，传空数组即可 */
const FILTERS = []

/** 原型工具栏只有「编辑」，「启用/停用」在表格里直接切 */
const TOOLBAR = [{ key: 'edit', perm: 'crm:poolRule:update', label: '编辑' }]

/**
 * 切换启用状态
 *
 * 等接口成功后再改本地数据：失败时开关自动停在原位，
 * 不会出现「界面显示已启用、后端其实没改」的假象。
 */
async function onToggleEnabled(row, enabled) {
  switchingId.value = row.id
  try {
    await updatePoolRule(row.id, { enabled })
    row.enabled = enabled
    ElMessage.success(enabled ? '已启用' : '已停用')
  } catch {
    // 失败提示已由 request.js 统一处理，开关保持原值
  } finally {
    switchingId.value = null
  }
}

/**
 * 编辑表单字段
 *
 * 这一页只有编辑、没有新增 —— 池类型（线索池 / 公海）是固定的两类，
 * 所以池类型置灰，只让改规则参数。
 *
 * ⚠️ 「启用」不在表单里：列表上的开关是即改即生效的，放进表单会多一次确认动作。
 */
const FIELDS = [
  {
    prop: 'poolType',
    label: '池类型',
    type: 'select',
    options: POOL_TYPE_OPTIONS,
    required: true,
    disabled: true,
    tip: '池类型固定，不可修改'
  },
  { prop: 'name', label: '规则名称', type: 'input', required: true, maxlength: 64 },
  {
    prop: 'recycleDays',
    label: '回收天数',
    type: 'number',
    required: true,
    min: 0,
    max: 999,
    tip: '超过这个天数未跟进则回收；填 0 表示不回收'
  },
  {
    prop: 'claimLimit',
    label: '领取上限',
    type: 'number',
    required: true,
    min: 0,
    max: 999,
    tip: '每个周期内最多可领取的条数；填 0 表示不限'
  },
  {
    prop: 'claimCycle',
    label: '领取周期',
    type: 'select',
    options: CLAIM_CYCLE_OPTIONS,
    required: true
  },
  {
    prop: 'notifyDays',
    label: '提前提醒天数',
    type: 'number',
    required: true,
    min: 0,
    max: 999,
    tip: '回收前多少天提醒负责人'
  }
]

const { visible, form, title, submitting, openEdit, submit } = useFormDialog({
  label: '公海规则',
  emptyForm: () => ({
    poolType: '',
    name: '',
    recycleDays: 30,
    claimLimit: 0,
    claimCycle: '每月',
    notifyDays: 3
  }),
  update: updatePoolRule,
  onSuccess: () => {
    ElMessage.success('修改成功')
    listRef.value?.clearSelection()
    listRef.value?.reload()
  }
})

function onAction({ key, rows, ids }) {
  if (key !== 'edit') return
  if (ids.length !== 1) return ElMessage.warning('请选择一条记录编辑')
  openEdit(rows[0])
}
</script>
